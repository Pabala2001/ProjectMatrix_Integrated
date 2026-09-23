export interface ContractAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  dataUrl?: string;
  uploadedAt: string;
  category?: string;
}

export type ContractStatus = 
  | "Draft"
  | "Active"
  | "Executing"
  | "Substantially Complete"
  | "Completed"
  | "Under Dispute"
  | "Suspended"
  | "Terminated";

export type ContractTypeOption = 
  | "FIDIC 2017 Red Book (Conditions of Contract for Construction)"
  | "FIDIC 2017 Yellow Book (Plant & Design-Build)"
  | "FIDIC 2017 Silver Book (EPC/Turnkey)"
  | "FIDIC 1999 Red Book (Construction 1st Ed)"
  | "FIDIC 1999 Yellow Book (Plant & Design-Build)"
  | "NEC4 ECC (Engineering and Construction Contract)"
  | "NEC3 ECC (Option A / B / C / D / E)"
  | "SAICE GCC 2015 (General Conditions of Contract 3rd Ed)"
  | "JBCC PBA 6.2 (Principal Building Agreement)"
  | "JCT Standard Building Contract"
  | "Standard Subcontract Agreement"
  | "Consultancy & Engineering Services Agreement"
  | "Supply & Delivery Agreement"
  | "Custom EPC / Turnkey Contract"
  | "Other Bespoke Contract";

export interface ProjectContractRecord {
  id: string;
  projectId: string; // Linked to currently selected project
  projectName?: string;
  contractNumber: string; // e.g. "CON-2024-001"
  contractTitle: string; // e.g. "Main Civil & Structural Works Agreement"
  client: string; // Client / Employer
  contractor: string; // Main Contractor / JV Partner / Subcontractor
  contractType: string; // Standard or Bespoke suite
  contractValue: number; // e.g. 50000000
  currency: string; // e.g. "USD", "TZS", "ZAR", "EUR", "GBP", "KES"
  startDate: string; // ISO date YYYY-MM-DD
  completionDate: string; // ISO date YYYY-MM-DD
  status: ContractStatus;
  
  // Optional detailed fields
  description?: string;
  scopeOfWorks?: string;
  governingLaw?: string;
  disputeResolutionMethod?: string;
  engineerOrPM?: string;
  advancePaymentPercent?: number;
  retentionPercent?: number;
  performanceSecurityPercent?: number;
  delayDamagesPerDay?: number;
  
  // Supporting documents
  attachments: ContractAttachment[];
  
  // Audit metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface ContractKPIs {
  totalContractsCount: number;
  totalContractValue: number;
  activeContractsCount: number;
  completedContractsCount: number;
  averageDurationDays: number;
  primaryCurrency: string;
}
