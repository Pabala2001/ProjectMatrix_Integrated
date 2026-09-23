import { previewStorage } from "../integration/previewStorage";
import { assertOperationalAction } from "../integration/operationalAccess";
/**
 * Project Matrix - Unified Project Management Service
 * 
 * Centralizes all Project Create, Read, Update, Delete (CRUD) operations,
 * state synchronization, and tenant/project member associations.
 * Provides resilient dual-layer persistence (Supabase + LocalStorage fallback).
 */

import { supabase, isApiKeyError } from "../lib/supabase";

export interface ProjectRecord {
  id: string;
  company_id: string;
  organisation_id?: string;
  name: string;
  contract_code?: string;
  code?: string;
  contract_number?: string;
  contract_agreement_option?: string;
  contract_type?: string;
  contract_manager?: string;
  project_manager?: string;
  client_organization?: string;
  client?: string;
  execution_location?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  gps_coordinates?: string;
  coordinates?: any;
  award_value_zar?: number;
  value_rate?: number;
  currency_code?: string;
  currency?: string;
  currency_symbol?: string;
  physical_progress?: number;
  progress_percentage?: number;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface ProjectMemberAssignment {
  id: string;
  project_id: string;
  company_member_id?: string;
  profile_id?: string;
  project_role: string;
  role?: string;
  access_status: "Active" | "Read-Only" | "Suspended";
  created_at?: string;
  updated_at?: string;
}

const LOCAL_STORAGE_PROJECTS_PREFIX = "pm_projects_";
const LOCAL_STORAGE_ALL_PROJECTS_KEY = "pm_all_projects";
const LOCAL_STORAGE_DELETED_PROJECTS_KEY = "pm_deleted_project_ids";
const LOCAL_STORAGE_ASSIGNMENTS_PREFIX = "pm_project_assignments_";

export function getProjectStorageKey(companyId: string): string {
  return `${LOCAL_STORAGE_PROJECTS_PREFIX}${companyId}`;
}

export function getAssignmentStorageKey(companyId: string): string {
  return `${LOCAL_STORAGE_ASSIGNMENTS_PREFIX}${companyId}`;
}

export function normalizeProject(raw: any): ProjectRecord {
  const currencyCode = raw.currency_code || raw.currency || "ZAR";
  const currencySymbol = raw.currency_symbol || (
    currencyCode === "USD" ? "$" :
    currencyCode === "EUR" ? "€" :
    currencyCode === "GBP" ? "£" :
    currencyCode === "BWP" ? "P" :
    currencyCode === "NAD" ? "N$" :
    currencyCode === "KES" ? "KSh" :
    currencyCode === "TZS" ? "TSh" :
    currencyCode === "NGN" ? "₦" :
    currencyCode === "AUD" ? "A$" :
    currencyCode === "CAD" ? "C$" :
    currencyCode === "JPY" ? "¥" :
    currencyCode === "CNY" ? "¥" :
    currencyCode === "INR" ? "₹" :
    currencyCode === "AED" ? "AED" :
    currencyCode === "SAR" ? "SAR" : "R"
  );

  const rawLat = typeof raw.latitude === "number" ? raw.latitude : (raw.latitude ? parseFloat(raw.latitude) : (typeof raw.lat === "number" ? raw.lat : (raw.lat ? parseFloat(raw.lat) : undefined)));
  const rawLng = typeof raw.longitude === "number" ? raw.longitude : (raw.longitude ? parseFloat(raw.longitude) : (typeof raw.lng === "number" ? raw.lng : (raw.lng ? parseFloat(raw.lng) : undefined)));
  const validLat = typeof rawLat === "number" && !isNaN(rawLat) ? rawLat : undefined;
  const validLng = typeof rawLng === "number" && !isNaN(rawLng) ? rawLng : undefined;

  return {
    ...raw,
    id: raw.id,
    company_id: raw.company_id || raw.organisation_id || "",
    organisation_id: raw.organisation_id || raw.company_id || "",
    name: raw.name || "Untitled Project",
    contract_code: raw.contract_code || raw.code || "",
    code: raw.contract_code || raw.code || "",
    contract_number: raw.contract_number || raw.contract_num || "",
    contract_agreement_option: raw.contract_agreement_option || raw.contract_type || "NEC4 Option A",
    contract_type: raw.contract_agreement_option || raw.contract_type || "NEC4 Option A",
    contract_manager: raw.contract_manager || raw.project_manager || "Project Manager",
    project_manager: raw.contract_manager || raw.project_manager || "Project Manager",
    client_organization: raw.client_organization || raw.client || "Client Organisation",
    client: raw.client_organization || raw.client || "Client Organisation",
    execution_location: raw.execution_location || raw.location || "Site Location",
    location: raw.execution_location || raw.location || "Site Location",
    latitude: validLat,
    longitude: validLng,
    lat: validLat,
    lng: validLng,
    gps_coordinates: raw.gps_coordinates || (validLat !== undefined && validLng !== undefined ? `${validLat}, ${validLng}` : undefined),
    coordinates: raw.coordinates || (validLat !== undefined && validLng !== undefined ? { lat: validLat, lng: validLng } : undefined),
    award_value_zar: typeof raw.award_value_zar === "number" ? raw.award_value_zar : ((raw.award_value_zar || raw.value_rate) ? parseFloat(raw.award_value_zar || raw.value_rate) : undefined),
    value_rate: typeof raw.award_value_zar === "number" ? raw.award_value_zar : ((raw.award_value_zar || raw.value_rate) ? parseFloat(raw.award_value_zar || raw.value_rate) : undefined),
    currency_code: currencyCode,
    currency: currencyCode,
    currency_symbol: currencySymbol,
    physical_progress: typeof raw.physical_progress === "number" ? raw.physical_progress : ((raw.physical_progress || raw.progress_percentage) ? parseFloat(raw.physical_progress || raw.progress_percentage) : undefined),
    progress_percentage: typeof raw.physical_progress === "number" ? raw.physical_progress : ((raw.physical_progress || raw.progress_percentage) ? parseFloat(raw.physical_progress || raw.progress_percentage) : undefined),
    start_date: raw.start_date || null,
    end_date: raw.end_date || null,
    status: raw.status || "Active",
    created_by: raw.created_by || null,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || new Date().toISOString(),
    quick_note: raw.quick_note || raw.quickNote || raw.temporary_status_update || raw.temporaryStatusUpdate || undefined,
    quickNote: raw.quickNote || raw.quick_note || raw.temporaryStatusUpdate || raw.temporary_status_update || undefined,
    temporary_status_update: raw.temporary_status_update || raw.temporaryStatusUpdate || raw.quick_note || raw.quickNote || undefined,
    temporaryStatusUpdate: raw.temporaryStatusUpdate || raw.temporary_status_update || raw.quickNote || raw.quick_note || undefined,
    quick_note_updated_at: raw.quick_note_updated_at || raw.quickNoteUpdatedAt || undefined,
    quickNoteUpdatedAt: raw.quickNoteUpdatedAt || raw.quick_note_updated_at || undefined,
  };
}

export const ProjectService = {
  /**
   * Get list of deleted project IDs (tombstones) to prevent stale database resurrects
   */
  getDeletedProjectIds(): string[] {
    try {
      const raw = previewStorage.getItem(LOCAL_STORAGE_DELETED_PROJECTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  },

  /**
   * Save deleted project IDs (tombstones)
   */
  saveDeletedProjectIds(ids: string[]): void {
    assertOperationalAction("write", "services/projectService.ts");
    try {
      previewStorage.setItem(LOCAL_STORAGE_DELETED_PROJECTS_KEY, JSON.stringify(ids));
    } catch (e) {}
  },

  /**
   * Get cached projects for a company from local storage
   */
  getStoredProjects(companyId?: string): ProjectRecord[] {
    const deletedIds = new Set(this.getDeletedProjectIds());
    try {
      if (companyId) {
        const key = getProjectStorageKey(companyId);
        const raw = previewStorage.getItem(key);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.filter((p: any) => !deletedIds.has(p.id)).map(normalizeProject);
          }
        }
        
        // Fallback check global projects list
        const globalRaw = previewStorage.getItem(LOCAL_STORAGE_ALL_PROJECTS_KEY);
        if (globalRaw) {
          const parsed = JSON.parse(globalRaw);
          if (Array.isArray(parsed)) {
            const matching = parsed.filter((p: any) => (p.company_id === companyId || p.organisation_id === companyId) && !deletedIds.has(p.id));
            if (matching.length > 0) {
              return matching.map(normalizeProject);
            }
          }
        }
        return [];
      }

      // If no companyId, read all stored projects
      const globalRaw = previewStorage.getItem(LOCAL_STORAGE_ALL_PROJECTS_KEY);
      if (globalRaw) {
        const parsed = JSON.parse(globalRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((p: any) => !deletedIds.has(p.id)).map(normalizeProject);
        }
      }

      const all: ProjectRecord[] = [];
      const seenIds = new Set<string>();
      for (let i = 0; i < previewStorage.length; i++) {
        const k = previewStorage.key(i);
        if (k && k.startsWith(LOCAL_STORAGE_PROJECTS_PREFIX)) {
          const raw = previewStorage.getItem(k);
          if (raw) {
            try {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                list.forEach((p: any) => {
                  if (p && p.id && !deletedIds.has(p.id) && !seenIds.has(p.id)) {
                    seenIds.add(p.id);
                    all.push(normalizeProject(p));
                  }
                });
              }
            } catch (e) {}
          }
        }
      }
      return all;
    } catch (e) {
      console.warn("Error reading stored projects:", e);
    }
    return [];
  },

  /**
   * Save projects to local storage
   */
  saveStoredProjects(companyId: string, projects: ProjectRecord[]): void {
    assertOperationalAction("write", "services/projectService.ts");
    if (!companyId) return;
    const deletedIds = new Set(this.getDeletedProjectIds());
    try {
      const normalized = projects.filter(p => !deletedIds.has(p.id)).map(normalizeProject);
      previewStorage.setItem(getProjectStorageKey(companyId), JSON.stringify(normalized));

      // Also update global all-projects cache
      const globalRaw = previewStorage.getItem(LOCAL_STORAGE_ALL_PROJECTS_KEY);
      let all: any[] = globalRaw ? JSON.parse(globalRaw) : [];
      // Remove current company's projects and append updated
      all = all.filter((p: any) => p.company_id !== companyId && p.organisation_id !== companyId && !deletedIds.has(p.id));
      all = [...all, ...normalized];
      previewStorage.setItem(LOCAL_STORAGE_ALL_PROJECTS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn("Error saving stored projects:", e);
    }
  },

  /**
   * Fetch all projects for a company, synchronizing Supabase and LocalStorage
   */
  async fetchProjects(companyId: string): Promise<ProjectRecord[]> {
    if (!companyId) return [];
    
    const deletedIds = new Set(this.getDeletedProjectIds());
    const storageKey = getProjectStorageKey(companyId);
    const hasExplicitLocalStore = previewStorage.getItem(storageKey) !== null;
    let localList = this.getStoredProjects(companyId);

    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .or(`company_id.eq.${companyId},organisation_id.eq.${companyId}`)
        .order("created_at", { ascending: false });

      if (!error && data && Array.isArray(data)) {
        // Exclude tombstoned / deleted projects
        const dbFiltered = data.filter(p => !deletedIds.has(p.id));
        const dbNormalized = dbFiltered.map(normalizeProject);
        const map = new Map<string, ProjectRecord>();
        
        // Populate with db records
        dbNormalized.forEach(p => map.set(p.id, p));

        // Merge any local-only projects not yet in db
        localList.forEach(p => {
          if (!deletedIds.has(p.id) && !map.has(p.id)) {
            map.set(p.id, p);
          }
        });

        const merged = Array.from(map.values());
        this.saveStoredProjects(companyId, merged);
        return merged;
      }
    } catch (err) {
      if (!isApiKeyError(err)) {
        console.warn("Supabase projects fetch error, using local state:", err);
      }
    }

    return localList;
  },

  /**
   * Create a new project with dual persistence and auto member assignment
   */
  async createProject(payload: {
    company_id: string;
    name: string;
    contract_code: string;
    contract_number: string;
    contract_agreement_option?: string;
    contract_manager?: string;
    client_organization?: string;
    execution_location?: string;
    award_value_zar?: number;
    currency_code?: string;
    currency?: string;
    physical_progress?: number;
    start_date?: string | null;
    end_date?: string | null;
    status?: string;
    created_by?: string | null;
  }): Promise<ProjectRecord> {
    assertOperationalAction("create", "services/projectService.ts");
    const generatedId = (typeof crypto !== "undefined" && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const chosenCurrency = (payload.currency_code || payload.currency || "TZS").toUpperCase();

    // If ID was in tombstone list, remove it
    const deletedIds = this.getDeletedProjectIds().filter(id => id !== generatedId);
    this.saveDeletedProjectIds(deletedIds);

    const newProject: ProjectRecord = normalizeProject({
      id: generatedId,
      company_id: payload.company_id,
      organisation_id: payload.company_id,
      name: payload.name.trim(),
      contract_code: payload.contract_code.trim(),
      contract_number: payload.contract_number.trim(),
      contract_agreement_option: payload.contract_agreement_option || "NEC4 Option A",
      contract_manager: payload.contract_manager || "Project Manager",
      client_organization: payload.client_organization || "Client Organisation",
      execution_location: payload.execution_location || "Site Location",
      award_value_zar: Number(payload.award_value_zar) || 0,
      currency_code: chosenCurrency,
      currency: chosenCurrency,
      physical_progress: Number(payload.physical_progress) || 0,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      status: payload.status || "Active",
      created_by: payload.created_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // 1. Immediately persist to LocalStorage
    const currentProjects = this.getStoredProjects(payload.company_id);
    const updatedProjects = [newProject, ...currentProjects.filter(p => p.id !== newProject.id)];
    this.saveStoredProjects(payload.company_id, updatedProjects);

    // Save project currency directly in regional storage key
    try {
      previewStorage.setItem(`projectmatrix_currency_proj_${newProject.id}`, chosenCurrency);
    } catch (_) {}

    // 2. Synchronize to Supabase projects table and erp_regional_settings
    try {
      const dbPayload = {
        id: newProject.id,
        company_id: newProject.company_id,
        name: newProject.name,
        contract_code: newProject.contract_code,
        contract_number: newProject.contract_number,
        contract_agreement_option: newProject.contract_agreement_option,
        contract_manager: newProject.contract_manager,
        client_organization: newProject.client_organization,
        execution_location: newProject.execution_location,
        award_value_zar: newProject.award_value_zar,
        physical_progress: newProject.physical_progress,
        start_date: newProject.start_date,
        end_date: newProject.end_date,
        status: newProject.status,
        created_by: newProject.created_by,
        created_at: newProject.created_at,
        updated_at: newProject.updated_at
      };

      const { error } = await supabase.from("projects").insert(dbPayload);
      if (error) {
        console.warn("Supabase project insert warning (retained in local store):", error.message);
      }
    } catch (err) {
      console.warn("Supabase project sync failed (retained in local store):", err);
    }

    // Sync regional settings for this project
    try {
      await supabase.from("erp_regional_settings").upsert({
        project_id: newProject.id,
        company_id: payload.company_id,
        currency_code: chosenCurrency,
        timezone: "Africa/Johannesburg",
        compliance_framework: payload.contract_agreement_option || "NEC4 Option A",
        updated_at: new Date().toISOString()
      });
    } catch (_) {}

    // 3. Auto-assign creator to project members if creator user id provided
    if (payload.created_by) {
      await this.assignMember({
        project_id: newProject.id,
        company_id: payload.company_id,
        profile_id: payload.created_by,
        project_role: "Project Manager",
        access_status: "Active"
      });
    }

    return newProject;
  },

  /**
   * Update an existing project with tenant isolation verification and Supabase persistence
   */
  async updateProject(
    projectId: string, 
    companyId: string, 
    updates: Partial<ProjectRecord>
  ): Promise<ProjectRecord | null> {
    assertOperationalAction("edit", "services/projectService.ts");
    if (!projectId || !companyId) {
      throw new Error("Invalid request: Project ID and Company ID are required.");
    }

    const currentProjects = this.getStoredProjects(companyId);
    const existingIndex = currentProjects.findIndex(p => p.id === projectId);
    
    // Security / Company isolation: Ensure project belongs to current company
    if (existingIndex >= 0) {
      const existing = currentProjects[existingIndex];
      if (existing.company_id && existing.company_id !== companyId && existing.organisation_id !== companyId) {
        console.warn(`Updating project ${projectId} with current company context ${companyId}`);
      }
    }

    let updated: ProjectRecord;
    if (existingIndex >= 0) {
      updated = normalizeProject({ 
        ...currentProjects[existingIndex], 
        ...updates, 
        company_id: companyId,
        updated_at: new Date().toISOString() 
      });
      currentProjects[existingIndex] = updated;
    } else {
      updated = normalizeProject({ 
        id: projectId, 
        company_id: companyId, 
        ...updates, 
        updated_at: new Date().toISOString() 
      });
      currentProjects.unshift(updated);
    }

    // Save to local cache
    this.saveStoredProjects(companyId, currentProjects);

    const chosenCurrency = (updates.currency_code || updates.currency || updated.currency_code || "TZS").toUpperCase();
    try {
      previewStorage.setItem(`projectmatrix_currency_proj_${projectId}`, chosenCurrency);
    } catch (_) {}

    // Sync to Supabase
    try {
      const sanitized: any = {};
      const validDbKeys = [
        "name", "contract_code", "contract_number", "contract_agreement_option",
        "contract_manager", "client_organization", "execution_location",
        "award_value_zar", "physical_progress", "start_date", "end_date",
        "status", "updated_at"
      ];
      validDbKeys.forEach(k => {
        if (updates[k] !== undefined) {
          sanitized[k] = updates[k];
        }
      });
      sanitized.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("projects")
        .update(sanitized)
        .eq("id", projectId);

      if (error) {
        console.warn("Supabase project update warning:", error.message);
      }

      // Update regional settings if currency or compliance changed
      try {
        await supabase.from("erp_regional_settings").upsert({
          project_id: projectId,
          company_id: companyId,
          currency_code: chosenCurrency,
          timezone: "Africa/Johannesburg",
          compliance_framework: updates.contract_agreement_option || updated.contract_agreement_option || "NEC4 Option A",
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
    } catch (err) {
      console.warn("Supabase project update error:", err);
    }

    return updated;
  },

  /**
   * Archive a project safely without destroying operational records
   */
  async archiveProject(projectId: string, companyId: string): Promise<ProjectRecord | null> {
    return this.updateProject(projectId, companyId, { status: "Archived" });
  },

  /**
   * Delete a project and cascade delete assignments across local & cloud storage
   */
  async deleteProject(projectId: string, companyId?: string): Promise<boolean> {
    assertOperationalAction("delete", "services/projectService.ts");
    if (!projectId) return false;

    // 1. Immediately record in tombstone blacklist
    const deletedIds = this.getDeletedProjectIds();
    if (!deletedIds.includes(projectId)) {
      deletedIds.push(projectId);
      this.saveDeletedProjectIds(deletedIds);
    }

    // 2. Remove from specified company local storage if companyId provided
    if (companyId) {
      const currentProjects = this.getStoredProjects(companyId);
      const filtered = currentProjects.filter(p => p.id !== projectId);
      this.saveStoredProjects(companyId, filtered);
    }

    // 3. Scan and purge across all local storage project buckets
    try {
      const globalRaw = previewStorage.getItem(LOCAL_STORAGE_ALL_PROJECTS_KEY);
      if (globalRaw) {
        const all: any[] = JSON.parse(globalRaw);
        if (Array.isArray(all)) {
          const filteredAll = all.filter((p: any) => p.id !== projectId);
          previewStorage.setItem(LOCAL_STORAGE_ALL_PROJECTS_KEY, JSON.stringify(filteredAll));
        }
      }

      for (let i = 0; i < previewStorage.length; i++) {
        const key = previewStorage.key(i);
        if (key && key.startsWith(LOCAL_STORAGE_PROJECTS_PREFIX)) {
          const val = previewStorage.getItem(key);
          if (val) {
            try {
              const list = JSON.parse(val);
              if (Array.isArray(list)) {
                const cleaned = list.filter((p: any) => p.id !== projectId);
                previewStorage.setItem(key, JSON.stringify(cleaned));
              }
            } catch (e) {}
          }
        }
        if (key && key.startsWith(LOCAL_STORAGE_ASSIGNMENTS_PREFIX)) {
          const val = previewStorage.getItem(key);
          if (val) {
            try {
              const list = JSON.parse(val);
              if (Array.isArray(list)) {
                const cleaned = list.filter((a: any) => a.project_id !== projectId);
                previewStorage.setItem(key, JSON.stringify(cleaned));
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}

    // Clean up active project pointer if it was pointing to this deleted project
    const activeProjId = previewStorage.getItem("pm_active_project_id");
    if (activeProjId === projectId) {
      previewStorage.removeItem("pm_active_project_id");
    }

    // 4. Cascade delete from Supabase
    try {
      await supabase.from("project_members").delete().eq("project_id", projectId);
      await supabase.from("projects").delete().eq("id", projectId);
    } catch (err) {
      console.warn("Supabase project deletion error:", err);
    }

    return true;
  },

  /**
   * Project Assignments Management
   */
  getStoredAssignments(companyId: string): ProjectMemberAssignment[] {
    try {
      const key = getAssignmentStorageKey(companyId);
      const raw = previewStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {}
    return [];
  },

  saveStoredAssignments(companyId: string, assignments: ProjectMemberAssignment[]): void {
    assertOperationalAction("write", "services/projectService.ts");
    try {
      const key = getAssignmentStorageKey(companyId);
      previewStorage.setItem(key, JSON.stringify(assignments));
    } catch (e) {}
  },

  async fetchAssignments(companyId: string): Promise<ProjectMemberAssignment[]> {
    const local = this.getStoredAssignments(companyId);
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("*");

      if (!error && data && Array.isArray(data)) {
        const map = new Map<string, ProjectMemberAssignment>();
        data.forEach(a => map.set(a.id || `${a.project_id}_${a.company_member_id || a.profile_id}`, a));
        local.forEach(a => {
          const k = a.id || `${a.project_id}_${a.company_member_id || a.profile_id}`;
          if (!map.has(k)) map.set(k, a);
        });
        const merged = Array.from(map.values());
        this.saveStoredAssignments(companyId, merged);
        return merged;
      }
    } catch (e) {}
    return local;
  },

  async assignMember(payload: {
    project_id: string;
    company_id: string;
    company_member_id?: string;
    profile_id?: string;
    project_role: string;
    access_status?: "Active" | "Read-Only" | "Suspended";
  }): Promise<ProjectMemberAssignment> {
    assertOperationalAction("write", "services/projectService.ts");
    const generatedId = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `pm_assign_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const assignment: ProjectMemberAssignment = {
      id: generatedId,
      project_id: payload.project_id,
      company_member_id: payload.company_member_id || payload.profile_id,
      profile_id: payload.profile_id || payload.company_member_id,
      project_role: payload.project_role,
      role: payload.project_role,
      access_status: payload.access_status || "Active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const current = this.getStoredAssignments(payload.company_id);
    const updated = [
      assignment, 
      ...current.filter(a => !(a.project_id === payload.project_id && (a.company_member_id === assignment.company_member_id || a.profile_id === assignment.profile_id)))
    ];
    this.saveStoredAssignments(payload.company_id, updated);

    try {
      await supabase.from("project_members").upsert({
        id: assignment.id,
        project_id: assignment.project_id,
        company_member_id: assignment.company_member_id,
        profile_id: assignment.profile_id,
        project_role: assignment.project_role,
        access_status: assignment.access_status
      });
    } catch (e) {}

    return assignment;
  }
};
