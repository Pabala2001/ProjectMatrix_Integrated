export type V2Domain = "site_diaries";

export type SiteDiaryIntentId =
  | "SITE_DIARY_COUNT"
  | "SITE_DIARY_RECENT"
  | "SITE_DIARY_DATE_RANGE"
  | "SITE_DIARY_DELAYS"
  | "SITE_DIARY_EXACT_MATCH";

export type TargetField =
  | "DETAILS"
  | "DATE"
  | "TIME"
  | "LOGGER"
  | "CATEGORY"
  | "COUNT"
  | "LIST";

export interface DateRangeParam {
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface ExactMatchFilters {
  specificDate?: string | null; // YYYY-MM-DD
  specificDateFormatted?: string | null;
  dateRange?: DateRangeParam | null;
  diaryTime?: string | null; // HH:mm
  logCategory?: string | null;
  loggedBy?: string | null;
  detailsKeyword?: string | null;
  hasDelay?: boolean | null;
  targetField: TargetField;
}

export interface CatalogueQueryParams {
  companyId: string;
  projectId: string;
  dateRange?: DateRangeParam | null;
  limit?: number;
  exactFilters?: ExactMatchFilters | null;
}

export interface SiteDiarySourceRecord {
  id: string;
  diary_date: string;
  diary_time: string | null;
  log_category: string;
  details: string;
  logged_by: string;
  has_delay: boolean;
  delay_reason: string | null;
  attachment_path: string | null;
  created_at: string;
}

export interface SummaryMetric {
  label: string;
  value: string | number;
}

export interface V2QueryResult {
  intentId: SiteDiaryIntentId | "UNSUPPORTED" | "ERROR";
  domain: V2Domain;
  title: string;
  directAnswer: string;
  calculationBasis: string;
  metrics: SummaryMetric[];
  evidenceRows: SiteDiarySourceRecord[];
  sourceRoute: string;
  companyId: string;
  projectId: string;
  dateRange: DateRangeParam | null;
  asAt: string;
  status: "success" | "empty" | "unsupported" | "error";
  errorDetails?: string;
  suggestedQuestions?: string[];
}
