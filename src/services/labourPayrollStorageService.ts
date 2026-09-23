import { assertOperationalAction } from "../integration/operationalAccess";
import { supabase } from "../lib/supabase";

const BUCKET_NAME = "labour-payroll-files";
const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface UploadWorkbookResult {
  storagePath: string;
  fileName: string;
}

/**
 * Upload a payroll workbook to Supabase Storage and register its metadata.
 * Path structure: company_id/project_id/payroll_id/filename.xlsx
 */
export async function uploadPayrollWorkbook(
  companyId: string,
  projectId: string,
  payrollId: string,
  fileName: string,
  workbookBlob: Blob,
  isDraft: boolean
): Promise<UploadWorkbookResult> {
    assertOperationalAction("write", "services/labourPayrollStorageService.ts");
  if (!companyId || !projectId || !payrollId) {
    throw new Error("Missing companyId, projectId or payrollId for upload.");
  }

  // Ensure fileName has .xlsx extension and is sanitised
  let sanitisedName = fileName
    .replace(/[\\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_");
  if (!sanitisedName.toLowerCase().endsWith(".xlsx")) {
    sanitisedName += ".xlsx";
  }

  const storagePath = `${companyId}/${projectId}/${payrollId}/${sanitisedName}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, workbookBlob, {
      contentType: EXCEL_MIME,
      cacheControl: "3600",
      upsert: isDraft,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  try {
    // Register metadata
    const { error: registerError } = await supabase.rpc("register_labour_payroll_excel", {
      p_payroll_id: payrollId,
      p_storage_path: storagePath,
      p_file_name: sanitisedName,
      p_file_size: workbookBlob.size,
      p_mime_type: EXCEL_MIME,
    });

    if (registerError) {
      throw registerError;
    }

    return { storagePath, fileName: sanitisedName };
  } catch (err: any) {
    console.error("Metadata registration failed, cleaning up uploaded file...", err);
    // If metadata registration fails, delete the uploaded file to avoid orphans
    await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    throw new Error(`Failed to register Excel metadata: ${err.message || err}`);
  }
}

/**
 * Download a stored payroll workbook Blob directly from private storage.
 */
export async function downloadPayrollWorkbook(storagePath: string): Promise<Blob> {
    assertOperationalAction("export", "services/labourPayrollStorageService.ts");
  if (!storagePath) {
    throw new Error("Storage path is required to download.");
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error) {
    throw new Error(`Failed to download workbook: ${error.message}`);
  }

  return data;
}

/**
 * Create a short-lived signed URL for a stored payroll workbook.
 */
export async function createPayrollWorkbookSignedUrl(
  storagePath: string,
  expireInSeconds = 600
): Promise<string> {
    assertOperationalAction("create", "services/labourPayrollStorageService.ts");
  if (!storagePath) {
    throw new Error("Storage path is required to create a signed URL.");
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expireInSeconds);

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Delete stored payroll workbook and clear metadata on the payroll record.
 */
export async function deletePayrollWorkbook(
  payrollId: string,
  storagePath: string
): Promise<void> {
    assertOperationalAction("delete", "services/labourPayrollStorageService.ts");
  if (!payrollId) {
    throw new Error("Payroll ID is required to delete.");
  }

  // Delete from Storage first if path is provided
  if (storagePath) {
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (deleteError) {
      console.warn(`Warning: Storage file deletion failed: ${deleteError.message}`);
    }
  }

  // Clear metadata fields on the payroll table
  const { error: updateError } = await supabase
    .from("labour_payrolls")
    .update({
      excel_storage_path: null,
      excel_file_name: null,
      excel_file_size: null,
      excel_mime_type: null,
      excel_uploaded_at: null,
      excel_uploader_name: null,
    } as any)
    .eq("id", payrollId);

  if (updateError) {
    throw new Error(`Failed to clear database metadata: ${updateError.message}`);
  }
}

/**
 * Register file metadata directly (if needed independently).
 */
export async function registerPayrollWorkbook(
  payrollId: string,
  storagePath: string,
  fileName: string,
  fileSize: number
): Promise<void> {
  const { error } = await supabase.rpc("register_labour_payroll_excel", {
    p_payroll_id: payrollId,
    p_storage_path: storagePath,
    p_file_name: fileName,
    p_file_size: fileSize,
    p_mime_type: EXCEL_MIME,
  });

  if (error) {
    throw new Error(`Failed to register workbook metadata: ${error.message}`);
  }
}
