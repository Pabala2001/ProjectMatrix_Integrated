import {
  executeSiteDiaryCount,
  executeSiteDiaryDateRange,
  executeSiteDiaryDelays,
  executeSiteDiaryExactMatch,
  executeSiteDiaryRecent,
  formatDateDisplay,
} from "./queryCatalogue";
import {
  DateRangeParam,
  ExactMatchFilters,
  TargetField,
  V2QueryResult,
} from "./types";

const MONTH_MAP: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const DATE_PATTERNS: RegExp[] = [
  /\b\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+\s+\d{4}\b/gi,
  /\b[a-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi,
  /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
  /\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/g,
];

const RELATIVE_DATE_PATTERN =
  /\b(today|yesterday|this week|last week|this month|last month)\b/gi;

const DIARY_TIME_PATTERN =
  /\b(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/g;

const LOGGER_REQUEST_PATTERN =
  /\b(?:who|whom|by whom|which person|what person|author|writer|logger|recorder|name of the person|responsible for recording)\b/i;

const CATEGORY_REQUEST_PATTERN =
  /\b(?:what|which|under what|under which)\s+(?:log\s+)?category\b|\bclassification\b|\btype of (?:log|entry)\b|\bkind of entry\b/i;

const TIME_REQUEST_PATTERN =
  /\b(?:what time|which time|at what time|when during the day|time of the entry|time was (?:it\s+)?recorded|time was (?:it\s+)?logged)\b/i;

const DATE_REQUEST_PATTERN =
  /\b(?:what date|which date|on what date|on which date|what day|which day)\b/i;

const WHEN_REQUEST_PATTERN =
  /\bwhen\s+(?:did|was|were|has|have)\b/i;

const COUNT_REQUEST_PATTERN =
  /\b(?:how many|count|number of|total number|total entries)\b/i;

const DETAILS_REQUEST_PATTERN =
  /\b(?:what happened|what was recorded|what was logged|what was written|what was captured|what did .+ (?:record|log|write|capture)|details|description|information|notes|activities|activity|work recorded|tell me about|content of the entry)\b/i;

const LIST_REQUEST_PATTERN =
  /\b(?:show|list|display|give me|find|retrieve|which entries|what entries)\b/i;

const RECENT_PATTERN =
  /\b(?:latest|most recent|recent|newest|last five|last 5)\b/i;

const DIARY_CONTEXT_PATTERN =
  /\b(?:site diar(?:y|ies)|diar(?:y|ies)|diary entries?|site logs?|daily logs?|entries|recorded|logged|captured|written|what happened)\b/i;

const UNSUPPORTED_PATTERN =
  /\b(?:weather forecast|stock price|share price|payroll)\b/i;

const ALLOWED_CATEGORIES: ReadonlyArray<{
  value: string;
  patterns: RegExp[];
}> = [
  {
    value: "Progress Update",
    patterns: [/\bprogress updates?\b/i, /\bprogress\b/i],
  },
  {
    value: "Delay / Stoppage",
    patterns: [
      /\bdelay\s*\/\s*stoppage\b/i,
      /\bdelay stoppage\b/i,
      /\bstoppages?\b/i,
    ],
  },
  {
    value: "Weather",
    patterns: [/\bweather\b/i],
  },
  {
    value: "Safety / Quality",
    patterns: [
      /\bsafety\s*\/\s*quality\b/i,
      /\bsafety quality\b/i,
      /\bsafety\b/i,
      /\bquality\b/i,
    ],
  },
  {
    value: "General Note",
    patterns: [/\bgeneral notes?\b/i],
  },
  {
    value: "Site Issue",
    patterns: [/\bsite issues?\b/i],
  },
  {
    value: "Instruction",
    patterns: [/\binstructions?\b/i],
  },
  {
    value: "Visitor",
    patterns: [/\bvisitors?\b/i],
  },
];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isValidCalendarDate(
  year: number,
  month: number,
  day: number
): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const candidate = new Date(year, month - 1, day, 12, 0, 0, 0);

  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  );
}

function createParsedDate(
  year: number,
  month: number,
  day: number
): { specificDate: string; formatted: string } | null {
  if (!isValidCalendarDate(year, month, day)) {
    return null;
  }

  const specificDate = `${year}-${pad2(month)}-${pad2(day)}`;

  return {
    specificDate,
    formatted: formatDateDisplay(specificDate),
  };
}

export function parseSpecificDate(
  question: string
): { specificDate: string; formatted: string } | null {
  const text = question.trim().toLowerCase();

  // 1 August 2026, 01 August 2026, 1st Aug 2026
  const dayMonthYear = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})\b/i
  );

  if (dayMonthYear) {
    const day = Number(dayMonthYear[1]);
    const month = MONTH_MAP[dayMonthYear[2].toLowerCase()];
    const year = Number(dayMonthYear[3]);

    if (!month) {
      return null;
    }

    return createParsedDate(year, month, day);
  }

  // August 1 2026, August 1st, 2026
  const monthDayYear = text.match(
    /\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i
  );

  if (monthDayYear) {
    const month = MONTH_MAP[monthDayYear[1].toLowerCase()];
    const day = Number(monthDayYear[2]);
    const year = Number(monthDayYear[3]);

    if (!month) {
      return null;
    }

    return createParsedDate(year, month, day);
  }

  // South African convention: DD/MM/YYYY
  const dayFirstNumeric = text.match(
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/
  );

  if (dayFirstNumeric) {
    const day = Number(dayFirstNumeric[1]);
    const month = Number(dayFirstNumeric[2]);
    const year = Number(dayFirstNumeric[3]);

    return createParsedDate(year, month, day);
  }

  // YYYY/MM/DD or YYYY-MM-DD
  const yearFirstNumeric = text.match(
    /\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/
  );

  if (yearFirstNumeric) {
    const year = Number(yearFirstNumeric[1]);
    const month = Number(yearFirstNumeric[2]);
    const day = Number(yearFirstNumeric[3]);

    return createParsedDate(year, month, day);
  }

  return null;
}

export function parseDiaryTime(question: string): string | null {
  const match = question.match(
    /\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/
  );

  if (!match) {
    return null;
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function parseCategory(question: string): string | null {
  for (const category of ALLOWED_CATEGORIES) {
    if (category.patterns.some((pattern) => pattern.test(question))) {
      return category.value;
    }
  }

  return null;
}

function cleanExtractedName(value: string): string | null {
  let cleaned = value;

  for (const pattern of DATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }

  cleaned = cleaned
    .replace(RELATIVE_DATE_PATTERN, " ")
    .replace(DIARY_TIME_PATTERN, " ")
    .replace(
      /\b(?:today|yesterday|this|last|on|at|during|for|under|about)\b.*$/i,
      " "
    )
    .replace(/[?!,.;:'"()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  const rejectedValues = new Set([
    "who",
    "whom",
    "by whom",
    "the diary",
    "site diary",
    "the site diary",
    "diary",
    "entry",
    "the entry",
    "person",
    "the person",
    "author",
    "writer",
    "logger",
    "recorder",
  ]);

  if (rejectedValues.has(cleaned.toLowerCase())) {
    return null;
  }

  const words = cleaned.split(" ");

  if (
    words.length < 1 ||
    words.length > 4 ||
    words.some((word) => !/^[\p{L}'’-]+$/u.test(word))
  ) {
    return null;
  }

  return cleaned;
}

export function parseLoggedBy(question: string): string | null {
  /*
   * A logger is extracted only when the wording supplies a person's name.
   *
   * "Who", "whom", "by whom", "author" and similar expressions request the
   * LOGGER target field. They must never become logged_by filter values.
   */
  const patterns: RegExp[] = [
    // When did Pabala Letuka record/log/write/capture something?
    /\bwhen\s+did\s+(.+?)\s+(?:record|log|write|capture|create|enter|note)\b/i,

    // What did Pabala Letuka record?
    /\bwhat\s+did\s+(.+?)\s+(?:record|log|write|capture|create|enter|note)\b/i,

    // Did Pabala Letuka record...?
    /\bdid\s+(.+?)\s+(?:record|log|write|capture|create|enter|note)\b/i,

    // Pabala Letuka recorded/logged/wrote...
    /(?:^|[?!.,]\s*|\bwhat\s+|\bwhen\s+)([\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,3})\s+(?:recorded|logged|wrote|captured|created|entered|noted)\b/iu,

    // Recorded/logged/written/captured by Pabala Letuka
    /\b(?:recorded|logged|written|captured|created|entered|made)\s+by\s+(.+?)(?=\s+(?:on|at|this|last|today|yesterday|under|about|for|during)\b|[?!,.;]|$)/i,

    // Entries from Pabala Letuka
    /\b(?:entries|diaries|logs|records)\s+from\s+(.+?)(?=\s+(?:on|at|this|last|today|yesterday|under|about|for|during)\b|[?!,.;]|$)/i,

    // Pabala Letuka's entries
    /\b([\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,3})['’]s\s+(?:entries|diaries|logs|records)\b/iu,
  ];

  for (const pattern of patterns) {
    const match = question.match(pattern);

    if (!match) {
      continue;
    }

    const candidate = cleanExtractedName(match[1]);

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export function detectTargetField(question: string): TargetField {
  const text = question.trim();

  /*
   * Target-field detection is separate from filter extraction.
   *
   * For example:
   * "Who recorded the excavation on 1 August 2026?"
   *
   * Target: LOGGER
   * Filters: date + details
   *
   * "Who" must never become a logged_by filter.
   */
  if (COUNT_REQUEST_PATTERN.test(text)) {
    return "COUNT";
  }

  if (LOGGER_REQUEST_PATTERN.test(text)) {
    return "LOGGER";
  }

  if (CATEGORY_REQUEST_PATTERN.test(text)) {
    return "CATEGORY";
  }

  if (TIME_REQUEST_PATTERN.test(text)) {
    return "TIME";
  }

  if (DATE_REQUEST_PATTERN.test(text)) {
    return "DATE";
  }

  /*
   * Generic "when" requests the date of the matching Site Diary record.
   *
   * The query formatter can include diary_time when available. This allows:
   *
   * "When did Pabala Letuka record that the site offices were delivered?"
   *
   * to filter by logger and details while returning the date and available
   * time from that exact same row.
   */
  if (WHEN_REQUEST_PATTERN.test(text)) {
    return "DATE";
  }

  if (DETAILS_REQUEST_PATTERN.test(text)) {
    return "DETAILS";
  }

  if (LIST_REQUEST_PATTERN.test(text)) {
    return "LIST";
  }

  return "DETAILS";
}

function removeRecognisedDates(text: string): string {
  let result = text;

  for (const pattern of DATE_PATTERNS) {
    result = result.replace(pattern, " ");
  }

  return result.replace(RELATIVE_DATE_PATTERN, " ");
}

function removeRecognisedCategories(text: string): string {
  let result = text;

  for (const category of ALLOWED_CATEGORIES) {
    for (const pattern of category.patterns) {
      result = result.replace(pattern, " ");
    }
  }

  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseDetailsKeyword(question: string): string | null {
  if (UNSUPPORTED_PATTERN.test(question)) {
    return null;
  }

  let text = question.toLowerCase();

  text = removeRecognisedDates(text);
  text = text.replace(DIARY_TIME_PATTERN, " ");
  text = removeRecognisedCategories(text);

  /*
   * Remove a supplied logger name before extracting a details keyword.
   * This keeps logged_by and details as separate database filters.
   */
  const logger = parseLoggedBy(question);

  if (logger) {
    text = text.replace(
      new RegExp(`\\b${escapeRegExp(logger)}\\b`, "gi"),
      " "
    );
  }

  /*
   * Remove linking language used in "when + name + event" questions while
   * retaining the actual event description.
   *
   * Example:
   * "When did Pabala Letuka record that the site offices were delivered?"
   *
   * Extracted logger:
   * "Pabala Letuka"
   *
   * Extracted details keyword:
   * "site offices delivered"
   *
   * Requested target:
   * DATE
   */
  text = text
    .replace(
      /\b(?:when did|when was|when were|when has|when have)\b/gi,
      " "
    )
    .replace(
      /\b(?:record that|recorded that|log that|logged that|write that|wrote that|capture that|captured that|note that|noted that)\b/gi,
      " "
    )
    .replace(
      /\b(?:has been|have been|had been|was|were|is|are)\b/gi,
      " "
    );

  text = text
    .replace(
      /\b(?:site diaries|site diary|diaries|diary|diary entries|diary entry|site logs|site log)\b/gi,
      " "
    )
    .replace(
      /\b(?:who|whom|what|which|when|where|why|how|whose|by whom)\b/gi,
      " "
    )
    .replace(
      /\b(?:recorded|record|records|recording|logged|log|logs|logging|wrote|written|write|captured|capture|created|create|made|entered|entry|entries|noted|note|notes|author|writer|logger|recorder)\b/gi,
      " "
    )
    .replace(
      /\b(?:details|detail|description|information|content|category|classification|type|kind|date|day|time|person|name)\b/gi,
      " "
    )
    .replace(
      /\b(?:is|are|was|were|be|been|being|did|does|do|has|have|had|the|a|an|that|this|these|those|it|its|of|to|from|for|with|in|on|at|under|about|and|or|please|tell|show|list|give|find|retrieve|me)\b/gi,
      " "
    )
    .replace(/[?!,.;:'"()[\]{}]/g, " ")
    .replace(/[%_*\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text || text.length < 3 || /^\d+$/.test(text)) {
    return null;
  }

  /*
   * The value is restricted to ordinary text characters. It can only be used
   * as a filter value and cannot introduce table names, columns, sort fields,
   * SQL, RPC names or raw PostgREST expressions.
   */
  const safeText = text
    .replace(/[^\p{L}\p{N}\s/'’-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return safeText.length >= 3 ? safeText : null;
}

export function parseDateRange(
  question: string,
  now: Date = new Date()
): DateRangeParam | null {
  const text = question.toLowerCase();

  const formatYMD = (date: Date): string => {
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());

    return `${year}-${month}-${day}`;
  };

  if (/\btoday\b/i.test(text)) {
    const date = formatYMD(now);

    return {
      label: "Today",
      startDate: date,
      endDate: date,
    };
  }

  if (/\byesterday\b/i.test(text)) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const date = formatYMD(yesterday);

    return {
      label: "Yesterday",
      startDate: date,
      endDate: date,
    };
  }

  if (/\bthis week\b/i.test(text)) {
    const current = new Date(now);
    const dayOfWeek = current.getDay();
    const differenceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(current);
    monday.setDate(current.getDate() + differenceToMonday);

    return {
      label: "This Week",
      startDate: formatYMD(monday),
      endDate: formatYMD(current),
    };
  }

  if (/\blast week\b/i.test(text)) {
    const current = new Date(now);
    const dayOfWeek = current.getDay();
    const differenceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const lastMonday = new Date(current);
    lastMonday.setDate(current.getDate() + differenceToMonday - 7);

    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);

    return {
      label: "Last Week",
      startDate: formatYMD(lastMonday),
      endDate: formatYMD(lastSunday),
    };
  }

  if (/\bthis month\b/i.test(text)) {
    const firstDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      12,
      0,
      0,
      0
    );

    return {
      label: "This Month",
      startDate: formatYMD(firstDay),
      endDate: formatYMD(now),
    };
  }

  if (/\blast month\b/i.test(text)) {
    const firstDay = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
      12,
      0,
      0,
      0
    );

    const lastDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      12,
      0,
      0,
      0
    );

    return {
      label: "Last Month",
      startDate: formatYMD(firstDay),
      endDate: formatYMD(lastDay),
    };
  }

  return null;
}

export function normalizeQuestion(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[?!,.;:'"()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type IntentMatch =
  | {
      type: "SITE_DIARY_EXACT_MATCH";
      exactFilters: ExactMatchFilters;
    }
  | {
      type: "SITE_DIARY_DELAYS";
      dateRange: DateRangeParam | null;
    }
  | {
      type: "SITE_DIARY_COUNT";
      dateRange: DateRangeParam | null;
    }
  | {
      type: "SITE_DIARY_RECENT";
      limit: number;
    }
  | {
      type: "SITE_DIARY_DATE_RANGE";
      dateRange: DateRangeParam;
    }
  | {
      type: "UNSUPPORTED";
    };

export function matchIntent(
  question: string,
  now: Date = new Date()
): IntentMatch {
  const normalised = normalizeQuestion(question);

  if (UNSUPPORTED_PATTERN.test(normalised)) {
    return { type: "UNSUPPORTED" };
  }

  const specificDate = parseSpecificDate(question);
  const dateRange = parseDateRange(question, now);
  const diaryTime = parseDiaryTime(question);
  const logCategory = parseCategory(question);
  const loggedBy = parseLoggedBy(question);
  const detailsKeyword = parseDetailsKeyword(question);
  const targetField = detectTargetField(question);

  const isDelayQuestion =
    /\b(?:delay|delays|delayed|stoppage|stoppages|disruption|disruptions)\b/i.test(
      normalised
    );

  const isCountQuestion = targetField === "COUNT";

  const isRecentQuestion =
    RECENT_PATTERN.test(normalised) &&
    DIARY_CONTEXT_PATTERN.test(normalised);

  const hasExactFilter = Boolean(
    specificDate ||
      diaryTime ||
      loggedBy ||
      detailsKeyword ||
      logCategory
  );

  /*
   * The target field and filter fields are deliberately independent.
   *
   * Example:
   * "Who recorded the excavation entry on 1 August 2026?"
   *
   * targetField: LOGGER
   * specificDate: 2026-08-01
   * detailsKeyword: excavation
   * loggedBy: null
   *
   * Example:
   * "When did Pabala Letuka record that the site offices were delivered?"
   *
   * targetField: DATE
   * loggedBy: Pabala Letuka
   * detailsKeyword: site offices delivered
   *
   * queryCatalogue applies the supplied filters to one query using AND logic.
   * The returned target value must be read from each matching row.
   */
  if (hasExactFilter && !isRecentQuestion) {
    const exactFilters: ExactMatchFilters = {
      specificDate: specificDate?.specificDate ?? null,
      specificDateFormatted: specificDate?.formatted ?? null,
      dateRange: specificDate ? null : dateRange,
      diaryTime,
      logCategory,
      loggedBy,
      detailsKeyword,
      hasDelay: isDelayQuestion ? true : null,
      targetField,
    };

    return {
      type: "SITE_DIARY_EXACT_MATCH",
      exactFilters,
    };
  }

  if (isDelayQuestion) {
    return {
      type: "SITE_DIARY_DELAYS",
      dateRange,
    };
  }

  if (isCountQuestion) {
    return {
      type: "SITE_DIARY_COUNT",
      dateRange,
    };
  }

  if (isRecentQuestion) {
    return {
      type: "SITE_DIARY_RECENT",
      limit: 5,
    };
  }

  if (dateRange && DIARY_CONTEXT_PATTERN.test(normalised)) {
    return {
      type: "SITE_DIARY_DATE_RANGE",
      dateRange,
    };
  }

  if (DIARY_CONTEXT_PATTERN.test(normalised)) {
    return {
      type: "SITE_DIARY_RECENT",
      limit: 5,
    };
  }

  return { type: "UNSUPPORTED" };
}

export async function processV2Question(
  question: string,
  companyId: string,
  projectId: string,
  now: Date = new Date()
): Promise<V2QueryResult> {
  const match = matchIntent(question, now);

  switch (match.type) {
    case "SITE_DIARY_EXACT_MATCH":
      return executeSiteDiaryExactMatch({
        companyId,
        projectId,
        exactFilters: match.exactFilters,
      });

    case "SITE_DIARY_DELAYS":
      return executeSiteDiaryDelays({
        companyId,
        projectId,
        dateRange: match.dateRange,
      });

    case "SITE_DIARY_COUNT":
      return executeSiteDiaryCount({
        companyId,
        projectId,
        dateRange: match.dateRange,
      });

    case "SITE_DIARY_RECENT":
      return executeSiteDiaryRecent({
        companyId,
        projectId,
        limit: match.limit,
      });

    case "SITE_DIARY_DATE_RANGE":
      return executeSiteDiaryDateRange({
        companyId,
        projectId,
        dateRange: match.dateRange,
      });

    case "UNSUPPORTED":
    default:
      return {
        intentId: "UNSUPPORTED",
        domain: "site_diaries",
        title: "Question Not Supported by Site Diaries Engine",
        directAnswer:
          "I can answer factual questions about Site Diary dates, times, categories, authors, recorded details, counts and delays.",
        calculationBasis:
          "The question did not match an allow-listed Site Diaries intent.",
        metrics: [],
        evidenceRows: [],
        sourceRoute: "/site-diaries",
        companyId,
        projectId,
        dateRange: null,
        asAt: new Date().toISOString(),
        status: "unsupported",
        suggestedQuestions: [
          "Who recorded the diary on 1 August 2026?",
          "What was recorded on 01/08/2026?",
          "When did Pabala Letuka record that the site offices were delivered?",
          "What time was the site offices delivery recorded?",
          "Which category contains the excavation entry?",
          "What did Pabala Letuka record this month?",
          "How many Progress Updates were recorded this week?",
          "What delays were recorded last month?",
        ],
      };
  }
}
