// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { DIRECTORY_ACCESS, normalizeRole } from "../_shared/accessControl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Server error: SUPABASE_SERVICE_ROLE_KEY is missing." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Initialize service-role client
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse payload
    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { company_id, assignments } = payload;

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: company_id is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Authenticate the caller
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user: callerUser }, error: callerUserErr } = await userSupabase.auth.getUser();
    if (callerUserErr || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load caller's active company_members record
    const { data: callerMember, error: callerMemberErr } = await userSupabase
      .from("company_members")
      .select("*")
      .eq("company_id", company_id)
      .eq("profile_id", callerUser.id)
      .eq("is_active", true)
      .maybeSingle();

    if (callerMemberErr || !callerMember) {
      return new Response(
        JSON.stringify({ error: "Forbidden: You do not belong to the supplied company or your membership is inactive." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Confirm caller's designation has Administration-module access using the shared access matrix
    const normalizedCallerDesignation = normalizeRole(callerMember.designation);
    const allowedDesignations = DIRECTORY_ACCESS.administration as readonly string[];
    const isAuthorized = allowedDesignations.includes(normalizedCallerDesignation);

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only users permitted to access the Administration directory/module are authorized to finalize onboarding." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate onboarding company
    const { data: company, error: compErr } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", company_id)
      .maybeSingle();

    if (compErr || !company) {
      return new Response(
        JSON.stringify({ error: `Onboarding company validation failed: ${compErr?.message || "Company not found."}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate every project in the assignments belongs to that company
    const projectAssignments = Array.isArray(assignments) ? assignments : [];
    const projectIds = [...new Set(projectAssignments.map((a: any) => a.project_id).filter(Boolean))];

    if (projectIds.length > 0) {
      const { data: projects, error: projectsErr } = await supabaseAdmin
        .from("projects")
        .select("id, company_id")
        .in("id", projectIds);

      if (projectsErr) {
        return new Response(
          JSON.stringify({ error: `Failed to validate projects: ${projectsErr.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      for (const pId of projectIds) {
        const match = projects?.find((p) => p.id === pId);
        if (!match) {
          return new Response(
            JSON.stringify({ error: `Project not found in system: ${pId}` }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        if (match.company_id !== company_id) {
          return new Response(
            JSON.stringify({ error: `Tenant mismatch: Project ${pId} does not belong to the supplied company.` }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // Clear previous assignments for these specific project_ids to prevent duplicates
      const { error: deleteErr } = await supabaseAdmin
        .from("project_members")
        .delete()
        .in("project_id", projectIds);

      if (deleteErr) {
        return new Response(
          JSON.stringify({ error: `Failed to clear existing assignments: ${deleteErr.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Build unique assignments to insert
    const uniquePayloads: any[] = [];
    const seen = new Set<string>();

    for (const a of projectAssignments) {
      if (!a.project_id || !a.company_member_id) continue;
      const key = `${a.company_member_id}_${a.project_id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      uniquePayloads.push({
        id: crypto.randomUUID(),
        project_id: a.project_id,
        company_member_id: a.company_member_id,
        project_role: a.project_role || "Member",
        designation: a.designation || null,
        permissions: "all",
        assigned_by: callerUser.id,
        assigned_at: new Date().toISOString(),
      });
    }

    // Insert new unique project_members using service-role client
    if (uniquePayloads.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("project_members")
        .insert(uniquePayloads);

      if (insertErr) {
        return new Response(
          JSON.stringify({ error: `Failed to insert team assignments: ${insertErr.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Fetch the updated projects context for the company
    const { data: updatedProjects, error: updatedProjectsErr } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("company_id", company_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Onboarding finalized successfully.",
        company: company,
        projects: updatedProjects || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err: any) {
    console.error("Error in finalize-onboarding:", err);
    return new Response(
      JSON.stringify({ error: err.message || "An unexpected error occurred." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
