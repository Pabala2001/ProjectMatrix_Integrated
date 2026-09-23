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

  // Track created resources for atomic cleanup/rollback on any failure
  let createdAuthUserId: string | null = null;
  let createdCompanyMemberId: string | null = null;
  const createdProjectMemberIds: string[] = [];
  let supabaseAdmin: any = null;

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

    const {
      full_name,
      email,
      phone,
      temporary_password,
      designation,
      department,
      is_company_admin,
      company_id,
      project_ids,
    } = payload;

    // Validate inputs
    if (!full_name || !email || !designation || !company_id || !temporary_password) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: full_name, email, designation, company_id, and temporary_password are required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate temporary password length
    if (temporary_password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A temporary password of at least 6 characters is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Reject "Company Admin" as an invalid designation with a clear error (Requirement 8)
    const trimmedDesignation = designation.trim();
    if (trimmedDesignation.toLowerCase() === "company admin") {
      return new Response(
        JSON.stringify({ error: "Invalid designation: 'Company Admin' is not a valid designation." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Authenticate the caller
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

    // Validate that the supplied company_id belongs to the caller
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

    // Authorisation must use company_members.designation only and must call the same shared Administration-module permission source (Requirement 3)
    // Do not authorise the caller using is_company_admin (Requirement 2)
    // Make designation comparison case-insensitive by normalising whitespace and letter case (Requirement 4)
    const normalizedCallerDesignation = normalizeRole(callerMember.designation);
    const allowedDesignations = DIRECTORY_ACCESS.administration as readonly string[];
    const isAuthorized = allowedDesignations.includes(normalizedCallerDesignation);

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only users permitted to access the Administration directory/module are authorized to create company members." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Evaluate Billing Entitlement for the target company using user-scoped client (never service-role)
    const { data: entitlementRows, error: entitlementErr } = await userSupabase.rpc(
      "get_company_billing_entitlement",
      { p_company_id: company_id }
    );

    if (entitlementErr) {
      return new Response(
        JSON.stringify({
          error: "Your company is in read-only mode. Update billing to continue.",
          code: "BILLING_READ_ONLY",
          details: entitlementErr.message,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const entitlement = Array.isArray(entitlementRows) ? entitlementRows[0] : entitlementRows;

    if (
      !entitlement ||
      typeof entitlement !== "object" ||
      entitlement.can_write !== true
    ) {
      return new Response(
        JSON.stringify({
          error: "Your company is in read-only mode. Update billing to continue.",
          code: "BILLING_READ_ONLY",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. ONLY after entitlement authorizes operational writes (can_write === true), instantiate service-role client
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Validate that project_ids is a non-empty array and is provided (Requirement 5 & 6)
    if (!project_ids || !Array.isArray(project_ids) || project_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "Validation failed: You must select at least one project for the new company member." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const uniqueProjectIds = [...new Set(project_ids)].filter(Boolean);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const pId of uniqueProjectIds) {
      if (typeof pId !== "string" || !uuidRegex.test(pId)) {
        return new Response(
          JSON.stringify({ error: `Validation failed: Project ID "${pId}" is not a valid UUID.` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (uniqueProjectIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Validation failed: You must select at least one valid project for the new company member." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate that every selected project belongs to that company (Requirement 5)
    const { data: projects, error: projectsErr } = await supabaseAdmin
      .from("projects")
      .select("id, company_id")
      .in("id", uniqueProjectIds);

    if (projectsErr) {
      return new Response(
        JSON.stringify({ error: `Failed to validate projects: ${projectsErr.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    for (const pId of uniqueProjectIds) {
      const match = projects?.find((p) => p.id === pId);
      if (!match) {
        return new Response(
          JSON.stringify({ error: `Project not found: ${pId}` }),
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

    // Validate email uniqueness in public.profiles and Supabase Auth (Requirement 12)
    const { data: existingProfile, error: existingProfileErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "An account with this email address already exists in profiles." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Optimised email uniqueness validation in Supabase Auth (Requirement 2 / final architecture improvement)
    // Avoid paginating through every Auth user unless absolutely necessary.
    // Querying auth.users table using the service_role client with db schema 'auth' is highly efficient.
    const supabaseAuthDb = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: "auth" },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authUserMatch, error: authDbErr } = await supabaseAuthDb
      .from("users")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (authDbErr) {
      console.warn("Direct auth.users query failed, falling back to paginated search:", authDbErr.message);
      // Fallback to a fast listUsers check if direct auth.users table query has any issues
      let page = 1;
      let emailExistsInAuth = false;
      while (true) {
        const { data: { users }, error: listUsersErr } = await supabaseAdmin.auth.admin.listUsers({
          page: page,
          perPage: 100, // Small perPage is faster for initial checks
        });

        if (listUsersErr || !users || users.length === 0) {
          break;
        }

        emailExistsInAuth = users.some(u => u.email?.toLowerCase() === email.trim().toLowerCase());
        if (emailExistsInAuth) {
          break;
        }

        if (users.length < 100) {
          break;
        }
        page++;
      }

      if (emailExistsInAuth) {
        return new Response(
          JSON.stringify({ error: "An account with this email address already exists in authentication." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else if (authUserMatch) {
      return new Response(
        JSON.stringify({ error: "An account with this email address already exists in authentication." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create a real Supabase Auth user (No system_role/role written) (Requirement 5, 7)
    const { data: authData, error: createUserErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: temporary_password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        designation: trimmedDesignation,
        phone: phone || null,
        company_id: company_id,
        must_change_password: true,
        is_company_admin: !!is_company_admin,
      },
    });

    if (createUserErr || !authData.user) {
      return new Response(
        JSON.stringify({ error: createUserErr?.message || "Failed to create authentication user." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const newUser = authData.user;
    createdAuthUserId = newUser.id;

    // Create public.profiles row (No system_role/role written) (Requirement 5, 7)
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUser.id,
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone || null,
        company_id: company_id,
        avatar_color: '#FF9F1C',
        is_active: true,
        updated_at: new Date().toISOString(),
      });

    if (profileErr) {
      throw new Error(`Failed to create or update profile record: ${profileErr.message}`);
    }

    // Create company_members row (Requirement 5, 7, 9, 11, 14)
    const companyMemberId = crypto.randomUUID();
    const companyMemberPayload = {
      id: companyMemberId,
      company_id: company_id,
      profile_id: newUser.id,
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone || null,
      designation: trimmedDesignation, // Exact selected designation
      department: department || null, // Supplied department or null
      is_company_admin: !!is_company_admin, // Save separately from designation
      is_active: true,
      login_enabled: true,
      invite_status: "accepted",
      status: "active",
      created_by: callerUser.id,
      updated_at: new Date().toISOString(),
      must_change_password: true, // Require column explicitly (Requirement 9)
    };

    const { error: primaryInsertError } = await supabaseAdmin
      .from("company_members")
      .insert(companyMemberPayload);

    if (primaryInsertError) {
      const isMissingColumnError = primaryInsertError.message?.includes("must_change_password") || primaryInsertError.code?.includes("42703");
      if (isMissingColumnError) {
        // Return clear server configuration error and trigger rollback (Requirement 9)
        throw new Error("Server Configuration Error: The required database column 'must_change_password' is missing in company_members.");
      }
      throw primaryInsertError;
    }
    createdCompanyMemberId = companyMemberId;

    // Assign projects to project_members (No permissions: "all" assigned) (Requirement 10)
    if (uniqueProjectIds && uniqueProjectIds.length > 0) {
      const projectMembersPayloads = uniqueProjectIds.map((pId) => {
        const pmId = crypto.randomUUID();
        createdProjectMemberIds.push(pmId);
        return {
          id: pmId,
          project_id: pId,
          company_member_id: companyMemberId,
          project_role: "Member",
          designation: trimmedDesignation, // Exact selected designation
          assigned_by: callerUser.id,
          assigned_at: new Date().toISOString(),
        };
      });

      const { error: pmInsertError } = await supabaseAdmin
        .from("project_members")
        .insert(projectMembersPayloads);

      if (pmInsertError) {
        throw new Error(`Failed to assign member to projects: ${pmInsertError.message}`);
      }
    }

    // Return the response without system_role/role (Requirement 5) or any sensitive data
    return new Response(
      JSON.stringify({
        success: true,
        message: "Company member successfully created.",
        project_assignments_count: createdProjectMemberIds.length,
        project_ids: uniqueProjectIds,
        data: {
          user_id: newUser.id,
          company_member_id: companyMemberId,
          full_name: full_name.trim(),
          email: email.trim().toLowerCase(),
          designation: trimmedDesignation,
          department: department || null,
          is_company_admin: !!is_company_admin,
          project_assignments_count: createdProjectMemberIds.length,
          project_ids: uniqueProjectIds
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err: any) {
    console.error("Error creating company member, starting transaction rollback:", err.message);

    // Atomic cleanup rollback logic (Requirement 15)
    if (createdProjectMemberIds.length > 0) {
      try {
        await supabaseAdmin
          .from("project_members")
          .delete()
          .in("id", createdProjectMemberIds);
      } catch (cleanupErr: any) {
        console.error("Cleanup project members failed:", cleanupErr.message);
      }
    }

    if (createdCompanyMemberId) {
      try {
        await supabaseAdmin
          .from("company_members")
          .delete()
          .eq("id", createdCompanyMemberId);
      } catch (cleanupErr: any) {
        console.error("Cleanup company member failed:", cleanupErr.message);
      }
    }

    if (createdAuthUserId) {
      try {
        await supabaseAdmin
          .from("profiles")
          .delete()
          .eq("id", createdAuthUserId);
      } catch (cleanupErr: any) {
        console.error("Cleanup profile failed:", cleanupErr.message);
      }

      try {
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      } catch (cleanupErr: any) {
        console.error("Cleanup auth user failed:", cleanupErr.message);
      }
    }

    return new Response(
      JSON.stringify({ error: err.message || "An unexpected error occurred during user setup." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
