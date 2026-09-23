import { assertOperationalAction } from "../../integration/operationalAccess";
import {
  deleteAllCommunicationDocumentSourceIndexes,
  indexCommunicationDocumentSource,
  ProjectAdvisorFileIndexResult,
  ProjectAdvisorFileIndexServiceError,
} from "../../services/projectAdvisorFileIndexService";
import { supabase } from "../../lib/supabase";

export interface CommDocument {
  id: string;
  companyId: string;
  projectId: string;
  folderName: string;
  documentType: string;
  title: string;
  docNumber: string;
  revision: string;
  date: string;
  status: "Draft" | "Submitted" | "Under Review" | "Approved" | "Closed" | "Superseded";
  signedStatus: "Not Signed" | "Signed" | "Awaiting Signature";
  sender: string;
  recipient: string;
  subject: string;
  description: string;
  uploadedFilePath?: string;
  uploadedFileName?: string;
  uploadedFileType?: string;
  uploadedFileSize?: number;
  signedFilePath?: string;
  signedFileName?: string;
  signedFileType?: string;
  signedFileSize?: number;
  generatedDocxPath?: string;
  createdAt: string;
}

export function mapDbToCommDocument(row: any): CommDocument {
  return {
    id: row.id,
    companyId: row.company_id,
    projectId: row.project_id,
    folderName: row.folder_name,
    documentType: row.document_type || "",
    title: row.document_title || "",
    docNumber: row.document_number || "",
    revision: row.revision || "0",
    date: row.document_date || "",
    status: (row.status as any) || "Draft",
    signedStatus: (row.signed_status as any) || "Not Signed",
    sender: row.sender || row.originator || "",
    recipient: row.recipient || row.attention || row.recipient_company || row.to_company || "",
    subject: row.subject || row.document_title || "",
    description: row.description || row.rfi_description || "",
    uploadedFilePath: row.uploaded_file_path || undefined,
    uploadedFileName: row.uploaded_file_name || undefined,
    uploadedFileType: row.uploaded_file_type || undefined,
    uploadedFileSize:
      row.uploaded_file_size != null
        ? Number(row.uploaded_file_size)
        : undefined,
    signedFilePath: row.signed_file_path || undefined,
    signedFileName: row.signed_file_name || undefined,
    signedFileType: row.signed_file_type || undefined,
    signedFileSize:
      row.signed_file_size != null
        ? Number(row.signed_file_size)
        : undefined,
    generatedDocxPath: row.generated_docx_path || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export interface SaveLifecycleParams {
  documentId: string;
  companyId: string;
  projectId: string;
  folderName: string;
  payload: Record<string, unknown>;
  uploadedFile: File | null;
  existingDoc: {
    id: string;
    companyId?: string;
    projectId?: string;
    uploadedFilePath?: string;
    signedFilePath?: string;
    generatedDocxPath?: string;
  } | null;
}

export interface SaveLifecycleDeps {
  uploadStorageFile: (
    path: string,
    file: File,
  ) => Promise<{ error: unknown | null }>;
  removeStorageFiles: (
    paths: string[],
  ) => Promise<{ error: unknown | null }>;
  insertDatabaseRow: (
    payload: Record<string, unknown>,
  ) => Promise<{ data?: { id?: string } | null; error: unknown | null }>;
  updateDatabaseRow: (
    id: string,
    companyId: string,
    projectId: string,
    payload: Record<string, unknown>,
  ) => Promise<{ data?: { id?: string } | null; error: unknown | null }>;
  indexSource: (
    communicationDocumentId: string,
    sourceKind: "uploaded",
  ) => Promise<ProjectAdvisorFileIndexResult>;
}

export interface SaveLifecycleResult {
  success: boolean;
  documentId: string;
  message?: string;
  warning?: string;
  indexResult?: ProjectAdvisorFileIndexResult;
  error?: string;
}

export interface DeleteLifecycleParams {
  documentId: string;
  companyId: string;
  projectId: string;
  uploadedFilePath?: string;
  signedFilePath?: string;
  generatedDocxPath?: string;
}

export interface DeleteLifecycleDeps {
  deleteAllIndexes: (documentId: string) => Promise<void>;
  removeStorageFiles: (
    paths: string[],
  ) => Promise<{ error: unknown | null }>;
  deleteDatabaseRow: (
    documentId: string,
    companyId: string,
    projectId: string,
  ) => Promise<{ data?: { id?: string } | null; error: unknown | null }>;
}

export interface DeleteLifecycleResult {
  success: boolean;
  message?: string;
  error?: string;
}

export const defaultSaveDeps: SaveLifecycleDeps = {
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
  insertDatabaseRow: async (payload) => {
    const { data, error } = await supabase
      .from("communication_documents")
      .insert([payload])
      .select("id")
      .single();
    return { data, error };
  },
  updateDatabaseRow: async (id, companyId, projectId, payload) => {
    const { data, error } = await supabase
      .from("communication_documents")
      .update(payload)
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .select("id")
      .maybeSingle();
    return { data, error };
  },
  indexSource: (documentId, sourceKind) =>
    indexCommunicationDocumentSource(documentId, sourceKind),
};

export const defaultDeleteDeps: DeleteLifecycleDeps = {
  deleteAllIndexes: (documentId) =>
    deleteAllCommunicationDocumentSourceIndexes(documentId),
  removeStorageFiles: async (paths) => {
    const { error } = await supabase.storage
      .from("communication-documents")
      .remove(paths);
    return { error };
  },
  deleteDatabaseRow: async (documentId, companyId, projectId) => {
    const { data, error } = await supabase
      .from("communication_documents")
      .delete()
      .eq("id", documentId)
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .select("id")
      .maybeSingle();
    return { data, error };
  },
};

export async function saveCommunicationDocumentFileLifecycle(
  params: SaveLifecycleParams,
  deps: SaveLifecycleDeps = defaultSaveDeps,
): Promise<SaveLifecycleResult> {
    assertOperationalAction("write", "pages/Communication/communicationDocumentFileLifecycle.ts");
  const {
    documentId,
    companyId,
    projectId,
    folderName,
    payload,
    uploadedFile,
    existingDoc,
  } = params;

  const isEditing = Boolean(existingDoc);

  if (isEditing && existingDoc) {
    if (
      (existingDoc.companyId && existingDoc.companyId !== companyId) ||
      (existingDoc.projectId && existingDoc.projectId !== projectId)
    ) {
      return {
        success: false,
        documentId,
        error: "Failed to update document record in database.",
      };
    }
  }

  const oldUploadedPath = existingDoc?.uploadedFilePath;
  let newStoragePath: string | undefined;

  const finalPayload: Record<string, unknown> = { ...payload };

  let shouldUpdateLegacySignedFields = false;

  // 1. Storage Upload (if new file provided)
  if (uploadedFile) {
    if (
      !globalThis.crypto ||
      typeof globalThis.crypto.randomUUID !== "function"
    ) {
      return {
        success: false,
        documentId,
        error: "Failed to upload document file.",
      };
    }
    const fileNonce = globalThis.crypto.randomUUID();
    newStoragePath = `${companyId}/${projectId}/${folderName}/${documentId}/${fileNonce}-${uploadedFile.name}`;

    const uploadRes = await deps.uploadStorageFile(
      newStoragePath,
      uploadedFile,
    );
    if (uploadRes.error) {
      return {
        success: false,
        documentId,
        error: "Failed to upload document file.",
      };
    }

    finalPayload.uploaded_file_path = newStoragePath;
    finalPayload.uploaded_file_name = uploadedFile.name;
    finalPayload.uploaded_file_type = uploadedFile.type;
    finalPayload.uploaded_file_size = uploadedFile.size;

    // Sync with legacy file fields only when new record or signedFilePath is absent or mirrors oldUploadedPath
    shouldUpdateLegacySignedFields =
      !isEditing ||
      !existingDoc?.signedFilePath ||
      existingDoc.signedFilePath === oldUploadedPath;

    if (shouldUpdateLegacySignedFields) {
      finalPayload.signed_file_path = newStoragePath;
      finalPayload.signed_file_name = uploadedFile.name;
      finalPayload.signed_file_type = uploadedFile.type;
      finalPayload.signed_file_size = uploadedFile.size;
    }
  }

  const finalUploadedFilePath =
    (finalPayload.uploaded_file_path as string | undefined) ||
    oldUploadedPath;

  const cleanupUncommittedUpload = async (): Promise<void> => {
    if (!newStoragePath) {
      return;
    }

    try {
      await deps.removeStorageFiles([newStoragePath]);
    } catch {
      // Best-effort cleanup only. Preserve the fixed database failure result.
    }
  };

  // 2. Database Insert / Update
  if (isEditing) {
    try {
      const updateRes = await deps.updateDatabaseRow(
        documentId,
        companyId,
        projectId,
        finalPayload,
      );

      if (
        updateRes.error ||
        !updateRes.data ||
        !updateRes.data.id ||
        updateRes.data.id !== documentId
      ) {
        await cleanupUncommittedUpload();
        return {
          success: false,
          documentId,
          error: "Failed to update document record in database.",
        };
      }
    } catch {
      await cleanupUncommittedUpload();
      return {
        success: false,
        documentId,
        error: "Failed to update document record in database.",
      };
    }
  } else {
    finalPayload.id = documentId;

    try {
      const insertRes = await deps.insertDatabaseRow(finalPayload);

      if (
        insertRes.error ||
        !insertRes.data ||
        !insertRes.data.id ||
        insertRes.data.id !== documentId
      ) {
        await cleanupUncommittedUpload();
        return {
          success: false,
          documentId,
          error: "Failed to insert document record in database.",
        };
      }
    } catch {
      await cleanupUncommittedUpload();
      return {
        success: false,
        documentId,
        error: "Failed to insert document record in database.",
      };
    }
  }

  // 3. Index the committed uploaded source exactly once.
  // Capture the outcome instead of returning here so eligible old-object
  // cleanup always happens after the indexing attempt.
  let completedResult: SaveLifecycleResult = {
    success: true,
    documentId,
    message: isEditing
      ? "Document updated successfully."
      : "Document saved successfully.",
  };

  if (finalUploadedFilePath) {
    try {
      const indexResult = await deps.indexSource(documentId, "uploaded");

      if (indexResult.status === "unsupported") {
        completedResult = {
          success: true,
          documentId,
          indexResult,
          warning:
            "The document was saved, but its file format is unavailable to Project Advisor.",
        };
      } else {
        completedResult = {
          success: true,
          documentId,
          message: isEditing
            ? "Document updated successfully."
            : "Document saved and uploaded successfully.",
          indexResult,
        };
      }
    } catch (err: unknown) {
      let isRetryable = false;

      if (err instanceof ProjectAdvisorFileIndexServiceError) {
        isRetryable = err.retryable;
      } else if (
        typeof err === "object" &&
        err !== null &&
        "retryable" in err
      ) {
        isRetryable = Boolean((err as { retryable?: boolean }).retryable);
      }

      completedResult = {
        success: true,
        documentId,
        message: isEditing
          ? "Document updated successfully."
          : "Document saved successfully.",
        warning: isRetryable
          ? "The document was saved, but Project Advisor indexing is temporarily unavailable. Save the document again later to retry."
          : "The document was saved, but Project Advisor indexing did not complete.",
      };
    }
  }

  // 4. Only after the indexing attempt, remove the previous uploaded object
  // when the final committed record no longer references it as another source.
  if (
    uploadedFile &&
    oldUploadedPath &&
    newStoragePath &&
    oldUploadedPath !== newStoragePath
  ) {
    const resolveFinalSourcePath = (
      payloadKey: "signed_file_path" | "generated_docx_path",
      existingPath: string | undefined,
    ): string | undefined => {
      if (!Object.prototype.hasOwnProperty.call(finalPayload, payloadKey)) {
        return existingPath;
      }

      const value = finalPayload[payloadKey];
      return typeof value === "string" && value.trim().length > 0
        ? value
        : undefined;
    };

    const finalSignedPath = resolveFinalSourcePath(
      "signed_file_path",
      existingDoc?.signedFilePath,
    );
    const finalGeneratedPath = resolveFinalSourcePath(
      "generated_docx_path",
      existingDoc?.generatedDocxPath,
    );

    const isReferencedByOtherSource =
      finalSignedPath === oldUploadedPath ||
      finalGeneratedPath === oldUploadedPath;

    if (!isReferencedByOtherSource) {
      try {
        await deps.removeStorageFiles([oldUploadedPath]);
      } catch {
        // Old-object cleanup is best-effort after a confirmed database save.
      }
    }
  }

  return completedResult;
}

export async function deleteCommunicationDocumentFileLifecycle(
  params: DeleteLifecycleParams,
  deps: DeleteLifecycleDeps = defaultDeleteDeps,
): Promise<DeleteLifecycleResult> {
    assertOperationalAction("delete", "pages/Communication/communicationDocumentFileLifecycle.ts");
  const {
    documentId,
    companyId,
    projectId,
    uploadedFilePath,
    signedFilePath,
    generatedDocxPath,
  } = params;

  // 1. Index cleanup first: deleteAllCommunicationDocumentSourceIndexes(documentId)
  try {
    await deps.deleteAllIndexes(documentId);
  } catch (_err: unknown) {
    return {
      success: false,
      error:
        "The document could not be deleted safely. No further deletion steps were completed. Please try again.",
    };
  }

  // 2. Remove deduplicated Storage paths
  const rawPaths = [uploadedFilePath, signedFilePath, generatedDocxPath];
  const deduplicatedPaths = Array.from(
    new Set(
      rawPaths.filter(
        (p): p is string =>
          Boolean(p && typeof p === "string" && p.trim().length > 0),
      ),
    ),
  );

  if (deduplicatedPaths.length > 0) {
    const storageRes = await deps.removeStorageFiles(deduplicatedPaths);
    if (storageRes.error) {
      return {
        success: false,
        error:
          "The document could not be deleted safely. No further deletion steps were completed. Please try again.",
      };
    }
  }

  // 3. Delete communication_documents row
  const dbRes = await deps.deleteDatabaseRow(documentId, companyId, projectId);
  if (
    dbRes.error ||
    !dbRes.data ||
    !dbRes.data.id ||
    dbRes.data.id !== documentId
  ) {
    return {
      success: false,
      error:
        "The document could not be deleted safely. No further deletion steps were completed. Please try again.",
    };
  }

  // 4. Return success
  return {
    success: true,
    message: "Document and all linked files completely deleted.",
  };
}