import { supabase } from "../lib/supabase";
import { ensureUUID } from "./qualityControlStorage";

export interface LogoMetadata {
  companyLogoBucket: string;
  companyLogoPath: string;
  companyLogoFileName: string;
  companyLogoMimeType: string;
  companyLogoFileSize: number;
  companyLogoUploadedAt: string;
}

export interface SignatureMetadata {
  bucket: string;
  path: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface DocxMetadata {
  docxBucket: string;
  docxPath: string;
  docxFileName: string;
  docxMimeType: string;
  docxFileSize: number;
  docxGeneratedAt: string;
}

/**
 * Reusable utility helper for Quality Control Supabase Storage operations
 */
export const QualityControlStorageHelper = {
  /**
   * Helper to delete a file from Supabase Storage
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    try {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) {
        console.warn(`Warning deleting storage file (${bucket}/${path}):`, error.message);
      }
    } catch (err) {
      console.warn(`Warning deleting storage file (${bucket}/${path}):`, err);
    }
  },

  /**
   * Upload Company Logo to quality-control-assets bucket under company-logos/
   */
  async uploadCompanyLogo(companyId: string, file: File): Promise<LogoMetadata> {
    const bucket = "quality-control-assets";
    const uuid = ensureUUID(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "");
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `company-logos/${companyId || "unassigned"}/${uuid}_${sanitizedName}`;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (error) {
      throw new Error(`Logo upload failed: ${error.message}`);
    }

    return {
      companyLogoBucket: bucket,
      companyLogoPath: path,
      companyLogoFileName: file.name,
      companyLogoMimeType: file.type || "image/png",
      companyLogoFileSize: file.size,
      companyLogoUploadedAt: new Date().toISOString(),
    };
  },

  /**
   * Upload Signature (Contractor / Resident Engineer / Inspector) to quality-control-assets bucket under signatures/
   */
  async uploadSignature(
    type: "contractor" | "resident" | "inspector",
    recordId: string,
    file: File | Blob,
    originalName?: string
  ): Promise<SignatureMetadata> {
    const bucket = "quality-control-assets";
    const uuid = ensureUUID(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "");
    const name = originalName || (file instanceof File ? file.name : "signature.png");
    const sanitizedName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    
    // Support Contractor, Resident Engineer, and Inspector specific folders
    const path = `signatures/${type}/${recordId}/${uuid}_${sanitizedName}`;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (error) {
      throw new Error(`Signature upload failed: ${error.message}`);
    }

    return {
      bucket,
      path,
      fileName: name,
      mimeType: file.type || "image/png",
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
    };
  },

  /**
   * Upload Generated DOCX Document to quality-control-documents bucket
   */
  async uploadDocx(
    projectId: string,
    recordId: string,
    fileName: string,
    docxBlob: Blob
  ): Promise<DocxMetadata> {
    const bucket = "quality-control-documents";
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${projectId || "unassigned"}/${recordId}/${timestamp}_${sanitizedName}`;

    const { error } = await supabase.storage.from(bucket).upload(path, docxBlob, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      throw new Error(`DOCX upload failed: ${error.message}`);
    }

    return {
      docxBucket: bucket,
      docxPath: path,
      docxFileName: fileName,
      docxMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      docxFileSize: docxBlob.size,
      docxGeneratedAt: new Date().toISOString(),
    };
  },

  /**
   * Create a temporary Signed URL for secure download/display of a private asset
   */
  async getSignedUrl(bucket: string, path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }
    return data.signedUrl;
  },

  /**
   * Directly download a private asset as a Blob
   */
  async downloadAssetBlob(bucket: string, path: string): Promise<Blob> {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) {
      throw new Error(`Failed to download asset: ${error.message}`);
    }
    return data;
  },

  /**
   * Get secure Object URL from downloading the blob directly
   */
  async getObjectUrl(bucket: string, path: string): Promise<string> {
    const blob = await this.downloadAssetBlob(bucket, path);
    return URL.createObjectURL(blob);
  }
};
