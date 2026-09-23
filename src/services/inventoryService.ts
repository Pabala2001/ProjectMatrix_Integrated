import { assertOperationalAction } from "../integration/operationalAccess";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase';
import {
  ProjectInventoryItem,
  CreateCompanyStockInput,
  UpdateInventoryItemInput,
  InventoryCategory,
} from '../types/inventory';

export function isInventoryCategory(value: unknown): value is InventoryCategory {
  return (
    value === 'OHS' ||
    value === 'Site Establishment' ||
    value === 'Operational Costs' ||
    value === 'Environmental'
  );
}

export function isValidQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

interface InventoryUpdatePayload {
  category?: InventoryCategory;
  subcategory?: string | null;
  item_name?: string;
  quantity?: number;
  description?: string | null;
  updated_by?: string;
  updated_at?: string;
}

/**
 * Fetch all non-deleted inventory items for a specific company and project.
 * Automatically resolves `logged_by` user UUIDs to display names via `public.profiles`.
 */
export async function getProjectInventoryItems(
  companyId: string,
  projectId: string
): Promise<ProjectInventoryItem[]> {
  if (!companyId || !projectId) {
    return [];
  }

  const { data, error } = await supabase
    .from('project_inventory_items')
    .select('*')
    .eq('company_id', companyId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('logged_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    console.error('Error fetching project inventory items:', error);
    throw new Error(`Failed to load inventory: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Resolve user profile display names for logged_by
  const userIds = Array.from(
    new Set(
      data
        .map((item) => item.logged_by)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );

  const profileNameMap: Record<string, string> = {};

  if (userIds.length > 0) {
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (!profileError && profiles) {
        profiles.forEach((p) => {
          profileNameMap[p.id] = p.full_name || p.email || 'Unknown User';
        });
      }
    } catch (e) {
      console.error('Error resolving profiles for inventory items:', e);
    }
  }

  return data.map((item) => ({
    ...item,
    logged_by_name: item.logged_by ? profileNameMap[item.logged_by] || 'System / Unknown' : 'System / Unknown',
  }));
}

/**
 * Create a company-owned stock inventory item not linked to procurement.
 */
export async function createCompanyStockItem(
  companyId: string,
  projectId: string,
  input: CreateCompanyStockInput
): Promise<ProjectInventoryItem> {
    assertOperationalAction("create", "services/inventoryService.ts");
  if (!companyId || !projectId) {
    throw new Error('Company ID and Project ID are required.');
  }

  if (!isInventoryCategory(input.category)) {
    throw new Error(
      'A valid Procurement category (OHS, Site Establishment, Operational Costs, Environmental) is required.'
    );
  }

  const trimmedName = input.item_name ? input.item_name.trim() : '';
  if (!trimmedName) {
    throw new Error('Item name is required for company stock.');
  }

  if (!isValidQuantity(input.quantity)) {
    throw new Error('Quantity must be greater than zero.');
  }

  const trimmedDesc = input.description ? input.description.trim() : '';
  if (!trimmedDesc) {
    throw new Error('Description is required for company stock.');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    throw new Error('Authentication required.');
  }

  const userId = user.id;
  const nowIso = new Date().toISOString();

  const insertPayload = {
    company_id: companyId,
    project_id: projectId,
    procurement_item_id: null,
    source: 'company_stock' as const,
    category: input.category,
    subcategory: input.subcategory && input.subcategory.trim() ? input.subcategory.trim() : null,
    item_name: trimmedName,
    quantity: input.quantity,
    description: trimmedDesc,
    logged_by: userId,
    logged_at: nowIso,
    updated_by: userId,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .from('project_inventory_items')
    .insert([insertPayload])
    .select('*')
    .single();

  if (error || !data) {
    console.error('Error creating company stock item:', error);
    throw new Error(`Failed to create company stock item: ${error?.message || 'Unknown error'}`);
  }

  let loggedByName = 'System / Unknown';
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      loggedByName = profile.full_name || profile.email || 'Unknown User';
    }
  } catch (e) {
    console.error('Error resolving profile name after insert:', e);
  }

  return {
    ...data,
    logged_by_name: loggedByName,
  };
}

/**
 * Update an existing inventory item.
 * - Procurement-linked items: quantity and description only.
 * - Company-stock items: category, subcategory, item_name, quantity, and description.
 * Source, procurement link, logged_by and logged_at remain strictly read-only.
 */
export async function updateInventoryItem(
  companyId: string,
  projectId: string,
  itemId: string,
  input: UpdateInventoryItemInput
): Promise<ProjectInventoryItem> {
    assertOperationalAction("edit", "services/inventoryService.ts");
  if (!companyId || !projectId || !itemId) {
    throw new Error('Company ID, Project ID, and Item ID are required.');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    throw new Error('Authentication required.');
  }

  const userId = user.id;

  const { data: existingItem, error: fetchError } = await supabase
    .from('project_inventory_items')
    .select('*')
    .eq('id', itemId)
    .eq('company_id', companyId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!existingItem) {
    throw new Error('Inventory item not found, deleted, or inaccessible.');
  }

  const hasOwnInputField = (
    field: keyof UpdateInventoryItemInput
  ): boolean => Object.prototype.hasOwnProperty.call(input, field);

  const editablePayload: InventoryUpdatePayload = {};

  if (existingItem.source === 'procurement') {
    if (hasOwnInputField('quantity')) {
      if (!isValidQuantity(input.quantity)) {
        throw new Error('Quantity must be greater than zero when provided.');
      }
      editablePayload.quantity = input.quantity;
    }

    if (hasOwnInputField('description')) {
      if (input.description === undefined) {
        throw new Error('Invalid description value.');
      }
      if (input.description === null) {
        editablePayload.description = null;
      } else if (typeof input.description === 'string') {
        const trimmedDesc = input.description.trim();
        editablePayload.description = trimmedDesc.length > 0 ? trimmedDesc : null;
      } else {
        throw new Error('Invalid description value.');
      }
    }
  } else {
    // company_stock
    if (hasOwnInputField('category')) {
      if (!isInventoryCategory(input.category)) {
        throw new Error(
          'A valid Procurement category (OHS, Site Establishment, Operational Costs, Environmental) is required.'
        );
      }
      editablePayload.category = input.category;
    }

    if (hasOwnInputField('subcategory')) {
      if (input.subcategory === undefined) {
        throw new Error('Invalid subcategory value.');
      }
      if (input.subcategory === null) {
        editablePayload.subcategory = null;
      } else if (typeof input.subcategory === 'string') {
        const trimmedSub = input.subcategory.trim();
        editablePayload.subcategory = trimmedSub.length > 0 ? trimmedSub : null;
      } else {
        throw new Error('Invalid subcategory value.');
      }
    }

    if (hasOwnInputField('item_name')) {
      if (typeof input.item_name !== 'string') {
        throw new Error('Item name is required for company stock.');
      }
      const trimmedName = input.item_name.trim();
      if (!trimmedName) {
        throw new Error('Item name is required for company stock.');
      }
      editablePayload.item_name = trimmedName;
    }

    if (hasOwnInputField('quantity')) {
      if (!isValidQuantity(input.quantity)) {
        throw new Error('Quantity must be greater than zero for company stock.');
      }
      editablePayload.quantity = input.quantity;
    }

    if (hasOwnInputField('description')) {
      if (typeof input.description !== 'string') {
        throw new Error('Description is required for company stock.');
      }
      const trimmedDesc = input.description.trim();
      if (!trimmedDesc) {
        throw new Error('Description is required for company stock.');
      }
      editablePayload.description = trimmedDesc;
    }
  }

  if (Object.keys(editablePayload).length === 0) {
    throw new Error('No valid inventory fields were supplied for update.');
  }

  editablePayload.updated_by = userId;
  editablePayload.updated_at = new Date().toISOString();

  const { data: updatedData, error: updateError } = await supabase
    .from('project_inventory_items')
    .update(editablePayload)
    .eq('id', itemId)
    .eq('company_id', companyId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();

  if (updateError) {
    console.error('Error updating inventory item:', updateError);
    throw updateError;
  }

  if (!updatedData) {
    throw new Error('No active scoped Inventory item was updated.');
  }

  let loggedByName = 'System / Unknown';
  if (updatedData.logged_by) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', updatedData.logged_by)
        .maybeSingle();

      if (profile) {
        loggedByName = profile.full_name || profile.email || 'Unknown User';
      }
    } catch (e) {
      console.error('Error resolving profile name after update:', e);
    }
  }

  return {
    ...updatedData,
    logged_by_name: loggedByName,
  };
}

/**
 * Soft-delete an inventory item by setting `deleted_at` and `deleted_by`.
 */
export async function softDeleteInventoryItem(
  companyId: string,
  projectId: string,
  itemId: string
): Promise<void> {
  if (!companyId || !projectId || !itemId) {
    throw new Error('Company ID, Project ID, and Item ID are required.');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    throw new Error('Authentication required.');
  }

  const { data, error } = await supabase.rpc('soft_delete_project_inventory_item', {
    p_company_id: companyId,
    p_project_id: projectId,
    p_item_id: itemId,
  });

  if (error) {
    console.error('Error soft-deleting inventory item via RPC:', error);
    throw error;
  }

  if (!data) {
    throw new Error(
      'Inventory item was not found, was already deleted, or is outside the active company and project.'
    );
  }
}
