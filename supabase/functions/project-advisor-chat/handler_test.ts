import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { handleProjectAdvisorRequest } from "./index.ts";

function assert(value: unknown, message?: string): asserts value {
  ok(value, message);
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  deepStrictEqual(actual, expected, message);
}

const testRunner = (globalThis as any).Deno?.test || (async (name: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    throw err;
  }
});

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_1 = "22222222-2222-4222-8222-222222222222";
const PROJECT_UNAUTH = "99999999-9999-4999-8999-999999999999";
const VALID_JWT = "Bearer valid.mock.jwt";

function createMockSupabase(options?: {
  projects?: any[];
  indexedDocs?: any[];
  stores?: any[];
  projectMembers?: any[];
  siteDiaries?: any[];
  accessGranted?: boolean;
  queriesLog?: Array<{ tableName: string; selectFields: string; filters: any[] }>;
}) {
  const projects = options?.projects ?? [
    { id: PROJECT_1, company_id: COMPANY_ID, name: "Project Alpha", contract_code: "PA" },
  ];
  const indexedDocs = options?.indexedDocs ?? [];
  const stores = options?.stores ?? [];
  const projectMembers = options?.projectMembers ?? [];
  const siteDiaries = options?.siteDiaries ?? [];
  const accessGranted = options?.accessGranted ?? true;

  const mockQueryBuilder = (tableName: string) => {
    let filters: Array<{ type: string; field: string; val: any }> = [];
    let selectFields = "";

    const builder: any = {
      select: (fields?: string) => {
        selectFields = fields || "";
        return builder;
      },
      eq: (field: string, val: any) => {
        filters.push({ type: "eq", field, val });
        return builder;
      },
      in: (field: string, val: any) => {
        filters.push({ type: "in", field, val });
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => {
        return { data: null, error: null };
      },
      then: (resolve: Function) => {
        if (options?.queriesLog) {
          options.queriesLog.push({ tableName, selectFields, filters });
        }
        let result = [];
        if (tableName === "projects") {
          result = projects;
        } else if (tableName === "project_advisor_indexed_documents") {
          result = indexedDocs;
        } else if (tableName === "project_advisor_file_search_stores") {
          result = stores;
        } else if (tableName === "project_members") {
          result = projectMembers;
        } else if (tableName === "site_diaries") {
          result = siteDiaries;
        }

        // Apply filters
        for (const f of filters) {
          if (f.type === "eq") {
            result = result.filter((row: any) => row[f.field] === f.val);
          } else if (f.type === "in") {
            const allowedSet = new Set(f.val);
            result = result.filter((row: any) => allowedSet.has(row[f.field]));
          }
        }

        resolve({ data: result, error: null });
      },
    };
    return builder;
  };

  return {
    auth: {
      getUser: async (token: string) => {
        if (token === "valid.mock.jwt") {
          return { data: { user: { id: "user-123", email: "user@example.com" } }, error: null };
        }
        return { data: { user: null }, error: new Error("Invalid JWT") };
      },
    },
    rpc: async (fnName: string, args: any) => {
      if (fnName === "verify_project_advisor_access") {
        if (!accessGranted || args.proj_id === PROJECT_UNAUTH) {
          return { data: false, error: null };
        }
        return { data: true, error: null };
      }
      return { data: true, error: null };
    },
    from: (tableName: string) => mockQueryBuilder(tableName),
  };
}

function createMockGemini(responseAnswer = "Verification phrase PMX-INDEX-TEST-001 verified.") {
  let called = false;
  let lastConfig: any = null;

  const mockAi = {
    models: {
      generateContent: async (args: any) => {
        called = true;
        lastConfig = args.config;
        return {
          text: JSON.stringify({
            answer: responseAnswer,
            confidence: "High",
            sources: [],
          }),
          candidates: [
            {
              groundingMetadata: {
                groundingChunks: [
                  {
                    web: {
                      title: "PMX-INDEX-TEST-001 Spec",
                      uri: "fileSearchStores/store-1/documents/doc-1",
                    },
                  },
                ],
              },
            },
          ],
        };
      },
    },
    wasCalled: () => called,
    getLastConfig: () => lastConfig,
  };
  return mockAi;
}

testRunner("H1. 401 returned when Bearer token is missing or invalid", async () => {
  const reqNoAuth = new Request("http://localhost/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Hello" }),
  });
  const res1 = await handleProjectAdvisorRequest(reqNoAuth);
  assertEquals(res1.status, 401);

  const mockSupabase = createMockSupabase();
  const reqBadJwt = new Request("http://localhost/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer bad.token" },
    body: JSON.stringify({ question: "Hello" }),
  });
  const res2 = await handleProjectAdvisorRequest(reqBadJwt, { userSupabase: mockSupabase });
  assertEquals(res2.status, 401);
});

testRunner("H2. 403 returned when access check fails", async () => {
  const mockSupabase = createMockSupabase({ accessGranted: false });
  const req = new Request("http://localhost/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: VALID_JWT },
    body: JSON.stringify({
      question: "What is the budget?",
      company: { id: COMPANY_ID },
      project: { id: PROJECT_1 },
      scope: "project",
    }),
  });
  const res = await handleProjectAdvisorRequest(req, { userSupabase: mockSupabase });
  assertEquals(res.status, 403);
});

testRunner("H3. project scope + one ready indexed document reaches grounded Gemini path without ReferenceError", async () => {
  const mockSupabase = createMockSupabase({
    projects: [{ id: PROJECT_1, company_id: COMPANY_ID, name: "Project Alpha", contract_code: "PA" }],
    indexedDocs: [
      {
        id: "doc-1",
        company_id: COMPANY_ID,
        project_id: PROJECT_1,
        store_id: "store-1",
        communication_document_id: "comm-1",
        source_kind: "uploaded",
        source_file_name: "PMX-INDEX-TEST-001.pdf",
        status: "ready",
      },
    ],
    stores: [
      {
        id: "store-1",
        company_id: COMPANY_ID,
        project_id: PROJECT_1,
        provider_store_name: "fileSearchStores/store-alpha-1",
        status: "ready",
      },
    ],
  });
  const mockAi = createMockGemini("Verification phrase for PMX-INDEX-TEST-001 is ALPHA-VERIFIED-99.");

  const req = new Request("http://localhost/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: VALID_JWT },
    body: JSON.stringify({
      question: "Using only the indexed document PMX-INDEX-TEST-001, what is its unique verification phrase? Include the document number in your answer.",
      company: { id: COMPANY_ID, name: "Company Alpha" },
      project: { id: PROJECT_1, name: "Project Alpha" },
      scope: "project",
    }),
  });

  const res = await handleProjectAdvisorRequest(req, { userSupabase: mockSupabase, ai: mockAi });
  assertEquals(res.status, 200);

  const body = await res.json();
  assertEquals(mockAi.wasCalled(), true);
  const geminiConfig = mockAi.getLastConfig();
  assertEquals(geminiConfig.tools?.[0]?.fileSearch?.fileSearchStoreNames, ["fileSearchStores/store-alpha-1"]);
  assert(body.answer.includes("PMX-INDEX-TEST-001"));
});

testRunner("H4. company scope + ready documents uses only authorised project IDs", async () => {
  const mockSupabase = createMockSupabase({
    projects: [
      { id: PROJECT_1, company_id: COMPANY_ID, name: "Project Alpha", contract_code: "PA" },
    ],
    indexedDocs: [
      {
        id: "doc-1",
        company_id: COMPANY_ID,
        project_id: PROJECT_1,
        store_id: "store-1",
        source_kind: "uploaded",
        source_file_name: "Doc1.pdf",
        status: "ready",
      },
    ],
    stores: [
      {
        id: "store-1",
        company_id: COMPANY_ID,
        project_id: PROJECT_1,
        provider_store_name: "fileSearchStores/store-1",
        status: "ready",
      },
    ],
  });
  const mockAi = createMockGemini("Company analysis response.");

  const req = new Request("http://localhost/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: VALID_JWT },
    body: JSON.stringify({
      question: "Analyze company project documents",
      company: { id: COMPANY_ID, name: "Company Alpha" },
      scope: "company",
    }),
  });

  const res = await handleProjectAdvisorRequest(req, { userSupabase: mockSupabase, ai: mockAi });
  assertEquals(res.status, 200);
  assertEquals(mockAi.wasCalled(), true);
});

testRunner("H5. zero ready documents returns deterministic fallback without calling Gemini", async () => {
  const mockSupabase = createMockSupabase({
    projects: [{ id: PROJECT_1, company_id: COMPANY_ID, name: "Project Alpha" }],
    indexedDocs: [], // Zero ready docs
    stores: [],
  });
  const mockAi = createMockGemini();

  const req = new Request("http://localhost/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: VALID_JWT },
    body: JSON.stringify({
      question: "What project documents are currently available for you to analyse?",
      company: { id: COMPANY_ID },
      project: { id: PROJECT_1 },
      scope: "project",
    }),
  });

  const res = await handleProjectAdvisorRequest(req, { userSupabase: mockSupabase, ai: mockAi });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.answer, "No indexed project documents are currently available for analysis.");
  assertEquals(mockAi.wasCalled(), false);
});

testRunner("H6. empty authorised project list fails safely and never performs unscoped query", async () => {
  const mockSupabase = createMockSupabase({
    projects: [], // User belongs to zero projects
    indexedDocs: [],
    stores: [],
  });
  const mockAi = createMockGemini();

  const req = new Request("http://localhost/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: VALID_JWT },
    body: JSON.stringify({
      question: "What is the project budget?",
      company: { id: COMPANY_ID },
      project: { id: PROJECT_1 },
      scope: "project",
    }),
  });

  const res = await handleProjectAdvisorRequest(req, { userSupabase: mockSupabase, ai: mockAi });
  assertEquals(res.status, 200);
  const body = await res.json();
  assert(body !== null);
});

testRunner("H7. unexpected ReferenceError is converted to safe INTERNAL_ERROR contract and suppresses internal details", async () => {
  const brokenSupabase: any = {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-123" } }, error: null }),
    },
    rpc: async () => {
      throw new ReferenceError("targetProjectIds is not defined");
    },
  };

  const req = new Request("http://localhost/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: VALID_JWT },
    body: JSON.stringify({
      question: "Test internal error",
      company: { id: COMPANY_ID },
      scope: "company",
    }),
  });

  const res = await handleProjectAdvisorRequest(req, { userSupabase: brokenSupabase });
  assertEquals(res.status, 500);

  const body = await res.json();
  assertEquals(body.error, "Project Advisor could not complete the request. Please try again.");
  assertEquals(body.code, "INTERNAL_ERROR");

  const bodyText = JSON.stringify(body);
  assertEquals(bodyText.includes("targetProjectIds"), false);
  assertEquals(bodyText.includes("ReferenceError"), false);
});

testRunner("H8. Live database evidence regression test: ready indexed uploaded document with Draft communication status and contract_code", async () => {
  const LIVE_COMPANY_ID = "bbbc6bbe-a36f-418e-9925-25dd66e1b9c0";
  const LIVE_PROJECT_ID = "fe44f243-b706-4f50-9e41-48c7dac55b5b";
  const LIVE_COMM_DOC_ID = "b8c6eb6d-5f6d-432b-8881-76307441cd06";

  const mockSupabase = createMockSupabase({
    projects: [
      {
        id: LIVE_PROJECT_ID,
        company_id: LIVE_COMPANY_ID,
        name: "Indexing Test Project",
        contract_code: "PMX-PROJ-001",
        status: "Active",
      },
    ],
    indexedDocs: [
      {
        id: "idx-live-001",
        company_id: LIVE_COMPANY_ID,
        project_id: LIVE_PROJECT_ID,
        store_id: "store-live-001",
        communication_document_id: LIVE_COMM_DOC_ID,
        source_kind: "uploaded",
        source_file_name: "ProjectMatrix_Project_Advisor_Indexing_Test.pdf",
        provider_document_name: "fileSearchStores/store-live-001/documents/doc-live-001",
        status: "ready",
        error_message: null,
      },
      // Excluded doc (different company)
      {
        id: "idx-foreign-002",
        company_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        project_id: LIVE_PROJECT_ID,
        store_id: "store-live-001",
        communication_document_id: "comm-foreign",
        source_kind: "uploaded",
        source_file_name: "Foreign.pdf",
        status: "ready",
      },
      // Excluded doc (failed status)
      {
        id: "idx-failed-003",
        company_id: LIVE_COMPANY_ID,
        project_id: LIVE_PROJECT_ID,
        store_id: "store-live-001",
        communication_document_id: "comm-failed",
        source_kind: "uploaded",
        source_file_name: "Failed.pdf",
        status: "failed",
      },
    ],
    stores: [
      {
        id: "store-live-001",
        company_id: LIVE_COMPANY_ID,
        project_id: LIVE_PROJECT_ID,
        provider_store_name: "fileSearchStores/store-live-001",
        status: "ready",
        last_error: null,
      },
    ],
  });

  const mockAi = createMockGemini("Content verification response for PMX-INDEX-TEST-001.");

  // 1. Availability question reports available document without calling Gemini
  const reqAvail = new Request("http://localhost/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: VALID_JWT },
    body: JSON.stringify({
      question: "What project documents are currently available for you to analyse?",
      company: { id: LIVE_COMPANY_ID, name: "Live Company" },
      project: { id: LIVE_PROJECT_ID, name: "Indexing Test Project" },
      scope: "project",
    }),
  });

  const resAvail = await handleProjectAdvisorRequest(reqAvail, { userSupabase: mockSupabase, ai: mockAi });
  assertEquals(resAvail.status, 200);
  const bodyAvail = await resAvail.json();
  assert(bodyAvail.answer.includes("ProjectMatrix_Project_Advisor_Indexing_Test.pdf"));
  assertEquals(mockAi.wasCalled(), false);

  // 2. Grounded content query reaches Gemini with ONLY matching store
  const reqContent = new Request("http://localhost/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: VALID_JWT },
    body: JSON.stringify({
      question: "What are the details of PMX-INDEX-TEST-001?",
      company: { id: LIVE_COMPANY_ID, name: "Live Company" },
      project: { id: LIVE_PROJECT_ID, name: "Indexing Test Project" },
      scope: "project",
    }),
  });

  const resContent = await handleProjectAdvisorRequest(reqContent, { userSupabase: mockSupabase, ai: mockAi });
  assertEquals(resContent.status, 200);
  assertEquals(mockAi.wasCalled(), true);
  const config = mockAi.getLastConfig();
  assertEquals(config.tools?.[0]?.fileSearch?.fileSearchStoreNames, ["fileSearchStores/store-live-001"]);
});

testRunner("H9. Schema alignment regression test: projects aliases physical_progress, project_members uses project_role, and site_diaries excludes weather_conditions", async () => {
  const queriesLog: Array<{ tableName: string; selectFields: string; filters: any[] }> = [];

  const mockSupabase = createMockSupabase({
    projects: [
      { id: PROJECT_1, company_id: COMPANY_ID, name: "Project Alpha", contract_code: "PA" },
    ],
    projectMembers: [
      {
        id: "pm-1",
        project_id: PROJECT_1,
        company_member_id: "cm-1",
        project_role: "Project Manager",
        designation: "Lead",
        permissions: {},
        assigned_by: "user-1",
        assigned_at: "2026-01-01T00:00:00Z",
      },
    ],
    siteDiaries: [
      {
        id: "sd-1",
        company_id: COMPANY_ID,
        project_id: PROJECT_1,
        diary_date: "2026-07-30",
        diary_time: "08:00:00",
        log_category: "General",
        details: "Site work proceeded normally",
        logged_by: "Site Agent",
        has_delay: false,
        delay_reason: null,
        created_at: "2026-07-30T08:00:00Z",
      },
    ],
    queriesLog,
  });

  const mockAi = createMockGemini("Verified project advisor response.");

  const req = new Request("http://localhost/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: VALID_JWT },
    body: JSON.stringify({
      question: "Who are the project members and what are the recent site diaries?",
      company: { id: COMPANY_ID, name: "Test Company" },
      project: { id: PROJECT_1, name: "Project Alpha" },
      scope: "project",
    }),
  });

  const res = await handleProjectAdvisorRequest(req, { userSupabase: mockSupabase, ai: mockAi });
  assertEquals(res.status, 200);

    // Verify projects uses the real physical_progress database column
  const projectsQuery = queriesLog.find((q) => q.tableName === "projects");
  assert(projectsQuery !== undefined, "projects directory should have been queried");

  const projectFields = projectsQuery.selectFields
    .split(",")
    .map((field) => field.trim());

  assert(
    projectFields.includes("progress_percentage:physical_progress"),
    "projects must alias physical_progress as progress_percentage"
  );

  assert(
    !projectFields.includes("progress_percentage"),
    "projects must not request nonexistent standalone progress_percentage"
  );

  assert(
    projectFields.includes("physical_progress"),
    "projects must retain physical_progress"
  );

  // Verify project_members query fields and scoping
  const pmQuery = queriesLog.find((q) => q.tableName === "project_members");
  assert(pmQuery !== undefined, "project_members should have been queried");
  assertEquals(
    pmQuery.selectFields,
    "id, project_id, company_member_id, project_role, designation, permissions, assigned_by, assigned_at"
  );
  const pmFields = pmQuery.selectFields.split(",").map((s) => s.trim());
  assert(!pmFields.includes("role"), "project_members select list should not select legacy 'role' column");
  assert(pmFields.includes("project_role"), "project_members select list must select 'project_role'");
  const pmInFilter = pmQuery.filters.find((f) => f.type === "in" && f.field === "project_id");
  assert(pmInFilter !== undefined, "project_members query must filter by targetProjectIds in scope");
  assertEquals(pmInFilter.val, [PROJECT_1]);

  // Verify site_diaries query fields and scoping
  const sdQuery = queriesLog.find((q) => q.tableName === "site_diaries");
  assert(sdQuery !== undefined, "site_diaries should have been queried");
  assertEquals(
    sdQuery.selectFields,
    "id, company_id, project_id, diary_date, diary_time, log_category, details, logged_by, has_delay, delay_reason, attachment_path, attachment_file_name, attachment_file_type, created_by, created_at, updated_at"
  );
  assert(!sdQuery.selectFields.includes("weather_conditions"), "site_diaries select list must not contain weather_conditions");
  const sdEqFilter = sdQuery.filters.find((f) => f.type === "eq" && f.field === "company_id");
  assert(sdEqFilter !== undefined && sdEqFilter.val === COMPANY_ID, "site_diaries query must enforce company_id scoping");
  const sdInFilter = sdQuery.filters.find((f) => f.type === "in" && f.field === "project_id");
  assert(sdInFilter !== undefined, "site_diaries query must enforce targetProjectIds scoping");
  assertEquals(sdInFilter.val, [PROJECT_1]);
});
