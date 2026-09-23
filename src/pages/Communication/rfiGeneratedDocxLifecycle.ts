import { assertOperationalAction } from "../../integration/operationalAccess";
import {
  indexCommunicationDocumentSource,
  ProjectAdvisorFileIndexServiceError,
  type ProjectAdvisorFileIndexResult,
} from "../../services/projectAdvisorFileIndexService";
import { supabase } from "../../lib/supabase";

export const GENERATED_RFI_DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MAX_GENERATED_RFI_DOCX_SIZE_BYTES = 100 * 1024 * 1024;

export const GENERATED_RFI_DOCX_TENANT_ERROR =
  "The RFI DOCX could not be saved because the active company or project does not match this record.";
export const GENERATED_RFI_DOCX_VALIDATION_ERROR =
  "The generated RFI DOCX is empty, invalid or larger than 100 MB.";
export const GENERATED_RFI_DOCX_UPLOAD_ERROR =
  "The RFI DOCX could not be uploaded safely. The existing generated document was preserved. Please try again.";
export const GENERATED_RFI_DOCX_DATABASE_ERROR =
  "The RFI DOCX could not be attached safely. The existing generated document was preserved. Please try again.";

export interface ExistingGeneratedRfi {
  id: string;
  companyId: string;
  projectId: string;
  generatedDocxPath?: string;
  uploadedFilePath?: string;
  signedFilePath?: string;
}

export interface SaveGeneratedRfiDocxParams {
  documentId: string;
  companyId: string;
  projectId: string;
  docxBlob: Blob;
  fileName: string;
  existingRfi: ExistingGeneratedRfi;
}

export interface SaveGeneratedRfiDocxDeps {
  uploadStorageFile: (
    path: string,
    blob: Blob,
    contentType: string,
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
    sourceKind: "generated",
  ) => Promise<ProjectAdvisorFileIndexResult>;
}

export interface SaveGeneratedRfiDocxResult {
  success: boolean;
  documentId: string;
  storagePath?: string;
  fileName?: string;
  fileSize?: number;
  indexResult?: ProjectAdvisorFileIndexResult;
  message?: string;
  warning?: string;
  error?: string;
}

export const defaultSaveGeneratedRfiDocxDeps: SaveGeneratedRfiDocxDeps = {
  uploadStorageFile: async (path, blob, contentType) => {
    const { error } = await supabase.storage
      .from("communication-documents")
      .upload(path, blob, {
        cacheControl: "3600",
        contentType,
        upsert: false,
      });
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

function sanitiseDocxFileName(fileName: string): string | undefined {
  const leafName = fileName.split(/[\\/]/).pop()?.trim() || "";
  if (!leafName.toLowerCase().endsWith(".docx")) {
    return undefined;
  }

  const rawStem = leafName.slice(0, -5);
  const safeStem = rawStem
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 120) || "RFI";

  return `${safeStem}.docx`;
}

function isValidDocxBlob(blob: Blob): boolean {
  const mimeType = blob.type.trim().toLowerCase();
  return (
    blob.size > 0 &&
    blob.size <= MAX_GENERATED_RFI_DOCX_SIZE_BYTES &&
    (mimeType === "" || mimeType === GENERATED_RFI_DOCX_MIME_TYPE)
  );
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

export async function saveGeneratedRfiDocxLifecycle(
  params: SaveGeneratedRfiDocxParams,
  deps: SaveGeneratedRfiDocxDeps = defaultSaveGeneratedRfiDocxDeps,
): Promise<SaveGeneratedRfiDocxResult> {
    assertOperationalAction("write", "pages/Communication/rfiGeneratedDocxLifecycle.ts");
  const {
    documentId,
    companyId,
    projectId,
    docxBlob,
    fileName,
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
      error: GENERATED_RFI_DOCX_TENANT_ERROR,
    };
  }

  const safeFileName = sanitiseDocxFileName(fileName);
  if (!safeFileName || !isValidDocxBlob(docxBlob)) {
    return {
      success: false,
      documentId,
      error: GENERATED_RFI_DOCX_VALIDATION_ERROR,
    };
  }

  if (
    !globalThis.crypto ||
    typeof globalThis.crypto.randomUUID !== "function"
  ) {
    return {
      success: false,
      documentId,
      error: GENERATED_RFI_DOCX_UPLOAD_ERROR,
    };
  }

  let fileNonce: string;
  try {
    fileNonce = globalThis.crypto.randomUUID();
  } catch {
    return {
      success: false,
      documentId,
      error: GENERATED_RFI_DOCX_UPLOAD_ERROR,
    };
  }

  const newStoragePath =
    `${companyId}/${projectId}/rfi/${documentId}/generated-${fileNonce}-${safeFileName}`;
  const oldGeneratedPath = existingRfi.generatedDocxPath;

  try {
    const uploadResult = await deps.uploadStorageFile(
      newStoragePath,
      docxBlob,
      GENERATED_RFI_DOCX_MIME_TYPE,
    );
    if (uploadResult.error) {
      return {
        success: false,
        documentId,
        error: GENERATED_RFI_DOCX_UPLOAD_ERROR,
      };
    }
  } catch {
    return {
      success: false,
      documentId,
      error: GENERATED_RFI_DOCX_UPLOAD_ERROR,
    };
  }

  const cleanupUncommittedUpload = async (): Promise<void> => {
    try {
      await deps.removeStorageFiles([newStoragePath]);
    } catch {
      // Best-effort cleanup only. Preserve the fixed database failure result.
    }
  };

  try {
    const updateResult = await deps.updateDatabaseRow(
      documentId,
      companyId,
      projectId,
      { generated_docx_path: newStoragePath },
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
        error: GENERATED_RFI_DOCX_DATABASE_ERROR,
      };
    }
  } catch {
    await cleanupUncommittedUpload();
    return {
      success: false,
      documentId,
      error: GENERATED_RFI_DOCX_DATABASE_ERROR,
    };
  }

  let completedResult: SaveGeneratedRfiDocxResult = {
    success: true,
    documentId,
    storagePath: newStoragePath,
    fileName: safeFileName,
    fileSize: docxBlob.size,
    message: "The RFI DOCX was generated and saved successfully.",
  };

  try {
    const indexResult = await deps.indexSource(documentId, "generated");
    if (indexResult.status === "unsupported") {
      completedResult = {
        ...completedResult,
        indexResult,
        warning:
          "The generated RFI DOCX was saved, but its file format is unavailable to Project Advisor.",
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
        ? "The generated RFI DOCX was saved, but Project Advisor indexing is temporarily unavailable. Generate the DOCX again later to retry."
        : "The generated RFI DOCX was saved, but Project Advisor indexing did not complete.",
    };
  }

  if (
    oldGeneratedPath &&
    oldGeneratedPath !== newStoragePath &&
    oldGeneratedPath !== existingRfi.uploadedFilePath &&
    oldGeneratedPath !== existingRfi.signedFilePath
  ) {
    try {
      await deps.removeStorageFiles([oldGeneratedPath]);
    } catch {
      // Old-object cleanup is best-effort after the database update is confirmed.
    }
  }

  return completedResult;
}
