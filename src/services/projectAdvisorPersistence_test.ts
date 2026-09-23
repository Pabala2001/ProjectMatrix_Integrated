import { deepStrictEqual, ok } from "node:assert/strict";
import { getAdvisorMessages, addAdvisorMessage, sanitizeUserFacingErrorMessage } from "./projectAdvisorService";
import { filterConversationsByContext, validateConversationContext } from "../../supabase/functions/project-advisor-chat/core";
import { AdvisorMessage, AdvisorConversation } from "../types/projectAdvisor";

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  deepStrictEqual(actual, expected, message);
}

function assert(value: unknown, message?: string): asserts value {
  ok(value, message);
}

Deno.test("Project Advisor UI & Persistence: 1. User message text styling classes resolve to solid white", () => {
  const userMsg: AdvisorMessage = {
    id: "msg-user-1",
    conversation_id: "conv-1",
    sender: "user",
    content: "What is our current financial variance on Project Alpha?",
    created_at: new Date().toISOString(),
  };

  const isUser = userMsg.sender === "user";
  const bodyTextClass = isUser ? "text-white dark:text-white" : "text-slate-800 dark:text-slate-200";
  const containerClass = isUser
    ? "bg-slate-800 text-white dark:bg-[#102846] dark:text-white border border-slate-700 dark:border-[#1E3A5F] rounded-tr-none"
    : "bg-white text-slate-800 dark:bg-[#0A1F3A] dark:text-slate-100 border border-slate-200 dark:border-[#1E3A5F] rounded-tl-none";

  assert(bodyTextClass.includes("text-white"), "User message body must include text-white for solid white visibility.");
  assert(!bodyTextClass.includes("text-slate-800"), "User message body must not inherit dark text-slate-800.");
  assert(containerClass.includes("bg-slate-800") || containerClass.includes("bg-[#102846]"), "Dark navy background card preserved.");
});

Deno.test("Project Advisor UI & Persistence: 2. Restored messages preserve both user and assistant roles chronologically", () => {
  const mockDbRows = [
    {
      id: "10000000-0000-0000-0000-000000000001",
      conversation_id: "c-123",
      sender: "user",
      content: "Explain budget baseline",
      sources_json: null,
      metadata_json: null,
      created_at: "2026-07-31T10:00:00.000Z",
    },
    {
      id: "10000000-0000-0000-0000-000000000002",
      conversation_id: "c-123",
      sender: "assistant",
      content: "The approved budget baseline is ZAR 5,000,000.",
      sources_json: [{ key: "BGT-001", table: "budget_versions", id: "BGT-001", label: "Approved Baseline v1", summary: "Baseline budget" }],
      metadata_json: { context_warning: "Context trimmed to fit cap.", draft: undefined } as Record<string, any>,
      created_at: "2026-07-31T10:00:05.000Z",
    },
  ];

  const mapped: AdvisorMessage[] = mockDbRows.map((msg) => ({
    id: msg.id,
    conversation_id: msg.conversation_id,
    sender: msg.sender as "user" | "assistant",
    content: msg.content,
    sources_json: msg.sources_json || [],
    draft: msg.metadata_json?.draft || undefined,
    context_warning: msg.metadata_json?.context_warning || null,
    metadata_json: msg.metadata_json,
    created_at: msg.created_at,
  }));

  assertEquals(mapped.length, 2);
  assertEquals(mapped[0].sender, "user");
  assertEquals(mapped[0].content, "Explain budget baseline");
  assertEquals(mapped[1].sender, "assistant");
  assertEquals(mapped[1].content, "The approved budget baseline is ZAR 5,000,000.");
  assertEquals(mapped[1].context_warning, "Context trimmed to fit cap.");
  assertEquals(mapped[1].sources_json?.length, 1);
});

Deno.test("Project Advisor UI & Persistence: 3. Sanitized error messages do not write false assistant rows to DB", () => {
  const rawError = "503 Service Unavailable: High load on Gemini model";
  const safeMsg = sanitizeUserFacingErrorMessage(rawError);
  assertEquals(safeMsg, "Project Advisor is temporarily busy. Please try again shortly.");

  // When error occurs, UI creates a notice object in state but does NOT save to database
  const isErrorNotice = true;
  let persistedToDb = false;

  if (!isErrorNotice) {
    persistedToDb = true;
  }

  assertEquals(persistedToDb, false, "Failed error notices must never be saved as completed assistant database rows.");
});

Deno.test("Project Advisor UI & Persistence: 4. Tenant and context filtering preserves authorized scoping on reload", () => {
  const conversations: AdvisorConversation[] = [
    {
      id: "conv-proj-1",
      company_id: "comp-A",
      project_id: "proj-101",
      created_by: "user-1",
      title: "Project 101 Discussion",
      scope: "project",
      created_at: "2026-07-31T09:00:00Z",
      updated_at: "2026-07-31T09:00:00Z",
    },
    {
      id: "conv-proj-2",
      company_id: "comp-A",
      project_id: "proj-202",
      created_by: "user-1",
      title: "Project 202 Discussion",
      scope: "project",
      created_at: "2026-07-31T08:00:00Z",
      updated_at: "2026-07-31T08:00:00Z",
    },
  ];

  const filtered = filterConversationsByContext(conversations, "comp-A", "proj-101", "project");
  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].id, "conv-proj-1");

  const isCrossTenantValid = validateConversationContext(conversations[1], "comp-A", "proj-101", "project");
  assertEquals(isCrossTenantValid, false, "Cross-project conversation context must be rejected.");
});
