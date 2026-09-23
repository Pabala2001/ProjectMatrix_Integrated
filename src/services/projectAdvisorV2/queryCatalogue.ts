import { supabase } from "../../lib/supabase";
import {
  CatalogueQueryParams,
  ExactMatchFilters,
  SiteDiarySourceRecord,
  V2QueryResult,
} from "./types";

const SELECT_FIELDS =
  "id, diary_date, diary_time, log_category, details, logged_by, has_delay, delay_reason, attachment_path, created_at";

export function formatDateDisplay(ymdStr: string): string {
  if (!ymdStr) return "";
  const parts = ymdStr.split("-");
  if (parts.length !== 3) return ymdStr;
  const [y, m, d] = parts;
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const mIdx = parseInt(m, 10) - 1;
  const dayNum = parseInt(d, 10);
  if (mIdx >= 0 && mIdx < 12) {
    return `${dayNum} ${monthNames[mIdx]} ${y}`;
  }
  return ymdStr;
}

export async function executeSiteDiaryCount(
  params: CatalogueQueryParams
): Promise<V2QueryResult> {
  const { companyId, projectId, dateRange } = params;

  let query = supabase
    .from("site_diaries")
    .select(SELECT_FIELDS, { count: "exact" })
    .eq("company_id", companyId)
    .eq("project_id", projectId);

  if (dateRange) {
    query = query
      .gte("diary_date", dateRange.startDate)
      .lte("diary_date", dateRange.endDate);
  }

  const { data, count, error } = await query
    .order("diary_date", { ascending: false })
    .order("diary_time", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  const records = (data || []) as SiteDiarySourceRecord[];
  const totalCount = count !== null && count !== undefined ? count : records.length;
  const timeframeLabel = dateRange ? `${dateRange.label} (${dateRange.startDate} to ${dateRange.endDate})` : "All Time";

  return {
    intentId: "SITE_DIARY_COUNT",
    domain: "site_diaries",
    title: "Site Diary Total Count",
    directAnswer:
      totalCount === 0
        ? `There are 0 site diary entries recorded for this project [${timeframeLabel}].`
        : `There are ${totalCount} site diary entry(s) recorded for this project [${timeframeLabel}].`,
    calculationBasis: `Exact database count query on 'site_diaries' table where company_id = '${companyId}' and project_id = '${projectId}'${
      dateRange ? ` and diary_date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'` : ""
    }.`,
    metrics: [
      { label: "Total Diary Entries", value: totalCount },
      { label: "Timeframe Filter", value: timeframeLabel },
    ],
    evidenceRows: records.slice(0, 10),
    sourceRoute: "/site-diaries",
    companyId,
    projectId,
    dateRange: dateRange || null,
    asAt: new Date().toISOString(),
    status: totalCount === 0 ? "empty" : "success",
  };
}

export async function executeSiteDiaryRecent(
  params: CatalogueQueryParams
): Promise<V2QueryResult> {
  const { companyId, projectId, limit = 5 } = params;
  const safeLimit = Math.min(Math.max(1, limit), 20);

  const { data, error } = await supabase
    .from("site_diaries")
    .select(SELECT_FIELDS)
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .order("diary_date", { ascending: false })
    .order("diary_time", { ascending: false, nullsFirst: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  const records = (data || []) as SiteDiarySourceRecord[];
  const count = records.length;

  return {
    intentId: "SITE_DIARY_RECENT",
    domain: "site_diaries",
    title: "Recent Site Diary Entries",
    directAnswer:
      count === 0
        ? "No site diary entries were found for this project."
        : `Retrieved the ${count} most recent site diary entry(s) for this project.`,
    calculationBasis: `Query on 'site_diaries' ordered by diary_date DESC, diary_time DESC with limit = ${safeLimit} for company_id = '${companyId}' and project_id = '${projectId}'.`,
    metrics: [
      { label: "Entries Displayed", value: count },
      { label: "Query Limit", value: safeLimit },
    ],
    evidenceRows: records,
    sourceRoute: "/site-diaries",
    companyId,
    projectId,
    dateRange: null,
    asAt: new Date().toISOString(),
    status: count === 0 ? "empty" : "success",
  };
}

export async function executeSiteDiaryDateRange(
  params: CatalogueQueryParams
): Promise<V2QueryResult> {
  const { companyId, projectId, dateRange } = params;
  if (!dateRange) {
    return executeSiteDiaryRecent(params);
  }

  const { data, error } = await supabase
    .from("site_diaries")
    .select(SELECT_FIELDS)
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .gte("diary_date", dateRange.startDate)
    .lte("diary_date", dateRange.endDate)
    .order("diary_date", { ascending: false })
    .order("diary_time", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  const records = (data || []) as SiteDiarySourceRecord[];
  const count = records.length;
  const timeframeLabel = `${dateRange.label} (${dateRange.startDate} to ${dateRange.endDate})`;

  return {
    intentId: "SITE_DIARY_DATE_RANGE",
    domain: "site_diaries",
    title: `Site Diaries for ${dateRange.label}`,
    directAnswer:
      count === 0
        ? `No site diary entries were recorded for ${timeframeLabel}.`
        : `${count} site diary entry(s) were recorded for ${timeframeLabel}.`,
    calculationBasis: `Filter on 'site_diaries' where diary_date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}' for company_id = '${companyId}' and project_id = '${projectId}'.`,
    metrics: [
      { label: "Diary Entries Found", value: count },
      { label: "Date Range", value: timeframeLabel },
    ],
    evidenceRows: records,
    sourceRoute: "/site-diaries",
    companyId,
    projectId,
    dateRange,
    asAt: new Date().toISOString(),
    status: count === 0 ? "empty" : "success",
  };
}

export async function executeSiteDiaryDelays(
  params: CatalogueQueryParams
): Promise<V2QueryResult> {
  const { companyId, projectId, dateRange } = params;

  let query = supabase
    .from("site_diaries")
    .select(SELECT_FIELDS)
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .eq("has_delay", true);

  if (dateRange) {
    query = query
      .gte("diary_date", dateRange.startDate)
      .lte("diary_date", dateRange.endDate);
  }

  const { data, error } = await query
    .order("diary_date", { ascending: false })
    .order("diary_time", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  const records = (data || []) as SiteDiarySourceRecord[];
  const count = records.length;
  const timeframeLabel = dateRange ? `${dateRange.label} (${dateRange.startDate} to ${dateRange.endDate})` : "All Time";

  return {
    intentId: "SITE_DIARY_DELAYS",
    domain: "site_diaries",
    title: "Site Diary Recorded Delays",
    directAnswer:
      count === 0
        ? `No site delays were recorded for this project [${timeframeLabel}].`
        : `${count} site delay(s) were recorded for this project [${timeframeLabel}].`,
    calculationBasis: `Filter on 'site_diaries' where has_delay = true for company_id = '${companyId}' and project_id = '${projectId}'${
      dateRange ? ` and diary_date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'` : ""
    }.`,
    metrics: [
      { label: "Delays Logged", value: count },
      { label: "Timeframe Filter", value: timeframeLabel },
    ],
    evidenceRows: records,
    sourceRoute: "/site-diaries",
    companyId,
    projectId,
    dateRange: dateRange || null,
    asAt: new Date().toISOString(),
    status: count === 0 ? "empty" : "success",
  };
}

export async function executeSiteDiaryExactMatch(
  params: CatalogueQueryParams
): Promise<V2QueryResult> {
  const { companyId, projectId, exactFilters } = params;
  if (!exactFilters) {
    return executeSiteDiaryRecent(params);
  }

  let query = supabase
    .from("site_diaries")
    .select(SELECT_FIELDS)
    .eq("company_id", companyId)
    .eq("project_id", projectId);

  const appliedFiltersSummary: string[] = [
    `company_id = '${companyId}'`,
    `project_id = '${projectId}'`,
  ];

  if (exactFilters.specificDate) {
    query = query.eq("diary_date", exactFilters.specificDate);
    appliedFiltersSummary.push(`diary_date = '${exactFilters.specificDate}'`);
  } else if (exactFilters.dateRange) {
    query = query
      .gte("diary_date", exactFilters.dateRange.startDate)
      .lte("diary_date", exactFilters.dateRange.endDate);
    appliedFiltersSummary.push(
      `diary_date BETWEEN '${exactFilters.dateRange.startDate}' AND '${exactFilters.dateRange.endDate}'`
    );
  }

  if (exactFilters.diaryTime) {
    query = query.ilike("diary_time", `${exactFilters.diaryTime}%`);
    appliedFiltersSummary.push(`diary_time ILIKE '${exactFilters.diaryTime}%'`);
  }

  if (exactFilters.logCategory) {
    query = query.ilike("log_category", `%${exactFilters.logCategory}%`);
    appliedFiltersSummary.push(`log_category ILIKE '%${exactFilters.logCategory}%'`);
  }

  if (exactFilters.loggedBy) {
    query = query.ilike("logged_by", `%${exactFilters.loggedBy}%`);
    appliedFiltersSummary.push(`logged_by ILIKE '%${exactFilters.loggedBy}%'`);
  }

  if (exactFilters.detailsKeyword) {
    query = query.ilike("details", `%${exactFilters.detailsKeyword}%`);
    appliedFiltersSummary.push(`details ILIKE '%${exactFilters.detailsKeyword}%'`);
  }

  if (exactFilters.hasDelay !== null && exactFilters.hasDelay !== undefined) {
    query = query.eq("has_delay", exactFilters.hasDelay);
    appliedFiltersSummary.push(`has_delay = ${exactFilters.hasDelay}`);
  }

  const { data, error } = await query
    .order("diary_date", { ascending: false })
    .order("diary_time", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  const records = (data || []) as SiteDiarySourceRecord[];
  const count = records.length;
  const basisText = `Database query on 'site_diaries' combining filters [AND]: ${appliedFiltersSummary.join(
    ", "
  )}. Matched ${count} record(s).`;

  if (count === 0) {
    let missingDesc = "Site Diary entry";
    if (exactFilters.detailsKeyword) {
      missingDesc += ` mentioning "${exactFilters.detailsKeyword}"`;
    }
    if (exactFilters.specificDateFormatted || exactFilters.specificDate) {
      missingDesc += ` on ${exactFilters.specificDateFormatted || exactFilters.specificDate}`;
    } else if (exactFilters.dateRange) {
      missingDesc += ` for ${exactFilters.dateRange.label}`;
    }

    return {
      intentId: "SITE_DIARY_EXACT_MATCH",
      domain: "site_diaries",
      title: "Site Diary Exact Match Query",
      directAnswer: `I could not find a ${missingDesc} for this project.`,
      calculationBasis: basisText,
      metrics: [
        { label: "Matches Found", value: 0 },
        { label: "Target Field Requested", value: exactFilters.targetField },
      ],
      evidenceRows: [],
      sourceRoute: "/site-diaries",
      companyId,
      projectId,
      dateRange: exactFilters.dateRange || null,
      asAt: new Date().toISOString(),
      status: "empty",
    };
  }

  if (count === 1) {
    const row = records[0];
    const dateFormatted = formatDateDisplay(row.diary_date);
    const timeFormatted = row.diary_time ? row.diary_time.slice(0, 5) : null;

    let directAnswer = "";

    switch (exactFilters.targetField) {
      case "COUNT":
        directAnswer = "I found one matching Site Diary entry.";
        break;

      case "LIST":
        directAnswer =
          `I found one matching Site Diary entry. On ${dateFormatted}, ` +
          `${row.logged_by || "a site agent"} recorded ${row.log_category}: ` +
          `“${row.details}”`;
        break;

      case "TIME":
        if (timeFormatted) {
          directAnswer = `The entry stating that ${row.details} was recorded at ${timeFormatted}${
            dateFormatted ? ` on ${dateFormatted}` : ""
          }.`;
        } else {
          directAnswer = `The entry stating that ${row.details} on ${dateFormatted} has no specific time recorded.`;
        }
        break;

      case "LOGGER":
        if (exactFilters.detailsKeyword) {
          directAnswer = `${row.logged_by || "A site agent"} recorded the entry mentioning ${exactFilters.detailsKeyword} on ${dateFormatted}.`;
        } else {
          directAnswer = `${row.logged_by || "A site agent"} recorded that ${row.details}.`;
        }
        break;

      case "CATEGORY":
        directAnswer = `The entry stating that ${row.details} was recorded under ${row.log_category}.`;
        break;

      case "DATE": {
        const timeText = timeFormatted ? ` at ${timeFormatted}` : "";
        directAnswer =
          `${row.logged_by || "A site agent"} recorded the matching Site Diary ` +
          `entry on ${dateFormatted}${timeText}.`;
        break;
      }

      case "DETAILS":
      default:
        if (exactFilters.loggedBy && timeFormatted && exactFilters.specificDate) {
          directAnswer = `At ${timeFormatted} on ${dateFormatted}, ${row.logged_by} recorded that ${row.details}.`;
        } else if (exactFilters.loggedBy && exactFilters.specificDate) {
          directAnswer = `On ${dateFormatted}, ${row.logged_by} recorded a ${row.log_category} stating that ${row.details}.`;
        } else if (timeFormatted && exactFilters.specificDate) {
          directAnswer = `At ${timeFormatted} on ${dateFormatted}, ${row.logged_by || "a site agent"} recorded a ${row.log_category} stating that ${row.details}.`;
        } else {
          directAnswer = `One Site Diary entry was recorded on ${dateFormatted}. ${row.logged_by || "A site agent"} recorded a ${row.log_category} stating that ${row.details}.`;
        }
        break;
    }

    return {
      intentId: "SITE_DIARY_EXACT_MATCH",
      domain: "site_diaries",
      title: "Site Diary Record Match",
      directAnswer,
      calculationBasis: basisText,
      metrics: [
        { label: "Matches Found", value: 1 },
        { label: "Logged By", value: row.logged_by || "N/A" },
        { label: "Category", value: row.log_category },
        { label: "Date", value: dateFormatted },
      ],
      evidenceRows: records,
      sourceRoute: "/site-diaries",
      companyId,
      projectId,
      dateRange: exactFilters.dateRange || null,
      asAt: new Date().toISOString(),
      status: "success",
    };
  }

  if (exactFilters.targetField === "COUNT") {
    return {
      intentId: "SITE_DIARY_EXACT_MATCH",
      domain: "site_diaries",
      title: "Matching Site Diary Entries",
      directAnswer: `I found ${count} matching Site Diary ${
        count === 1 ? "entry" : "entries"
      }.`,
      calculationBasis: basisText,
      metrics: [{ label: "Matches Found", value: count }],
      evidenceRows: records,
      sourceRoute: "/site-diaries",
      companyId,
      projectId,
      dateRange: exactFilters.dateRange || null,
      asAt: new Date().toISOString(),
      status: "success",
    };
  }

  if (exactFilters.targetField === "DATE") {
    const matchingDates = records.map((row) => {
      const date = formatDateDisplay(row.diary_date);
      const time = row.diary_time ? ` at ${row.diary_time.slice(0, 5)}` : "";
      return `${date}${time}`;
    });

    return {
      intentId: "SITE_DIARY_EXACT_MATCH",
      domain: "site_diaries",
      title: `Matching Site Diary Dates (${count})`,
      directAnswer:
        `I found ${count} matching Site Diary entries. They were recorded on: ` +
        `${matchingDates.join(", ")}.`,
      calculationBasis: basisText,
      metrics: [
        { label: "Matches Found", value: count },
        { label: "Matching Dates", value: matchingDates.join(", ") },
      ],
      evidenceRows: records,
      sourceRoute: "/site-diaries",
      companyId,
      projectId,
      dateRange: exactFilters.dateRange || null,
      asAt: new Date().toISOString(),
      status: "success",
    };
  }

  if (exactFilters.targetField === "LIST") {
    return {
      intentId: "SITE_DIARY_EXACT_MATCH",
      domain: "site_diaries",
      title: `Matching Site Diary Entries (${count})`,
      directAnswer: `I found ${count} matching Site Diary entries.`,
      calculationBasis: basisText,
      metrics: [{ label: "Matches Found", value: count }],
      evidenceRows: records,
      sourceRoute: "/site-diaries",
      companyId,
      projectId,
      dateRange: exactFilters.dateRange || null,
      asAt: new Date().toISOString(),
      status: "success",
    };
  }

  // Multiple matches (count > 1)
  // Check if target field values are uniform across all matches
  let allTargetValuesSame = false;
  let sharedValue = "";

  if (exactFilters.targetField === "LOGGER") {
    const firstLogger = records[0].logged_by;
    if (records.every((r) => r.logged_by === firstLogger)) {
      allTargetValuesSame = true;
      sharedValue = firstLogger;
    }
  } else if (exactFilters.targetField === "CATEGORY") {
    const firstCat = records[0].log_category;
    if (records.every((r) => r.log_category === firstCat)) {
      allTargetValuesSame = true;
      sharedValue = firstCat;
    }
  }

  if (allTargetValuesSame) {
    const targetLabel = exactFilters.targetField === "LOGGER" ? "logged by" : "recorded under";
    return {
      intentId: "SITE_DIARY_EXACT_MATCH",
      domain: "site_diaries",
      title: `Multiple Matching Site Diary Entries (${count})`,
      directAnswer: `All ${count} matching Site Diary entries were ${targetLabel} ${sharedValue}.`,
      calculationBasis: basisText,
      metrics: [
        { label: "Matches Found", value: count },
        { label: "Shared Result", value: sharedValue },
      ],
      evidenceRows: records,
      sourceRoute: "/site-diaries",
      companyId,
      projectId,
      dateRange: exactFilters.dateRange || null,
      asAt: new Date().toISOString(),
      status: "success",
    };
  }

  // Target values differ -> produce clarification request
  const distinctTimesOrCats = records
    .slice(0, 5)
    .map(
      (r) =>
        `${r.diary_time ? r.diary_time.slice(0, 5) : "no time"} (${r.log_category} by ${r.logged_by || "agent"})`
    )
    .join(", ");

  const datePhrase = exactFilters.specificDateFormatted || exactFilters.specificDate || (exactFilters.dateRange ? exactFilters.dateRange.label : "selected criteria");
  const keywordPhrase = exactFilters.detailsKeyword ? ` mentioning "${exactFilters.detailsKeyword}"` : "";

  return {
    intentId: "SITE_DIARY_EXACT_MATCH",
    domain: "site_diaries",
    title: `Clarification Required: ${count} Matching Entries Found`,
    directAnswer: `I found ${count} entries${keywordPhrase} on ${datePhrase}, recorded at: ${distinctTimesOrCats}. Please specify the time, category or logger of the entry you mean.`,
    calculationBasis: basisText,
    metrics: [
      { label: "Matches Found", value: count },
      { label: "Clarification Needed", value: "Yes" },
    ],
    evidenceRows: records,
    sourceRoute: "/site-diaries",
    companyId,
    projectId,
    dateRange: exactFilters.dateRange || null,
    asAt: new Date().toISOString(),
    status: "success",
  };
}
