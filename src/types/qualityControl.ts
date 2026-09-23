export type FormStatus = "Draft" | "Completed" | "Approved" | "Rejected";

export interface CustomFieldDefinition {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "time" | "textarea" | "select";
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
  section?: string;
}

export interface QualityControlTemplate {
  id: string;
  title: string;
  category: string;
  documentRef?: string;
  revision?: string;
  revisionDate?: string;
  description: string;
  customFields: CustomFieldDefinition[];
  checklistItems: string[]; // Standard checklist operations/items
  checklistColumns?: string[]; // Columns to display, defaults to ["Item", "Yes", "No", "N/A", "Comments"]
  hasMeasurementColumns?: boolean; // If true, includes "Specified" and "Actual" columns in checklist
}

export interface QualityControlRecord {
  id: string;
  templateId: string;
  formTitle: string;
  category: string;
  formReference?: string;
  revision?: string;
  revisionDate?: string;

  // General header fields
  projectName?: string;
  projectNumber?: string;
  contractNumber?: string;
  contractor?: string;
  location?: string;
  item?: string;

  // Company identity details
  companyName?: string;
  companyLogoBase64?: string;

  // Company Logo metadata
  companyLogoBucket?: string | null;
  companyLogoPath?: string | null;
  companyLogoFileName?: string | null;
  companyLogoMimeType?: string | null;
  companyLogoFileSize?: number | null;
  companyLogoUploadedAt?: string | null;

  // Signatures & Signoffs
  contractorSignatureName?: string;
  residentEngineerSignatureName?: string;
  inspectorSignatureName?: string;
  signoffDate?: string;

  // Contractor Signature metadata
  contractorSignatureBucket?: string | null;
  contractorSignaturePath?: string | null;
  contractorSignatureFileName?: string | null;
  contractorSignatureMimeType?: string | null;
  contractorSignatureFileSize?: number | null;
  contractorSignatureUploadedAt?: string | null;

  // Resident Engineer Signature metadata
  residentSignatureBucket?: string | null;
  residentSignaturePath?: string | null;
  residentSignatureFileName?: string | null;
  residentSignatureMimeType?: string | null;
  residentSignatureFileSize?: number | null;
  residentSignatureUploadedAt?: string | null;

  // Inspector Signature metadata
  inspectorSignatureBucket?: string | null;
  inspectorSignaturePath?: string | null;
  inspectorSignatureFileName?: string | null;
  inspectorSignatureMimeType?: string | null;
  inspectorSignatureFileSize?: number | null;
  inspectorSignatureUploadedAt?: string | null;

  // DOCX metadata
  docxBucket?: string | null;
  docxPath?: string | null;
  docxFileName?: string | null;
  docxMimeType?: string | null;
  docxFileSize?: number | null;
  docxGeneratedAt?: string | null;

  status: FormStatus;

  // Form-specific fields mapping field-name to values
  fields: Record<string, string | number | boolean | null>;
  
  // Checklist item states
  checklistRows: Array<{
    id: string;
    item: string;
    acceptable: "Yes" | "No" | "N/A" | "";
    specified?: string;
    actual?: string;
    comments?: string;
  }>;

  // Tenant & project context
  projectId?: string;
  project_id?: string;
  companyId?: string;
  company_id?: string;

  createdAt: string;
  updatedAt: string;
}
