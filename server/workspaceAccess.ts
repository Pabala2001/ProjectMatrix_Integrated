import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { STANDARD_ROLES, normalizeRoleId } from "../src/config/roles";
import { matchesPermission } from "../src/config/permissions";
import { EngineeringRFIStorage } from "./engineeringRfiStorage";

/** The partner APIs share the original authenticated tenant and billing boundary. */
export async function requireWorkspaceAccess(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/health") return next();
  const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const authorization=req.header("Authorization") || "";
  const companyId=req.header("X-Company-Id") || "";
  const projectId=req.header("X-Project-Id") || "";
  if (!url || !key) return res.status(503).json({error:"Configure Supabase before using server-backed features."});
  if (!authorization.startsWith("Bearer ") || !companyId) return res.status(401).json({error:"An authenticated company session is required."});
  try {
    const db=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:authError}=await db.auth.getUser(authorization.slice(7));
    if (authError || !userData.user) return res.status(401).json({error:"Please sign in again."});
    const {data:member,error:memberError}=await db.from("company_members").select("*").eq("profile_id",userData.user.id).eq("company_id",companyId).eq("is_active",true).maybeSingle();
    if (memberError || !member) return res.status(403).json({error:"Company access denied."});
    const role=normalizeRoleId(member.designation || member.role);
    const companyWide=member.is_company_admin===true || ["systems_administrator","company_administrator","managing_director","chief_operating_officer","head_of_engineering"].includes(role);
    if (projectId) {
      const {data:project,error:projectError}=await db.from("projects").select("id,company_id").eq("id",projectId).eq("company_id",companyId).maybeSingle();
      if (projectError || !project) return res.status(403).json({error:"Project access denied."});
      if (!companyWide) {
        const {data:assignment,error:assignmentError}=await db.from("project_members").select("id").eq("project_id",projectId).eq("company_member_id",member.id).maybeSingle();
        if (assignmentError || !assignment) return res.status(403).json({error:"Project assignment required."});
      }
    }
    const suppliedCompany=req.body?.companyId || req.body?.company_id || req.query.companyId;
    const suppliedProject=req.body?.projectId || req.body?.project_id || req.body?.project?.id || req.query.projectId;
    if ((suppliedCompany && suppliedCompany!==companyId) || (suppliedProject && suppliedProject!==projectId)) return res.status(403).json({error:"Workspace mismatch."});
    const {data:raw,error:billingError}=await db.rpc("get_company_billing_entitlement",{p_company_id:companyId});
    const entitlement=Array.isArray(raw)?raw[0]:raw;
    if (billingError || !entitlement || entitlement.company_id!==companyId) return res.status(503).json({error:"Company subscription could not be verified."});
    const write=req.method!=="GET" && req.method!=="HEAD";
    if (write ? entitlement.can_write!==true : entitlement.can_read!==true) return res.status(403).json({error:"Company subscription does not permit this operation."});
    const module=req.path.startsWith("/engineering")?"engineering.rfi":req.path.startsWith("/programme")?"programme.schedule":"dashboard";
    const action=req.method==="DELETE"?"delete":req.method==="PUT"||req.method==="PATCH"?"edit":req.path.startsWith("/engineering")&&write?"create":"view";
    if (!companyWide && !(STANDARD_ROLES[role]?.permissions || []).some(p=>matchesPermission(p,`${module}.${action}`))) return res.status(403).json({error:"Role permission required."});
    if (req.path.startsWith("/engineering/rfis")) {
      if (!projectId) return res.status(400).json({error:"Select a project for RFIs."});
      const id=req.path.match(/^\/engineering\/rfis\/([^/]+)$/)?.[1];
      if (id) {
        const record=EngineeringRFIStorage.getRFIById(decodeURIComponent(id));
        if (!record || record.companyId!==companyId || record.projectId!==projectId) return res.status(404).json({error:"RFI not found in this workspace."});
      }
      req.query.companyId=companyId;req.query.projectId=projectId;
      if (write) req.body={...req.body,companyId,projectId};
    }
    next();
  } catch { return res.status(503).json({error:"Workspace verification failed. Please retry."}); }
}
