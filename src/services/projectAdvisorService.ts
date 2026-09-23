import { assertOperationalAction } from "../integration/operationalAccess";
import { supabase } from "../lib/supabase";
import {
  AdvisorConversation,
  AdvisorMessage,
  AdvisorDraft,
  AdvisorScope,
  AdvisorChatRequest,
  AdvisorChatResponse,
} from "../types/projectAdvisor";

// Fetch past conversations for active company/project created by current user
export async function getAdvisorConversations(
  companyId: string,
  projectId?: string | null,
  scope?: AdvisorScope | string
): Promise<AdvisorConversation[]> {
  if (!companyId) return [];

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return [];

  try {
    let query = supabase
      .from("project_advisor_conversations")
      .select("*")
      .eq("company_id", companyId)
      .eq("created_by", session.user.id)
      .order("updated_at", { ascending: false });

    if (scope === "company") {
      query = query.eq("scope", "company");
    } else if (projectId) {
      query = query.or(`project_id.eq.${projectId},project_id.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching advisor conversations:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Exception in getAdvisorConversations:", err);
    return [];
  }
}

// Create a new conversation thread for authenticated user
export async function createAdvisorConversation(
  companyId: string,
  projectId: string | null,
  userId: string,
  title: string,
  scope: AdvisorScope = "project"
): Promise<AdvisorConversation | null> {
    assertOperationalAction("create", "services/projectAdvisorService.ts");
  if (!companyId) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  const authenticatedUserId = session.user.id;

  try {
    const payload = {
      company_id: companyId,
      project_id: scope === "project" ? projectId : null,
      created_by: authenticatedUserId,
      title: title || "New Advisor Chat",
      scope: scope,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("project_advisor_conversations")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error creating advisor conversation:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Exception in createAdvisorConversation:", err);
    return null;
  }
}

// Delete a conversation thread owned by authenticated user
export async function deleteAdvisorConversation(conversationId: string): Promise<boolean> {
    assertOperationalAction("delete", "services/projectAdvisorService.ts");
  if (!conversationId) return false;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return false;

  try {
    const { error } = await supabase
      .from("project_advisor_conversations")
      .delete()
      .eq("id", conversationId)
      .eq("created_by", session.user.id);

    if (error) {
      console.error("Error deleting advisor conversation:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Exception in deleteAdvisorConversation:", err);
    return false;
  }
}

// Fetch messages for a conversation owned by authenticated user
export async function getAdvisorMessages(conversationId: string): Promise<AdvisorMessage[]> {
  if (!conversationId) return [];

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return [];

  try {
    // Verify user owns the conversation first
    const { data: conv, error: convError } = await supabase
      .from("project_advisor_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("created_by", session.user.id)
      .maybeSingle();

    if (convError || !conv) {
      if (convError) console.error("Error checking conversation ownership:", convError);
      return [];
    }

    const { data, error } = await supabase
      .from("project_advisor_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error("Error fetching advisor messages:", error);
      return [];
    }

    return (data || []).map((msg: any) => ({
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender: msg.sender,
      content: msg.content,
      sources_json: msg.sources_json || [],
      draft: msg.metadata_json?.draft || undefined,
      context_warning: msg.metadata_json?.context_warning || null,
      metadata_json: msg.metadata_json,
      created_at: msg.created_at,
    }));
  } catch (err) {
    console.error("Exception in getAdvisorMessages:", err);
    return [];
  }
}

// Add a message to a conversation owned by authenticated user
export async function addAdvisorMessage(
  conversationId: string,
  sender: "user" | "assistant" | "system",
  content: string,
  sources?: any[],
  draft?: AdvisorDraft,
  contextWarning?: string | null
): Promise<AdvisorMessage | null> {
    assertOperationalAction("create", "services/projectAdvisorService.ts");
  if (!conversationId) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  try {
    // Verify user owns the conversation
    const { data: conv, error: convError } = await supabase
      .from("project_advisor_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("created_by", session.user.id)
      .maybeSingle();

    if (convError || !conv) {
      if (convError) console.error("Error checking conversation ownership:", convError);
      return null;
    }

    const metadata: Record<string, any> = {};
    if (draft) {
      metadata.draft = draft;
    }
    if (contextWarning) {
      metadata.context_warning = contextWarning;
    }

    const payload = {
      conversation_id: conversationId,
      sender: sender,
      content: content,
      sources_json: sources || null,
      metadata_json: Object.keys(metadata).length > 0 ? metadata : null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("project_advisor_messages")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error saving advisor message:", error);
      return null;
    }

    // Touch conversation updated_at
    await supabase
      .from("project_advisor_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("created_by", session.user.id);

    return {
      id: data.id,
      conversation_id: data.conversation_id,
      sender: data.sender,
      content: data.content,
      sources_json: data.sources_json || [],
      draft: draft,
      context_warning: contextWarning || null,
      metadata_json: data.metadata_json,
      created_at: data.created_at,
    };
  } catch (err) {
    console.error("Exception in addAdvisorMessage:", err);
    return null;
  }
}

// Save document draft for authenticated user
export async function saveAdvisorDraft(
  draft: AdvisorDraft,
  companyId: string,
  userId: string,
  projectId?: string | null
): Promise<AdvisorDraft | null> {
    assertOperationalAction("write", "services/projectAdvisorService.ts");
  if (!companyId) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  const authenticatedUserId = session.user.id;

  try {
    const payload = {
      conversation_id: draft.conversation_id || null,
      company_id: companyId,
      project_id: projectId || null,
      created_by: authenticatedUserId,
      title: draft.title || "Untitled Draft",
      document_type: draft.document_type || "report",
      content_markdown: draft.content_markdown || "",
      metadata_json: draft.metadata_json || null,
    };

    const { data, error } = await supabase
      .from("project_advisor_document_drafts")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error saving document draft:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Exception in saveAdvisorDraft:", err);
    return null;
  }
}

// Fetch saved drafts for authenticated user
export async function getAdvisorDrafts(companyId: string): Promise<AdvisorDraft[]> {
  if (!companyId) return [];

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return [];

  try {
    const { data, error } = await supabase
      .from("project_advisor_document_drafts")
      .select("*")
      .eq("company_id", companyId)
      .eq("created_by", session.user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching advisor drafts:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Exception in getAdvisorDrafts:", err);
    return [];
  }
}

export function sanitizeUserFacingErrorMessage(rawError: unknown): string {
  const defaultFallback = "Project Advisor is temporarily busy. Please try again shortly.";
  if (!rawError) return defaultFallback;

  let msg = "";
  if (typeof rawError === "string") {
    msg = rawError.trim();
  } else if (typeof rawError === "object" && rawError !== null) {
    const errObj = rawError as any;
    msg = String(errObj.error || errObj.message || errObj.details || "").trim();
  }

  if (!msg) return defaultFallback;

  if (msg.startsWith("{") || msg.startsWith("[")) {
    try {
      const parsed = JSON.parse(msg);
      msg = String(parsed.error || parsed.message || defaultFallback).trim();
    } catch {
      return defaultFallback;
    }
  }

  if (
    /503|500|502|504|429|UNAVAILABLE|RESOURCE_EXHAUSTED|GEMINI_|fileSearchStores|\[object Object\]|TypeError|FetchError|Internal AI error/i.test(msg) ||
    msg.length > 200
  ) {
    return defaultFallback;
  }

  return msg;
}

// Main Edge Gateway invocation
export async function sendChatToAdvisor(request: AdvisorChatRequest): Promise<AdvisorChatResponse> {
  // Ensure valid user session exists before calling Edge Function
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return {
      answer: "Authentication required or session expired. Please sign in again to consult Project Advisor.",
      sources: [],
      confidence: "Low",
    };
  }

  try {
    // Invoke Edge Function project-advisor-chat; supabase.functions.invoke automatically attaches session Bearer token
    const { data, error } = await supabase.functions.invoke("project-advisor-chat", {
      body: request,
    });

    if (error || !data || data.error) {
      let rawErr = data?.error;
      if (!rawErr && error) {
        if (error.context && typeof error.context.json === "function") {
          try {
            const errBody = await error.context.json();
            rawErr = errBody?.error || errBody?.message;
          } catch {
            // fallback
          }
        }
        if (!rawErr) {
          rawErr = error.message;
        }
      }

      const safeMsg = sanitizeUserFacingErrorMessage(rawErr);
      console.error("Edge function project-advisor-chat error:", safeMsg);
      return {
        answer: `Project Advisor error: ${safeMsg}`,
        error: safeMsg,
        sources: [],
        confidence: "Low",
      };
    }

    return {
      answer: data.answer || "No response received.",
      sources: data.sources || [],
      confidence: data.confidence || "High",
      draft: data.draft,
      context_warning: data.context_warning || null,
      trimmed_categories: data.trimmed_categories || [],
      omitted_categories: data.omitted_categories || [],
      configured_cap: data.configured_cap,
      final_serialized_character_count: data.final_serialized_character_count,
    };
  } catch (err: any) {
    const safeMsg = sanitizeUserFacingErrorMessage(err);
    console.error("Edge function call exception:", err);
    return {
      answer: `Project Advisor error: ${safeMsg}`,
      error: safeMsg,
      sources: [],
      confidence: "Low",
    };
  }
}
