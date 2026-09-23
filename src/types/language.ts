export type LanguageCode = "en" | "ar" | "fr" | "pt" | "sw";

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  region: string;
  direction: "ltr" | "rtl";
  description: string;
}

export interface StructuredTelemetryData {
  activityType: string;
  quantity: number;
  unit: string;
  material: string;
  wbsCode?: string;
  location: string;
  labourCount?: number;
  equipmentUsed?: string[];
  weatherConditions?: string;
  hseIncidentCount?: number;
  qualityPassed?: boolean;
  scheduleImpactDays?: number;
  costImpact?: number;
}

export interface LocalizedViewData {
  title: string;
  summary: string;
  actionItems: string[];
  fieldNotes: string;
}

export interface MultilingualIngestionResult {
  id: string;
  timestamp: string;
  sourceText: string;
  sourceLanguage: LanguageCode;
  detectedLanguageName: string;
  author: {
    name: string;
    role: string;
    location: string;
    hubCode: string;
  };
  englishMaster: {
    title: string;
    summary: string;
    workPackage: string;
    wbsCode: string;
    formalRecord: string;
    actionRequired: string;
  };
  structuredData: StructuredTelemetryData;
  localizedViews: Record<LanguageCode, LocalizedViewData>;
  crossLingualSyncStatus: "synchronized" | "processing" | "verified";
  complianceNote: string;
}
