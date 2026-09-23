import { authenticatedFetch } from "../integration/authenticatedFetch";
import { previewStorage } from "../integration/previewStorage";
import { assertOperationalAction } from "../integration/operationalAccess";
import { EngineeringRFI } from "../types/engineering";

const STORAGE_KEY_PREFIX = "pm_engineering_rfis_";

function getLocalCacheKey(projectId?: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId || "global"}`;
}

function getLocalCache(projectId?: string): EngineeringRFI[] {
  try {
    const raw = previewStorage.getItem(getLocalCacheKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Failed to read RFI local cache:", e);
    return [];
  }
}

function setLocalCache(rfis: EngineeringRFI[], projectId?: string): void {
  try {
    previewStorage.setItem(getLocalCacheKey(projectId), JSON.stringify(rfis));
  } catch (e) {
    console.warn("Failed to write RFI local cache:", e);
  }
}

export const EngineeringRfiService = {
  /**
   * Fetch RFIs for a project from the backend API.
   * Uses local cache for immediate paint and falls back to local cache if offline.
   */
  async getRFIs(projectId?: string, companyId?: string): Promise<EngineeringRFI[]> {
    const params = new URLSearchParams();
    if (projectId) params.append("projectId", projectId);
    if (companyId) params.append("companyId", companyId);

    const url = `/api/engineering/rfis${params.toString() ? `?${params.toString()}` : ""}`;

    try {
      const res = await authenticatedFetch(url, {
        headers: {
          "Accept": "application/json"
        }
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json && json.success && Array.isArray(json.data)) {
        const records: EngineeringRFI[] = json.data;
        // Update local cache
        setLocalCache(records, projectId);
        return records;
      }
      throw new Error(json?.error || "Invalid response format from server");
    } catch (err) {
      console.warn("API call to /api/engineering/rfis failed, reading local cache:", err);
      return getLocalCache(projectId);
    }
  },

  /**
   * Fetch a single RFI by ID from the backend API.
   */
  async getRFIById(id: string): Promise<EngineeringRFI | null> {
    try {
      const res = await authenticatedFetch(`/api/engineering/rfis/${encodeURIComponent(id)}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const json = await res.json();
      return json.success ? (json.data as EngineeringRFI) : null;
    } catch (err) {
      console.error(`Failed to fetch RFI ${id}:`, err);
      // Try local cache search
      const allLocal = getLocalCache();
      return allLocal.find((r) => r.id === id) || null;
    }
  },

  /**
   * Persist a new Technical Query / RFI to the real backend database.
   * Throws an error on failure to ensure UI handles it cleanly.
   */
  async createRFI(
    rfiData: Partial<EngineeringRFI>,
    projectId?: string,
    companyId?: string
  ): Promise<EngineeringRFI> {
    assertOperationalAction("create", "services/engineeringRfiService.ts");
    const payload: Partial<EngineeringRFI> = {
      ...rfiData,
      projectId: projectId || rfiData.projectId,
      companyId: companyId || rfiData.companyId
    };

    const res = await authenticatedFetch("/api/engineering/rfis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errorJson = await res.json();
        errMsg = errorJson.error || errMsg;
      } catch {}
      throw new Error(`Failed to save Technical Query / RFI: ${errMsg}`);
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.error || "Failed to save Technical Query / RFI");
    }

    const savedRecord: EngineeringRFI = json.data;

    // Update local cache
    const current = getLocalCache(projectId);
    setLocalCache([savedRecord, ...current.filter((r) => r.id !== savedRecord.id)], projectId);

    return savedRecord;
  },

  /**
   * Update an existing Technical Query / RFI in the real backend database.
   * Updates in-place without creating duplicate records.
   */
  async updateRFI(rfi: EngineeringRFI, projectId?: string): Promise<EngineeringRFI> {
    assertOperationalAction("edit", "services/engineeringRfiService.ts");
    const res = await authenticatedFetch(`/api/engineering/rfis/${encodeURIComponent(rfi.id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(rfi)
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errorJson = await res.json();
        errMsg = errorJson.error || errMsg;
      } catch {}
      throw new Error(`Failed to update Technical Query / RFI: ${errMsg}`);
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.error || "Failed to update Technical Query / RFI");
    }

    const updatedRecord: EngineeringRFI = json.data;

    // Update local cache
    const current = getLocalCache(projectId || rfi.projectId);
    const updatedList = current.map((item) => (item.id === updatedRecord.id ? updatedRecord : item));
    setLocalCache(updatedList, projectId || rfi.projectId);

    return updatedRecord;
  },

  /**
   * Permanently delete an RFI from the backend database.
   */
  async deleteRFI(id: string, projectId?: string): Promise<void> {
    assertOperationalAction("delete", "services/engineeringRfiService.ts");
    const res = await authenticatedFetch(`/api/engineering/rfis/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errorJson = await res.json();
        errMsg = errorJson.error || errMsg;
      } catch {}
      throw new Error(`Failed to delete Technical Query / RFI: ${errMsg}`);
    }

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Failed to delete Technical Query / RFI");
    }

    // Remove from local cache
    const current = getLocalCache(projectId);
    setLocalCache(current.filter((item) => item.id !== id), projectId);
  }
};
