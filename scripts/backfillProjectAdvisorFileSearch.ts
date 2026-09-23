import { createClient } from "@supabase/supabase-js";

export type SourceKind = "uploaded" | "signed" | "generated";

export const PROJECT_ADVISOR_SOURCE_KINDS: readonly SourceKind[] = [
  "uploaded",
  "signed",
  "generated",
] as const;

export interface CommunicationDocRow {
  id: string;
  company_id: string;
  project_id: string;
  uploaded_file_path?: string | null;
  signed_file_path?: string | null;
  generated_docx_path?: string | null;
}

export interface FileIndexRow {
  id: string;
  company_id: string;
  project_id: string;
  communication_document_id: string;
  source_kind: SourceKind;
  status: "ready" | "unsupported" | "deleting" | "failed" | "indexing" | "pending" | string;
  provider_document_name?: string | null;
}

export interface CandidateItem {
  communicationDocumentId: string;
  sourceKind: SourceKind;
  companyId: string;
  projectId: string;
}

export type CandidateAction =
  | "skip_ready"
  | "skip_unsupported"
  | "report_deleting"
  | "process";

export interface BackfillOptions {
  companyId: string;
  projectId?: string;
  jwt?: string;
  dryRun?: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseClient?: any;
  invokeFunction?: (
    docId: string,
    sourceKind: SourceKind
  ) => Promise<{ success: boolean; status?: string; code?: string; retryable?: boolean }>;
  sleepFn?: (ms: number) => Promise<void>;
  logger?: (msg: string) => void;
  maxProjectConcurrency?: number;
}

export interface BackfillError {
  docId: string;
  sourceKind: SourceKind;
  code: string;
  retryable: boolean;
}

export interface BackfillReport {
  scannedDocuments: number;
  totalCandidates: number;
  skippedReady: number;
  skippedUnsupported: number;
  reportedDeleting: number;
  processedSuccess: number;
  processedFailed: number;
  stoppedOnAuthError: boolean;
  errors: BackfillError[];
}

export class BackfillAuthError extends Error {
  readonly code: string;
  constructor(code: string = "INVALID_AUTHENTICATION") {
    super("Backfill authentication failed or expired.");
    this.name = "BackfillAuthError";
    this.code = code;
  }
}

const BACKOFF_DELAYS_MS = [2000, 4000, 8000];

export function sanitizeLogMessage(msg: string): string {
  if (typeof msg !== "string") return "";
  let clean = msg;
  clean = clean.replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_=]*/gi, "Bearer [REDACTED]");
  clean = clean.replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_=]*/gi, "[REDACTED_JWT]");
  clean = clean.replace(/fileSearchStores\/[A-Za-z0-9-_/]+/gi, "[REDACTED_STORE]");
  clean = clean.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/[^\s,\)\]]+/gi, "[REDACTED_STORAGE_PATH]");
  return clean;
}

export function expandDocumentCandidates(doc: CommunicationDocRow): CandidateItem[] {
  const candidates: CandidateItem[] = [];
  if (doc.uploaded_file_path && doc.uploaded_file_path.trim().length > 0) {
    candidates.push({
      communicationDocumentId: doc.id,
      sourceKind: "uploaded",
      companyId: doc.company_id,
      projectId: doc.project_id,
    });
  }
  if (doc.signed_file_path && doc.signed_file_path.trim().length > 0) {
    candidates.push({
      communicationDocumentId: doc.id,
      sourceKind: "signed",
      companyId: doc.company_id,
      projectId: doc.project_id,
    });
  }
  if (doc.generated_docx_path && doc.generated_docx_path.trim().length > 0) {
    candidates.push({
      communicationDocumentId: doc.id,
      sourceKind: "generated",
      companyId: doc.company_id,
      projectId: doc.project_id,
    });
  }
  return candidates;
}

export function evaluateCandidateAction(
  candidate: CandidateItem,
  existingIndex?: FileIndexRow
): CandidateAction {
  if (!existingIndex) {
    return "process";
  }
  const status = existingIndex.status;
  if (status === "ready") {
    return "skip_ready";
  }
  if (status === "unsupported") {
    return "skip_unsupported";
  }
  if (status === "deleting") {
    return "report_deleting";
  }
  return "process";
}

export async function invokeIndexWithRetry(
  docId: string,
  sourceKind: SourceKind,
  invokeFn: (docId: string, sourceKind: SourceKind) => Promise<{ success: boolean; status?: string; code?: string; retryable?: boolean }>,
  sleepFn: (ms: number) => Promise<void>,
  logger?: (msg: string) => void
): Promise<{ success: boolean; code: string; retryable: boolean }> {
  let attempt = 0;
  while (attempt <= 3) {
    try {
      const res = await invokeFn(docId, sourceKind);
      if (res.success) {
        return { success: true, code: "OK", retryable: false };
      }
      const code = res.code || "INVOCATION_FAILED";
      const retryable = res.retryable ?? false;

      if (code === "AUTHENTICATION_REQUIRED" || code === "INVALID_AUTHENTICATION") {
        throw new BackfillAuthError(code);
      }

      if (!retryable || attempt >= 3) {
        return { success: false, code, retryable };
      }

      const baseDelay = BACKOFF_DELAYS_MS[attempt] || 8000;
      const jitter = Math.floor(Math.random() * 500);
      const delay = baseDelay + jitter;
      if (logger) {
        logger(sanitizeLogMessage(`Retry attempt ${attempt + 1} for ${docId} (${sourceKind}) after ${delay}ms delay (code: ${code})`));
      }
      await sleepFn(delay);
      attempt++;
    } catch (err: any) {
      if (err instanceof BackfillAuthError) {
        throw err;
      }
      const code = err?.code || "NETWORK_ERROR";
      const retryable = err?.retryable ?? false;
      if (!retryable || attempt >= 3) {
        return { success: false, code, retryable };
      }
      const baseDelay = BACKOFF_DELAYS_MS[attempt] || 8000;
      const jitter = Math.floor(Math.random() * 500);
      const delay = baseDelay + jitter;
      await sleepFn(delay);
      attempt++;
    }
  }
  return { success: false, code: "RETRIES_EXHAUSTED", retryable: false };
}

export async function runBackfill(options: BackfillOptions): Promise<BackfillReport> {
  const {
    companyId,
    projectId,
    jwt,
    dryRun = false,
    supabaseUrl = process.env.VITE_SUPABASE_URL || "",
    supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "",
    supabaseClient,
    invokeFunction,
    sleepFn = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    logger = (msg: string) => console.log(sanitizeLogMessage(msg)),
    maxProjectConcurrency = 2,
  } = options;

  const report: BackfillReport = {
    scannedDocuments: 0,
    totalCandidates: 0,
    skippedReady: 0,
    skippedUnsupported: 0,
    reportedDeleting: 0,
    processedSuccess: 0,
    processedFailed: 0,
    stoppedOnAuthError: false,
    errors: [],
  };

  if (!companyId) {
    throw new Error("Missing required companyId parameter.");
  }

  let client = supabaseClient;
  if (!client) {
    const adminJwt = jwt || process.env.PROJECT_ADVISOR_ADMIN_JWT;
    if (!adminJwt) {
      report.stoppedOnAuthError = true;
      throw new BackfillAuthError("AUTHENTICATION_REQUIRED");
    }
    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before running the backfill.");
    client = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${adminJwt}`,
        },
      },
    });
  }

  if (client.auth && typeof client.auth.getUser === "function") {
    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user) {
        report.stoppedOnAuthError = true;
        throw new BackfillAuthError("INVALID_AUTHENTICATION");
      }
    } catch (authErr: any) {
      if (authErr instanceof BackfillAuthError) {
        report.stoppedOnAuthError = true;
        throw authErr;
      }
      if (!supabaseClient) {
        report.stoppedOnAuthError = true;
        throw new BackfillAuthError("INVALID_AUTHENTICATION");
      }
    }
  }

  let docQuery = client
    .from("communication_documents")
    .select("id, company_id, project_id, uploaded_file_path, signed_file_path, generated_docx_path")
    .eq("company_id", companyId);

  if (projectId) {
    docQuery = docQuery.eq("project_id", projectId);
  }

  const { data: docRows, error: docErr } = await docQuery;
  if (docErr) {
    logger(`Error fetching communication_documents: ${docErr.message || docErr}`);
    if (docErr.code === "PGRST301" || docErr.status === 401 || docErr.status === 403) {
      report.stoppedOnAuthError = true;
      throw new BackfillAuthError("INVALID_AUTHENTICATION");
    }
    throw new Error(`Database error querying communication_documents`);
  }

  const docs: CommunicationDocRow[] = docRows || [];
  report.scannedDocuments = docs.length;

  let indexQuery = client
    .from("project_advisor_file_indexes")
    .select("id, company_id, project_id, communication_document_id, source_kind, status, provider_document_name")
    .eq("company_id", companyId);

  if (projectId) {
    indexQuery = indexQuery.eq("project_id", projectId);
  }

  const { data: indexRows, error: indexErr } = await indexQuery;
  if (indexErr) {
    if (indexErr.code === "PGRST301" || indexErr.status === 401 || indexErr.status === 403) {
      report.stoppedOnAuthError = true;
      throw new BackfillAuthError("INVALID_AUTHENTICATION");
    }
    throw new Error(`Database error querying project_advisor_file_indexes`);
  }

  const indexMap = new Map<string, FileIndexRow>();
  for (const idxRow of (indexRows || [])) {
    const key = `${idxRow.communication_document_id}:${idxRow.source_kind}`;
    indexMap.set(key, idxRow);
  }

  const projectQueues = new Map<string, CandidateItem[]>();

  for (const doc of docs) {
    const candidates = expandDocumentCandidates(doc);
    report.totalCandidates += candidates.length;
    for (const cand of candidates) {
      const q = projectQueues.get(cand.projectId) || [];
      q.push(cand);
      projectQueues.set(cand.projectId, q);
    }
  }

  const actualInvoker = invokeFunction || (async (docId: string, sourceKind: SourceKind) => {
    const { data, error } = await client.functions.invoke("project-advisor-file-index", {
      body: {
        action: "index",
        communicationDocumentId: docId,
        sourceKind,
      },
    });
    if (error) {
      const details = error.context?.json ? await error.context.json() : error;
      return {
        success: false,
        code: details?.code || "INVOCATION_FAILED",
        retryable: details?.retryable ?? false,
      };
    }
    if (data?.success === true && (data?.status === "ready" || data?.status === "unsupported" || data?.action === "noop")) {
      return { success: true, status: data.status };
    }
    return {
      success: false,
      code: data?.code || "INVOCATION_FAILED",
      retryable: data?.retryable ?? false,
    };
  });

  const projectIds = Array.from(projectQueues.keys());

  const processProjectQueue = async (projId: string) => {
    const candidates = projectQueues.get(projId) || [];
    for (const cand of candidates) {
      if (report.stoppedOnAuthError) break;

      const key = `${cand.communicationDocumentId}:${cand.sourceKind}`;
      const existing = indexMap.get(key);
      const action = evaluateCandidateAction(cand, existing);

      if (action === "skip_ready") {
        report.skippedReady++;
        continue;
      }
      if (action === "skip_unsupported") {
        report.skippedUnsupported++;
        continue;
      }
      if (action === "report_deleting") {
        report.reportedDeleting++;
        logger(`[DELETING] Candidate document ${cand.communicationDocumentId} (${cand.sourceKind}) is currently in deleting state.`);
        continue;
      }

      if (dryRun) {
        report.processedSuccess++;
        logger(`[DRY-RUN] Would index document: ${cand.communicationDocumentId} (${cand.sourceKind})`);
        continue;
      }

      try {
        const result = await invokeIndexWithRetry(
          cand.communicationDocumentId,
          cand.sourceKind,
          actualInvoker,
          sleepFn,
          logger
        );

        if (result.success) {
          report.processedSuccess++;
        } else {
          report.processedFailed++;
          report.errors.push({
            docId: cand.communicationDocumentId,
            sourceKind: cand.sourceKind,
            code: result.code,
            retryable: result.retryable,
          });
        }
      } catch (err: any) {
        if (err instanceof BackfillAuthError) {
          report.stoppedOnAuthError = true;
          throw err;
        }
        report.processedFailed++;
        report.errors.push({
          docId: cand.communicationDocumentId,
          sourceKind: cand.sourceKind,
          code: err?.code || "UNKNOWN_ERROR",
          retryable: false,
        });
      }
    }
  };

  let queueIndex = 0;
  const poolConcurrency = Math.max(1, Math.min(maxProjectConcurrency, projectIds.length || 1));
  const workers = Array.from({ length: poolConcurrency }, async () => {
    while (queueIndex < projectIds.length && !report.stoppedOnAuthError) {
      const projId = projectIds[queueIndex++];
      await processProjectQueue(projId);
    }
  });

  await Promise.all(workers);

  return report;
}

// CLI entrypoint runner
async function cliMain() {
  const args = process.argv.slice(2);
  let companyId = "";
  let projectId: string | undefined = undefined;
  let dryRun = false;
  let jwt: string | undefined = process.env.PROJECT_ADVISOR_ADMIN_JWT;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--company-id" && i + 1 < args.length) {
      companyId = args[++i];
    } else if (arg.startsWith("--company-id=")) {
      companyId = arg.split("=")[1];
    } else if (arg === "--project-id" && i + 1 < args.length) {
      projectId = args[++i];
    } else if (arg.startsWith("--project-id=")) {
      projectId = arg.split("=")[1];
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--jwt" && i + 1 < args.length) {
      jwt = args[++i];
    } else if (arg.startsWith("--jwt=")) {
      jwt = arg.split("=")[1];
    }
  }

  if (!companyId) {
    console.error("Usage: npx tsx scripts/backfillProjectAdvisorFileSearch.ts --company-id <UUID> [--project-id <UUID>] [--dry-run] [--jwt <TOKEN>]");
    process.exit(1);
  }

  try {
    const report = await runBackfill({
      companyId,
      projectId,
      dryRun,
      jwt,
    });
    console.log("Backfill Summary:", JSON.stringify(report, null, 2));
    if (report.stoppedOnAuthError || report.processedFailed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Backfill failed:", sanitizeLogMessage(err?.message || String(err)));
    process.exit(1);
  }
}

if (
  typeof process !== "undefined" &&
  process.argv &&
  process.argv[1] &&
  process.argv[1].includes("backfillProjectAdvisorFileSearch.ts")
) {
  cliMain();
}
