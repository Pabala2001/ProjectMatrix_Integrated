import { assertOperationalAction } from "../integration/operationalAccess";
import { supabase } from "../lib/supabase";

export const ACCOUNTS_BUCKET_NAME = "accounts-documents";
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/png",
  "image/jpeg",
];

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
];

export interface AccountAttachment {
  id: string;
  company_id: string;
  project_id?: string | null;
  record_type: string;
  record_id: string;
  document_type: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  description?: string | null;
  uploaded_by?: string | null;
  uploaded_at: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface UploadAttachmentParams {
  companyId: string;
  projectId?: string | null;
  recordType: string;
  recordId: string;
  documentType?: string;
  description?: string;
  file: File | Blob;
  originalFilename?: string;
  onProgress?: (progressPercent: number) => void;
}

export interface AttachmentFilters {
  recordType?: string;
  recordId?: string;
  projectId?: string;
  documentType?: string;
  includeArchived?: boolean;
}

/**
 * Maps extension / raw mime type to exact allowed SQL MIME type constraint.
 */
export function normalizeMimeType(fileType: string, filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  
  if (ext === ".pdf" || fileType.includes("pdf")) return "application/pdf";
  if (ext === ".doc" || fileType.includes("msword")) return "application/msword";
  if (ext === ".docx" || fileType.includes("wordprocessingml")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === ".xls" || fileType.includes("ms-excel")) return "application/vnd.ms-excel";
  if (ext === ".xlsx" || fileType.includes("spreadsheetml")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (ext === ".csv" || fileType.includes("csv")) return "text/csv";
  if (ext === ".png" || fileType.includes("png")) return "image/png";
  if (ext === ".jpg" || ext === ".jpeg" || fileType.includes("jpeg") || fileType.includes("jpg")) {
    return "image/jpeg";
  }

  return fileType || "application/pdf";
}

/**
 * Validates file size, format, and extension before uploading.
 */
export function validateAttachmentFile(file: File | Blob, filename?: string): { valid: boolean; error?: string } {
  const size = file.size;
  if (size <= 0) {
    return { valid: false, error: "File is empty (0 bytes)." };
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed limit of 20MB (${(size / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  const name = filename || (file as File).name || "";
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();

  const isAllowedExt = ext ? ALLOWED_EXTENSIONS.includes(ext) : false;
  const isAllowedMime = file.type ? ALLOWED_FILE_TYPES.includes(file.type) || file.type === "image/jpg" : false;

  if (!isAllowedExt && !isAllowedMime) {
    return {
      valid: false,
      error: `Unsupported file format '${ext || file.type}'. Allowed formats: PDF, DOC, DOCX, XLS, XLSX, CSV, PNG, JPG, JPEG.`,
    };
  }

  return { valid: true };
}

/**
 * Sanitizes record_type and document_type to comply with SQL regex ^[a-z][a-z0-9_]{0,79}$
 */
export function sanitizeTypeKey(key: string, defaultKey: string): string {
  if (!key) return defaultKey;
  const sanitized = key.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_").replace(/^[^a-z]+/, "");
  return sanitized.length > 0 ? sanitized.slice(0, 80) : defaultKey;
}

/**
 * Uploads a file to Supabase Storage 'accounts-documents' bucket
 * and registers metadata row in 'accounts_attachments'.
 * Rollback occurs if metadata insert fails.
 */
export async function uploadAccountAttachment(params: UploadAttachmentParams): Promise<AccountAttachment> {
    assertOperationalAction("write", "services/accountsAttachmentsService.ts");
  const {
    companyId,
    projectId,
    recordType: rawRecordType,
    recordId: rawRecordId,
    documentType: rawDocumentType = "general",
    description = "",
    file,
    originalFilename,
    onProgress,
  } = params;

  if (!companyId || !companyId.trim()) {
    throw new Error("Active Company ID is required for attachment upload.");
  }

  const recordType = sanitizeTypeKey(rawRecordType, "general");
  const recordId = rawRecordId ? rawRecordId.trim() : "";
  const documentType = sanitizeTypeKey(rawDocumentType, "general");

  if (!recordType || !recordId) {
    throw new Error("Record type and a valid Record ID are required for file upload.");
  }

  const filename = originalFilename || (file as File).name || `document_${Date.now()}`;

  // Validate file
  const validation = validateAttachmentFile(file, filename);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const mimeType = normalizeMimeType(file.type, filename);

  // Sanitise filename for storage path
  const sanitisedName = filename.replace(/[^\w.-]/g, "_").replace(/\s+/g, "_");
  const uniqueId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now();

  // Storage path structure: {company_id}/{record_type}/{record_id}/{uuid}-{sanitized_filename}
  const storagePath = `${companyId}/${recordType}/${recordId}/${uniqueId}-${sanitisedName}`;

  if (onProgress) onProgress(15);

  // Upload physical file to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(ACCOUNTS_BUCKET_NAME)
    .upload(storagePath, file, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
  }

  if (onProgress) onProgress(65);

  // Register attachment metadata in database
  try {
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id || null;

    const newAttachment = {
      company_id: companyId,
      project_id: projectId || null,
      record_type: recordType,
      record_id: recordId,
      document_type: documentType,
      original_filename: filename,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size_bytes: file.size,
      description: description || null,
      uploaded_by: currentUserId,
      uploaded_at: new Date().toISOString(),
      is_archived: false,
    };

    const { data, error: dbError } = await supabase
      .from("accounts_attachments")
      .insert(newAttachment)
      .select("*")
      .single();

    if (dbError) {
      console.error("Database metadata insert error:", dbError);
      // Clean up orphaned storage file
      await supabase.storage.from(ACCOUNTS_BUCKET_NAME).remove([storagePath]);
      throw new Error(`Database record creation failed: ${dbError.message}`);
    }

    if (onProgress) onProgress(100);

    return data as AccountAttachment;
  } catch (err: any) {
    // Safety cleanup in case of unexpected errors during metadata creation
    await supabase.storage.from(ACCOUNTS_BUCKET_NAME).remove([storagePath]).catch(() => {});
    throw err;
  }
}

/**
 * Fetches attachments for a company with optional recordType, recordId, projectId, includeArchived filters.
 */
export async function getAccountAttachments(
  companyId: string,
  filters?: AttachmentFilters
): Promise<AccountAttachment[]> {
  if (!companyId) return [];

  let query = supabase
    .from("accounts_attachments")
    .select("*")
    .eq("company_id", companyId);

  if (!filters?.includeArchived) {
    query = query.eq("is_archived", false);
  }

  if (filters?.recordType) {
    const sanitizedRecordType = sanitizeTypeKey(filters.recordType, "");
    if (sanitizedRecordType) {
      query = query.eq("record_type", sanitizedRecordType);
    }
  }
  if (filters?.recordId) {
    query = query.eq("record_id", filters.recordId);
  }
  if (filters?.projectId) {
    query = query.eq("project_id", filters.projectId);
  }
  if (filters?.documentType) {
    const sanitizedDocType = sanitizeTypeKey(filters.documentType, "");
    if (sanitizedDocType) {
      query = query.eq("document_type", sanitizedDocType);
    }
  }

  const { data, error } = await query.order("uploaded_at", { ascending: false });

  if (error) {
    console.error("Error fetching account attachments:", error);
    throw new Error(`Failed to load attachments: ${error.message}`);
  }

  return (data || []) as AccountAttachment[];
}

/**
 * Generates a short-lived signed URL for viewing or downloading a private storage file.
 */
export async function getAccountAttachmentSignedUrl(
  storagePath: string,
  expiresInSeconds = 1800
): Promise<string> {
  if (!storagePath) throw new Error("Storage path is required.");

  const { data, error } = await supabase.storage
    .from(ACCOUNTS_BUCKET_NAME)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    console.error("Error generating signed URL:", error);
    throw new Error(`Failed to generate signed download link: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Downloads a file blob directly and triggers browser download.
 */
export async function downloadAccountAttachment(storagePath: string, originalFilename: string): Promise<void> {
    assertOperationalAction("export", "services/accountsAttachmentsService.ts");
  if (!storagePath) throw new Error("Storage path is required.");

  const { data, error } = await supabase.storage
    .from(ACCOUNTS_BUCKET_NAME)
    .download(storagePath);

  if (error) {
    console.error("Error downloading attachment blob:", error);
    throw new Error(`Failed to download file: ${error.message}`);
  }

  // Trigger browser download
  const blobUrl = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = originalFilename || "document";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

/**
 * Soft deletes (archives) an attachment record in database.
 * No physical file removal occurs during normal archiving.
 */
export async function archiveAccountAttachment(attachmentId: string): Promise<void> {
  if (!attachmentId) throw new Error("Attachment ID is required.");

  const { error } = await supabase
    .from("accounts_attachments")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", attachmentId);

  if (error) {
    console.error("Error archiving attachment:", error);
    throw new Error(`Failed to archive document: ${error.message}`);
  }
}

/**
 * Restores an archived attachment record in database.
 */
export async function restoreAccountAttachment(attachmentId: string): Promise<void> {
  if (!attachmentId) throw new Error("Attachment ID is required.");

  const { error } = await supabase
    .from("accounts_attachments")
    .update({ is_archived: false, updated_at: new Date().toISOString() })
    .eq("id", attachmentId);

  if (error) {
    console.error("Error restoring attachment:", error);
    throw new Error(`Failed to restore document: ${error.message}`);
  }
}
