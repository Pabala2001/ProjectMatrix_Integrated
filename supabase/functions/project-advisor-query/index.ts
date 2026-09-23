// @ts-nocheck
// Deno/Supabase Edge Function implementation for project-advisor-query
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  // 1. Handle CORS OPTIONS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 2. Bearer Authentication Header check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Bearer Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace(/^Bearer /i, "").trim();

    // 3. Request payload parsing and scope validation
    const body = await req.json().catch(() => ({}));
    const companyId = body.company_id || body.companyId;
    const projectId = body.project_id || body.projectId;
    const question = body.question;
    const rawScope = body.scope || (projectId ? "project" : "company");

    // Reject legacy or invalid scopes
    if (rawScope === "all" || rawScope === "portfolio") {
      return new Response(
        JSON.stringify({ error: "Legacy scopes 'all' and 'portfolio' are not supported." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (rawScope !== "company" && rawScope !== "project") {
      return new Response(
        JSON.stringify({ error: "Invalid scope parameter. Must be 'company' or 'project'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scope = rawScope;

    if (!companyId || !UUID_REGEX.test(companyId)) {
      return new Response(
        JSON.stringify({ error: "Valid company_id (UUID) is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (scope === "project") {
      if (!projectId || !UUID_REGEX.test(projectId)) {
        return new Response(
          JSON.stringify({ error: "Valid project_id (UUID) is required when scope is 'project'." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      if (projectId) {
        return new Response(
          JSON.stringify({ error: "project_id must not be provided when scope is 'company'." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Initialize user-authenticated Supabase client with caller token
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 5. Validate user identity via auth.getUser()
    const { data: { user }, error: userError } = await userSupabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid, expired, or unverified authentication token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Access Authorization via verify_project_advisor_access RPC
    const effectiveProjectId = scope === "project" ? projectId : null;

    const { data: hasAccess, error: rpcError } = await userSupabase.rpc("verify_project_advisor_access", {
      co_id: companyId,
      proj_id: effectiveProjectId,
    });

    if (rpcError || hasAccess !== true) {
      return new Response(
        JSON.stringify({ error: "Access denied. You do not have authorised Project Advisor access for this company or project." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Secure SELECT-only context queries executed after authorization
    let contextSummary: any = null;

    if (scope === "project" && projectId) {
      const { data: project } = await userSupabase
        .from("projects")
        .select("id, name, contract_code, status, physical_progress, company_id")
        .eq("id", projectId)
        .eq("company_id", companyId)
        .maybeSingle();

      contextSummary = project ? { project } : null;
    } else {
      const { data: companyProjects } = await userSupabase
        .from("projects")
        .select("id, name, contract_code, status, physical_progress")
        .eq("company_id", companyId)
        .limit(20);

      contextSummary = { company_projects: companyProjects || [] };
    }

    return new Response(
      JSON.stringify({
        status: "success",
        message: "project-advisor-query endpoint verified and secured. Primary chat endpoint is project-advisor-chat.",
        user_id: user.id,
        scope,
        context_summary: contextSummary,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

