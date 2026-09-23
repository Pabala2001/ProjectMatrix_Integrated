import { assertOperationalAction } from "../../integration/operationalAccess";
import {
  indexCommunicationDocumentSource,
  ProjectAdvisorFileIndexServiceError,
  type ProjectAdvisorFileIndexResult,
} from "../../services/projectAdvisorFileIndexService";
import { supabase } from "../../lib/supabase";

export const MAX_SIGNED_RFI_FILE_SIZE_BYTES = 100 * 1024 * 1024;

export const SIGNED_RFI_TENANT_ERROR =
  "The signed RFI file could not be saved because the active company or project does not match this record.";
export const SIGNED_RFI_VALIDATION_ERROR =
  "Please select a valid PDF or DOCX file no larger than 100 MB.";
export const SIGNED_RFI_UPLOAD_ERROR =
  "The signed RFI file could not be uploaded safely. The existing signed file was preserved. Please try again.";
export const SIGNED_RFI_DATABASE_ERROR =
  "The signed RFI file could not be attached safely. The existing signed file was preserved. Please try again.";

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface ExistingSignedRfi {
  id: string;
  companyId: string;
  projectId: string;
  signedFilePath?: string;
  uploadedFilePath?: string;
  generatedDocxPath?: string;
}

export interface SaveSignedRfiFileParams {
  documentId: string;
  companyId: string;
  projectId: string;
  file: File;
  existingRfi: ExistingSignedRfi;
}

export interface SaveSignedRfiFileDeps {
  uploadStorageFile: (
    path: string,
    file: File,
  ) => Promise<{ error: unknown | null }>;
  removeStorageFiles: (
    paths: string[],
  ) => Promise<{ error: unknown | null }>;
  updateDatabaseRow: (
    documentId: string,
    companyId: string,
    projectId: string,
    payload: Record<string, unknown>,
  ) => Promise<{ data?: { id?: string } | null; error: unknown | null }>;
  indexSource: (
    communicationDocumentId: string,
    sourceKind: "signed",
  ) => Promise<ProjectAdvisorFileIndexResult>;
}

export interface SaveSignedRfiFileResult {
  success: boolean;
  documentId: string;
  storagePath?: string;
  signedFileName?: string;
  signedFileType?: string;
  signedFileSize?: number;
  indexResult?: ProjectAdvisorFileIndexResult;
  message?: string;
  warning?: string;
  error?: string;
}

export const defaultSaveSignedRfiFileDeps: SaveSignedRfiFileDeps = {
  uploadStorageFile: async (path, file) => {
    const { error } = await supabase.storage
      .from("communication-documents")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    return { error };
  },
  removeStorageFiles: async (paths) => {
    const { error } = await supabase.storage
      .from("communication-documents")
      .remove(paths);
    return { error };
  },
  updateDatabaseRow: async (
    documentId,
    companyId,
    projectId,
    payload,
  ) => {
    const { data, error } = await supabase
      .from("communication_documents")
      .update(payload)
      .eq("id", documentId)
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .select("id")
      .maybeSingle();
    return { data, error };
  },
  indexSource: (documentId, sourceKind) =>
    indexCommunicationDocumentSource(documentId, sourceKind),
};

function resolveSignedFileType(file: File): string | undefined {
  const lowerName = file.name.toLowerCase();
  const mimeType = file.type.trim().toLowerCase();

  if (
    lowerName.endsWith(".pdf") &&
    (mimeType === "" || mimeType === "application/pdf")
  ) {
    return "application/pdf";
  }

  if (
    lowerName.endsWith(".docx") &&
    (mimeType === "" || mimeType === DOCX_MIME_TYPE)
  ) {
    return DOCX_MIME_TYPE;
  }

  return undefined;
}

function sanitiseStorageFileName(fileName: string): string {
  const leafName = fileName.split(/[\\/]/).pop() || "signed-rfi";
  const dotIndex = leafName.lastIndexOf(".");
  const rawStem = dotIndex > 0 ? leafName.slice(0, dotIndex) : leafName;
  const extension = dotIndex > 0
    ? leafName.slice(dotIndex + 1).toLowerCase()
    : "";

  const safeStem = rawStem
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 120) || "signed-rfi";

  return extension ? `${safeStem}.${extension}` : safeStem;
}

function isRetryableIndexError(error: unknown): boolean {
  if (error instanceof ProjectAdvisorFileIndexServiceError) {
    return error.retryable;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "retryable" in error &&
    Boolean((error as { retryable?: boolean }).retryable)
  );
}

export async function saveSignedRfiFileLifecycle(
  params: SaveSignedRfiFileParams,
  deps: SaveSignedRfiFileDeps = defaultSaveSignedRfiFileDeps,
): Promise<SaveSignedRfiFileResult> {
    assertOperationalAction("write", "pages/Communication/rfiSignedFileLifecycle.ts");
  const {
    documentId,
    companyId,
    projectId,
    file,
    existingRfi,
  } = params;

  if (
    !documentId ||
    !companyId ||
    !projectId ||
    existingRfi.id !== documentId ||
    existingRfi.companyId !== companyId ||
    existingRfi.projectId !== projectId
  ) {
    return {
      success: false,
      documentId,
      error: SIGNED_RFI_TENANT_ERROR,
    };
  }

  const signedFileType = resolveSignedFileType(file);
  if (
    !signedFileType ||
    file.size <= 0 ||
    file.size > MAX_SIGNED_RFI_FILE_SIZE_BYTES
  ) {
    return {
      success: false,
      documentId,
      error: SIGNED_RFI_VALIDATION_ERROR,
    };
  }

  if (
    !globalThis.crypto ||
    typeof globalThis.crypto.randomUUID !== "function"
  ) {
    return {
      success: false,
      documentId,
      error: SIGNED_RFI_UPLOAD_ERROR,
    };
  }

  let fileNonce: string;
  try {
    fileNonce = globalThis.crypto.randomUUID();
  } catch {
    return {
      success: false,
      documentId,
      error: SIGNED_RFI_UPLOAD_ERROR,
    };
  }

  const safeFileName = sanitiseStorageFileName(file.name);
  const newStoragePath =
    `${companyId}/${projectId}/rfi/${documentId}/${fileNonce}-${safeFileName}`;
  const oldSignedPath = existingRfi.signedFilePath;

  try {
    const uploadResult = await deps.uploadStorageFile(newStoragePath, file);
    if (uploadResult.error) {
      return {
        success: false,
        documentId,
        error: SIGNED_RFI_UPLOAD_ERROR,
      };
    }
  } catch {
    return {
      success: false,
      documentId,
      error: SIGNED_RFI_UPLOAD_ERROR,
    };
  }

  const cleanupUncommittedUpload = async (): Promise<void> => {
    try {
      await deps.removeStorageFiles([newStoragePath]);
    } catch {
      // Best-effort cleanup only. Preserve the fixed database failure result.
    }
  };

  const databasePayload: Record<string, unknown> = {
    signed_status: "Signed",
    signed_file_path: newStoragePath,
    signed_file_name: file.name,
    signed_file_size: file.size,
    signed_file_type: signedFileType,
    status: "Closed",
  };

  try {
    const updateResult = await deps.updateDatabaseRow(
      documentId,
      companyId,
      projectId,
      databasePayload,
    );

    if (
      updateResult.error ||
      !updateResult.data ||
      !updateResult.data.id ||
      updateResult.data.id !== documentId
    ) {
      await cleanupUncommittedUpload();
      return {
        success: false,
        documentId,
        error: SIGNED_RFI_DATABASE_ERROR,
      };
    }
  } catch {
    await cleanupUncommittedUpload();
    return {
      success: false,
      documentId,
      error: SIGNED_RFI_DATABASE_ERROR,
    };
  }

  let completedResult: SaveSignedRfiFileResult = {
    success: true,
    documentId,
    storagePath: newStoragePath,
    signedFileName: file.name,
    signedFileType,
    signedFileSize: file.size,
    message: "The signed RFI file was uploaded successfully.",
  };

  try {
    const indexResult = await deps.indexSource(documentId, "signed");
    if (indexResult.status === "unsupported") {
      completedResult = {
        ...completedResult,
        indexResult,
        warning:
          "The signed RFI was saved, but its file format is unavailable to Project Advisor.",
      };
    } else {
      completedResult = {
        ...completedResult,
        indexResult,
      };
    }
  } catch (error: unknown) {
    completedResult = {
      ...completedResult,
      warning: isRetryableIndexError(error)
        ? "The signed RFI was saved, but Project Advisor indexing is temporarily unavailable. Upload the signed file again later to retry."
        : "The signed RFI was saved, but Project Advisor indexing did not complete.",
    };
  }

  if (
    oldSignedPath &&
    oldSignedPath !== newStoragePath &&
    oldSignedPath !== existingRfi.uploadedFilePath &&
    oldSignedPath !== existingRfi.generatedDocxPath
  ) {
    try {
      await deps.removeStorageFiles([oldSignedPath]);
    } catch {
      // Old-object cleanup is best-effort after the database update is confirmed.
    }
  }

  return completedResult;
}
