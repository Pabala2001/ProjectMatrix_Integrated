import { previewStorage } from "../integration/previewStorage";
import { assertOperationalAction } from "../integration/operationalAccess";
/**
 * Project Matrix - Universal CRUD Persistence Adapter
 * 
 * Provides an offline-first, resilient dual-layer data persistence engine:
 * 1. Synchronizes directly with Supabase when available.
 * 2. Seamlessly falls back to structured, tenant-isolated previewStorage cache.
 * 3. Prevents silent UI failures, unhandled auth drops, or network blocks from 
 *    breaking Create, Read, Update, and Delete operations across Project Matrix.
 */

import { supabase, isApiKeyError } from "../lib/supabase";

export interface CrudOptions {
  tableName: string;
  companyId?: string;
  projectId?: string;
  storageKey?: string;
  idField?: string;
  orderByField?: string;
  orderAscending?: boolean;
}

export function getStorageKey(options: CrudOptions): string {
  if (options.storageKey) return options.storageKey;
  const parts = ["pm_data", options.tableName];
  if (options.companyId) parts.push(options.companyId);
  if (options.projectId) parts.push(options.projectId);
  return parts.join("_");
}

export class CrudAdapter {
  /**
   * Load records from Supabase with automatic fallback to previewStorage cache
   */
  static async getRecords<T extends Record<string, any>>(options: CrudOptions): Promise<T[]> {
    const key = getStorageKey(options);
    let localRecords: T[] = [];

    // Read local cache first
    try {
      const cached = previewStorage.getItem(key);
      if (cached) {
        localRecords = JSON.parse(cached);
      }
    } catch (e) {
      console.warn(`Could not read local cache for ${key}:`, e);
    }

    try {
      let query = supabase.from(options.tableName).select("*");
      
      if (options.companyId) {
        query = query.eq("company_id", options.companyId);
      }
      if (options.projectId) {
        query = query.eq("project_id", options.projectId);
      }
      
      const orderField = options.orderByField || "created_at";
      query = query.order(orderField, { ascending: options.orderAscending ?? false });

      const { data, error } = await query;

      if (!error && data && Array.isArray(data)) {
        // Merge Supabase records with local records to ensure newly created items exist
        const idField = options.idField || "id";
        const dbMap = new Map<string, T>();
        
        // Populate with db data
        data.forEach((item: any) => {
          if (item[idField]) {
            dbMap.set(item[idField], item as T);
          }
        });

        // Merge any local-only records not yet in db
        localRecords.forEach((localItem: any) => {
          if (localItem[idField] && !dbMap.has(localItem[idField])) {
            dbMap.set(localItem[idField], localItem);
          }
        });

        const merged = Array.from(dbMap.values());
        // Update local cache with latest merged state
        try {
          previewStorage.setItem(key, JSON.stringify(merged));
        } catch (e) {}

        return merged;
      }
    } catch (err) {
      if (!isApiKeyError(err)) {
        console.warn(`Supabase fetch failed for ${options.tableName}, using local fallback:`, err);
      }
    }

    return localRecords;
  }

  /**
   * Create or Update a record: dual-writes to previewStorage and Supabase
   */
  static async saveRecord<T extends Record<string, any>>(
    options: CrudOptions,
    record: T
  ): Promise<T> {
    assertOperationalAction("write", "services/crudAdapter.ts");
    const key = getStorageKey(options);
    const idField = options.idField || "id";
    const recordId = record[idField];

    if (!recordId) {
      throw new Error(`Cannot save record to ${options.tableName}: missing ID field (${idField})`);
    }

    // 1. Immediately update local storage cache for instant UI feedback
    try {
      const cached = previewStorage.getItem(key);
      let list: T[] = cached ? JSON.parse(cached) : [];
      const existingIdx = list.findIndex((item: any) => item[idField] === recordId);
      
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...record, updated_at: new Date().toISOString() };
      } else {
        const withTimestamps = {
          ...record,
          created_at: record.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        list = [withTimestamps, ...list];
      }

      previewStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      console.warn(`Local cache save error for ${key}:`, e);
    }

    // 2. Synchronize to Supabase
    try {
      const sanitizedPayload = { ...record };
      // Remove client-only metadata fields (starting with underscore)
      Object.keys(sanitizedPayload).forEach((k) => {
        if (k.startsWith("_")) {
          delete (sanitizedPayload as any)[k];
        }
      });

      const { data, error } = await supabase
        .from(options.tableName)
        .upsert(sanitizedPayload, { onConflict: idField })
        .select()
        .maybeSingle();

      if (error) {
        console.warn(`Supabase upsert warning on ${options.tableName}:`, error.message);
      } else if (data) {
        return { ...record, ...data };
      }
    } catch (err) {
      console.warn(`Supabase sync caught error on ${options.tableName}:`, err);
    }

    return record;
  }

  /**
   * Delete a record: removes from previewStorage and Supabase
   */
  static async deleteRecord(options: CrudOptions, recordId: string): Promise<boolean> {
    assertOperationalAction("delete", "services/crudAdapter.ts");
    const key = getStorageKey(options);
    const idField = options.idField || "id";

    // 1. Immediately delete from local cache
    try {
      const cached = previewStorage.getItem(key);
      if (cached) {
        const list: any[] = JSON.parse(cached);
        const filtered = list.filter((item: any) => item[idField] !== recordId);
        previewStorage.setItem(key, JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn(`Local cache delete error for ${key}:`, e);
    }

    // 2. Delete from Supabase
    try {
      const { error } = await supabase
        .from(options.tableName)
        .delete()
        .eq(idField, recordId);

      if (error) {
        console.warn(`Supabase delete warning on ${options.tableName}:`, error.message);
      }
    } catch (err) {
      console.warn(`Supabase delete caught error on ${options.tableName}:`, err);
    }

    return true;
  }
}
