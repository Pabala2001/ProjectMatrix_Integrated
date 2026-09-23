import { supabase, isApiKeyError } from "../lib/supabase";
import { QualityControlRecord } from "../types/qualityControl";
import { QualityControlStorageHelper } from "./qualityControlStorageHelper";

// Helper to check and generate valid UUIDs
export function ensureUUID(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function dbToRecord(row: any): QualityControlRecord {
  const formData = row.form_data || {};
  return {
    id: row.id,
    templateId: row.template_id || formData.templateId || "",
    formTitle: row.template_name || formData.formTitle || "",
    category: row.category || formData.category || "",
    formReference: formData.formReference || "",
    revision: formData.revision || "",
    revisionDate: formData.revisionDate || "",
    projectName: row.project_name || formData.projectName || "",
    projectNumber: row.project_number || formData.projectNumber || "",
    contractNumber: row.contract_number || formData.contractNumber || "",
    contractor: row.contractor || formData.contractor || "",
    location: row.location || formData.location || "",
    item: row.item || formData.item || "",
    companyName: row.company_name || formData.companyName || "",
    companyLogoBase64: row.company_logo_base64 || formData.companyLogoBase64 || "",
    
    // Company Logo metadata
    companyLogoBucket: row.company_logo_bucket || formData.companyLogoBucket || null,
    companyLogoPath: row.company_logo_path || formData.companyLogoPath || null,
    companyLogoFileName: row.company_logo_file_name || formData.companyLogoFileName || null,
    companyLogoMimeType: row.company_logo_mime_type || formData.companyLogoMimeType || null,
    companyLogoFileSize: row.company_logo_file_size || formData.companyLogoFileSize || null,
    companyLogoUploadedAt: row.company_logo_uploaded_at || formData.companyLogoUploadedAt || null,

    status: (row.status || formData.status || "Draft") as any,
    fields: formData.fields || {},
    checklistRows: formData.checklistRows || [],
    createdAt: row.created_at || formData.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || formData.updatedAt || new Date().toISOString(),
    contractorSignatureName: formData.contractorSignatureName || "",
    residentEngineerSignatureName: formData.residentEngineerSignatureName || "",
    inspectorSignatureName: formData.inspectorSignatureName || "",
    signoffDate: formData.signoffDate || "",

    // Contractor Signature metadata
    contractorSignatureBucket: row.contractor_signature_bucket || formData.contractorSignatureBucket || null,
    contractorSignaturePath: row.contractor_signature_path || formData.contractorSignaturePath || null,
    contractorSignatureFileName: row.contractor_signature_file_name || formData.contractorSignatureFileName || null,
    contractorSignatureMimeType: row.contractor_signature_mime_type || formData.contractorSignatureMimeType || null,
    contractorSignatureFileSize: row.contractor_signature_file_size || formData.contractorSignatureFileSize || null,
    contractorSignatureUploadedAt: row.contractor_signature_uploaded_at || formData.contractorSignatureUploadedAt || null,

    // Resident Engineer Signature metadata
    residentSignatureBucket: row.resident_signature_bucket || formData.residentSignatureBucket || null,
    residentSignaturePath: row.resident_signature_path || formData.residentSignaturePath || null,
    residentSignatureFileName: row.resident_signature_file_name || formData.residentSignatureFileName || null,
    residentSignatureMimeType: row.resident_signature_mime_type || formData.residentSignatureMimeType || null,
    residentSignatureFileSize: row.resident_signature_file_size || formData.residentSignatureFileSize || null,
    residentSignatureUploadedAt: row.resident_signature_uploaded_at || formData.residentSignatureUploadedAt || null,

    // Inspector Signature metadata
    inspectorSignatureBucket: row.inspector_signature_bucket || formData.inspectorSignatureBucket || null,
    inspectorSignaturePath: row.inspector_signature_path || formData.inspectorSignaturePath || null,
    inspectorSignatureFileName: row.inspector_signature_file_name || formData.inspectorSignatureFileName || null,
    inspectorSignatureMimeType: row.inspector_signature_mime_type || formData.inspectorSignatureMimeType || null,
    inspectorSignatureFileSize: row.inspector_signature_file_size || formData.inspectorSignatureFileSize || null,
    inspectorSignatureUploadedAt: row.inspector_signature_uploaded_at || formData.inspectorSignatureUploadedAt || null,

    // DOCX metadata
    docxBucket: row.docx_bucket || formData.docxBucket || null,
    docxPath: row.docx_path || formData.docxPath || null,
    docxFileName: row.docx_file_name || formData.docxFileName || null,
    docxMimeType: row.docx_mime_type || formData.docxMimeType || null,
    docxFileSize: row.docx_file_size || formData.docxFileSize || null,
    docxGeneratedAt: row.docx_generated_at || formData.docxGeneratedAt || null,
  };
}

export function recordToDb(record: QualityControlRecord, projectId?: string, userId?: string) {
  const recordId = ensureUUID(record.id);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  const validProjectId = projectId && uuidRegex.test(projectId) ? projectId : null;
  const validUserId = userId && uuidRegex.test(userId) ? userId : null;

  const form_data = {
    templateId: record.templateId,
    formTitle: record.formTitle,
    category: record.category,
    formReference: record.formReference,
    revision: record.revision,
    revisionDate: record.revisionDate,
    projectName: record.projectName,
    projectNumber: record.projectNumber,
    contractNumber: record.contractNumber,
    contractor: record.contractor,
    location: record.location,
    item: record.item,
    companyName: record.companyName,
    companyLogoBase64: record.companyLogoBase64,
    
    companyLogoBucket: record.companyLogoBucket,
    companyLogoPath: record.companyLogoPath,
    companyLogoFileName: record.companyLogoFileName,
    companyLogoMimeType: record.companyLogoMimeType,
    companyLogoFileSize: record.companyLogoFileSize,
    companyLogoUploadedAt: record.companyLogoUploadedAt,

    status: record.status,
    fields: record.fields,
    checklistRows: record.checklistRows,
    createdAt: record.createdAt,
    updatedAt: new Date().toISOString(),
    contractorSignatureName: record.contractorSignatureName,
    residentEngineerSignatureName: record.residentEngineerSignatureName,
    inspectorSignatureName: record.inspectorSignatureName,
    signoffDate: record.signoffDate,

    contractorSignatureBucket: record.contractorSignatureBucket,
    contractorSignaturePath: record.contractorSignaturePath,
    contractorSignatureFileName: record.contractorSignatureFileName,
    contractorSignatureMimeType: record.contractorSignatureMimeType,
    contractorSignatureFileSize: record.contractorSignatureFileSize,
    contractorSignatureUploadedAt: record.contractorSignatureUploadedAt,

    residentSignatureBucket: record.residentSignatureBucket,
    residentSignaturePath: record.residentSignaturePath,
    residentSignatureFileName: record.residentSignatureFileName,
    residentSignatureMimeType: record.residentSignatureMimeType,
    residentSignatureFileSize: record.residentSignatureFileSize,
    residentSignatureUploadedAt: record.residentSignatureUploadedAt,

    inspectorSignatureBucket: record.inspectorSignatureBucket,
    inspectorSignaturePath: record.inspectorSignaturePath,
    inspectorSignatureFileName: record.inspectorSignatureFileName,
    inspectorSignatureMimeType: record.inspectorSignatureMimeType,
    inspectorSignatureFileSize: record.inspectorSignatureFileSize,
    inspectorSignatureUploadedAt: record.inspectorSignatureUploadedAt,

    docxBucket: record.docxBucket,
    docxPath: record.docxPath,
    docxFileName: record.docxFileName,
    docxMimeType: record.docxMimeType,
    docxFileSize: record.docxFileSize,
    docxGeneratedAt: record.docxGeneratedAt,
  };

  return {
    id: recordId,
    template_id: record.templateId,
    template_name: record.formTitle,
    category: record.category,
    project_id: validProjectId,
    project_name: record.projectName || null,
    project_number: record.projectNumber || null,
    contract_number: record.contractNumber || null,
    contractor: record.contractor || null,
    location: record.location || null,
    item: record.item || null,
    company_name: record.companyName || null,
    company_logo_base64: record.companyLogoBase64 || null,

    company_logo_bucket: record.companyLogoBucket || null,
    company_logo_path: record.companyLogoPath || null,
    company_logo_file_name: record.companyLogoFileName || null,
    company_logo_mime_type: record.companyLogoMimeType || null,
    company_logo_file_size: record.companyLogoFileSize || null,
    company_logo_uploaded_at: record.companyLogoUploadedAt || null,

    contractor_signature_bucket: record.contractorSignatureBucket || null,
    contractor_signature_path: record.contractorSignaturePath || null,
    contractor_signature_file_name: record.contractorSignatureFileName || null,
    contractor_signature_mime_type: record.contractorSignatureMimeType || null,
    contractor_signature_file_size: record.contractorSignatureFileSize || null,
    contractor_signature_uploaded_at: record.contractorSignatureUploadedAt || null,

    resident_signature_bucket: record.residentSignatureBucket || null,
    resident_signature_path: record.residentSignaturePath || null,
    resident_signature_file_name: record.residentSignatureFileName || null,
    resident_signature_mime_type: record.residentSignatureMimeType || null,
    resident_signature_file_size: record.residentSignatureFileSize || null,
    resident_signature_uploaded_at: record.residentSignatureUploadedAt || null,

    inspector_signature_bucket: record.inspectorSignatureBucket || null,
    inspector_signature_path: record.inspectorSignaturePath || null,
    inspector_signature_file_name: record.inspectorSignatureFileName || null,
    inspector_signature_mime_type: record.inspectorSignatureMimeType || null,
    inspector_signature_file_size: record.inspectorSignatureFileSize || null,
    inspector_signature_uploaded_at: record.inspectorSignatureUploadedAt || null,

    docx_bucket: record.docxBucket || null,
    docx_path: record.docxPath || null,
    docx_file_name: record.docxFileName || null,
    docx_mime_type: record.docxMimeType || null,
    docx_file_size: record.docxFileSize || null,
    docx_generated_at: record.docxGeneratedAt || null,

    status: record.status,
    form_data: form_data,
    created_at: record.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: validUserId,
  };
}

export const QualityControlStorage = {
  async getRecords(projectId?: string): Promise<QualityControlRecord[]> {
    const localKey = projectId ? `pm_qc_records_${projectId}` : "pm_qc_records_all";
    let localRecords: QualityControlRecord[] = [];
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) {
        localRecords = JSON.parse(stored);
      }
    } catch (e) {}

    try {
      let query = supabase
        .from("quality_control_records")
        .select("*");

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        if (isApiKeyError(error) || error.code === "42P01") {
          return localRecords;
        }
        return localRecords;
      }

      if (data && Array.isArray(data)) {
        const dbRecords = data.map(dbToRecord);
        const map = new Map<string, QualityControlRecord>();
        dbRecords.forEach(r => map.set(r.id, r));
        localRecords.forEach(r => {
          if (!map.has(r.id)) map.set(r.id, r);
        });
        const merged = Array.from(map.values());
        try {
          localStorage.setItem(localKey, JSON.stringify(merged));
        } catch (e) {}
        return merged;
      }

      return localRecords;
    } catch (err) {
      return localRecords;
    }
  },

  async getRecordById(id: string): Promise<QualityControlRecord | undefined> {
    try {
      const { data, error } = await supabase
        .from("quality_control_records")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        return dbToRecord(data);
      }
    } catch (err) {}

    // Fallback: search across local storage keys
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("pm_qc_records_")) {
          const list: QualityControlRecord[] = JSON.parse(localStorage.getItem(k) || "[]");
          const found = list.find(r => r.id === id);
          if (found) return found;
        }
      }
    } catch (e) {}

    return undefined;
  },

  async saveRecord(record: QualityControlRecord, projectId?: string, userId?: string): Promise<QualityControlRecord> {
    const validProjId = projectId || record.projectId || record.project_id;
    const localKey = validProjId ? `pm_qc_records_${validProjId}` : "pm_qc_records_all";

    // 1. Immediately save to local storage
    try {
      const stored = localStorage.getItem(localKey);
      let list: QualityControlRecord[] = stored ? JSON.parse(stored) : [];
      const idx = list.findIndex(r => r.id === record.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...record, updatedAt: new Date().toISOString() };
      } else {
        list.unshift({ ...record, createdAt: record.createdAt || new Date().toISOString() });
      }
      localStorage.setItem(localKey, JSON.stringify(list));
    } catch (e) {
      console.warn("Could not save to local storage cache:", e);
    }

    const dbRow = recordToDb(record, projectId, userId);
    
    // Self-healing database upsert: if the schema is missing newly added columns, 
    // we prune the missing columns dynamically from the payload and retry.
    let success = false;
    let attempts = 0;
    const maxAttempts = 50;
    const prunedRow = { ...dbRow };

    while (!success && attempts < maxAttempts) {
      attempts++;
      try {
        const { error } = await supabase
          .from("quality_control_records")
          .upsert(prunedRow, { onConflict: "id" });

        if (error) {
          throw error;
        }
        success = true;
      } catch (err: any) {
        // If table doesn't exist or API key error, return the locally saved record
        if (isApiKeyError(err) || err.code === "42P01" || err.message?.includes("does not exist")) {
          return record;
        }
        // If column doesn't exist (Postgres error code 42703)
        if (err.code === "42703" && err.message) {
          const match = err.message.match(/column "([^"]+)"/);
          if (match && match[1]) {
            const missingColumn = match[1];
            delete (prunedRow as any)[missingColumn];
            continue;
          }
        }
        // In case of other errors, we already have local cache
        break;
      }
    }

    return success ? dbToRecord(prunedRow) : record;
  },

  async deleteRecord(id: string): Promise<void> {
    // 1. Delete from all local storage keys
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("pm_qc_records_")) {
          const list: QualityControlRecord[] = JSON.parse(localStorage.getItem(k) || "[]");
          const filtered = list.filter(r => r.id !== id);
          localStorage.setItem(k, JSON.stringify(filtered));
        }
      }
    } catch (e) {}

    // 2. Fetch record first to know file paths
    try {
      const record = await this.getRecordById(id);
      if (record) {
        if (record.companyLogoPath) {
          try {
            await QualityControlStorageHelper.deleteFile(record.companyLogoBucket || "quality-control-assets", record.companyLogoPath);
          } catch (e) {}
        }
        if (record.contractorSignaturePath) {
          try {
            await QualityControlStorageHelper.deleteFile(record.contractorSignatureBucket || "quality-control-assets", record.contractorSignaturePath);
          } catch (e) {}
        }
        if (record.residentSignaturePath) {
          try {
            await QualityControlStorageHelper.deleteFile(record.residentSignatureBucket || "quality-control-assets", record.residentSignaturePath);
          } catch (e) {}
        }
        if (record.inspectorSignaturePath) {
          try {
            await QualityControlStorageHelper.deleteFile(record.inspectorSignatureBucket || "quality-control-assets", record.inspectorSignaturePath);
          } catch (e) {}
        }
        if (record.docxPath) {
          try {
            await QualityControlStorageHelper.deleteFile(record.docxBucket || "quality-control-documents", record.docxPath);
          } catch (e) {}
        }
      }
    } catch (e) {}

    // 3. Delete database record
    try {
      await supabase
        .from("quality_control_records")
        .delete()
        .eq("id", id);
    } catch (e) {}
  },

  async updateDocxMetadata(id: string, metadata: any): Promise<void> {
    try {
      const { error } = await supabase
        .from("quality_control_records")
        .update({
          docx_bucket: metadata.docxBucket,
          docx_path: metadata.docxPath,
          docx_file_name: metadata.docxFileName,
          docx_mime_type: metadata.docxMimeType,
          docx_file_size: metadata.docxFileSize,
          docx_generated_at: metadata.docxGeneratedAt
        })
        .eq("id", id);

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.warn("Direct DOCX column update failed. Falling back to updating form_data JSONB...", err.message || err);
      // Fallback: Fetch existing record, merge new DOCX fields into form_data, and update form_data column directly
      try {
        const record = await this.getRecordById(id);
        if (record) {
          const updatedRecord = {
            ...record,
            docxBucket: metadata.docxBucket,
            docxPath: metadata.docxPath,
            docxFileName: metadata.docxFileName,
            docxMimeType: metadata.docxMimeType,
            docxFileSize: metadata.docxFileSize,
            docxGeneratedAt: metadata.docxGeneratedAt
          };
          const dbRow = recordToDb(updatedRecord);
          
          const { error: fallbackError } = await supabase
            .from("quality_control_records")
            .update({
              form_data: dbRow.form_data
            })
            .eq("id", id);
            
          if (fallbackError) {
            throw fallbackError;
          }
        } else {
          throw err;
        }
      } catch (fallbackErr) {
        console.error("Fallback update also failed:", fallbackErr);
        throw err;
      }
    }
  }
};
