import React, { useEffect, useLayoutEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldAlert, Info, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import { routePermission, routeViewPermissions } from "./routePolicy";
import { assertOperationalAction, setOperationalAccess, type OperationalAction } from "./operationalAccess";

export function ApplicationAccessBoundary({children}: {children:React.ReactNode}) {
  const {workspace, user} = useAuth();
  const {can, checkPermission} = usePermissions();
  const location = useLocation();
  const [notice,setNotice] = useState<string | null>(null);
  const required = routePermission(location.pathname,location.search);
  const billing = location.pathname.startsWith("/billing");
  const entitlement = workspace?.billingEntitlement;
  const verified = entitlement?.company_id === workspace?.activeCompany?.id;
  const scopeKey = `${user?.id || ""}:${workspace?.activeCompany?.id || ""}:${workspace?.activeProject?.id || ""}`;
  const policyKey = `${scopeKey}:${location.pathname}:${location.search}`;
  const [appliedPolicyKey, setAppliedPolicyKey] = useState("");
  useLayoutEffect(() => {
    setOperationalAccess({companyId:workspace?.activeCompany?.id || "",projectId:workspace?.activeProject?.id,
      userId:user?.id || "",canWrite:verified && !workspace?.isBillingEntitlementLoading && entitlement?.can_write === true,
      canExport:verified && !workspace?.isBillingEntitlementLoading && entitlement?.can_export === true,
      routePermission:required,permits:can});
    setAppliedPolicyKey(policyKey);
    return () => setOperationalAccess(null);
  },[workspace?.activeCompany?.id,workspace?.activeProject?.id,user?.id,workspace?.isBillingEntitlementLoading,entitlement,required,can,verified,policyKey]);
  useEffect(() => setNotice(null),[location.pathname,location.search,workspace?.activeCompany?.id]);
  const viewResults = routeViewPermissions(location.pathname,location.search).map(permission => checkPermission(permission));
  const result = viewResults.find(item => item.granted) || viewResults[0];
  if (!result.granted) return <div className="max-w-xl mx-auto p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-4" role="status">
    <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto"/><h2 className="text-xl font-bold">Access unavailable</h2>
    <p className="text-sm text-slate-600">{result.reason}</p>
    {can("billing.view") && <Link className="inline-flex rounded-xl bg-amber-500 px-4 py-2 font-semibold" to="/billing/subscriptions">Open Billing</Link>}
  </div>;
  // Mount data-reading children only after the new workspace policy has been installed.
  // Remount on company/project changes so local UI state cannot leak between workspaces.
  if (appliedPolicyKey !== policyKey) return <p className="p-4 text-sm text-slate-500" role="status">Loading workspace…</p>;
  const preview = /^(\/commercial(?!\/(procurement-register|accounts-register))|\/resources|\/engineering|\/site$|\/hseq|\/governance|\/intelligence\/(reports|knowledge)|\/portfolio|\/command|\/actions|\/controls|\/administration|\/settings|\/information-technology|\/projects)/.test(location.pathname);
  function guard(event: React.SyntheticEvent, action: OperationalAction) {
    if (billing) return;
    try { assertOperationalAction(action); }
    catch (error) { event.preventDefault(); event.stopPropagation(); setNotice(error instanceof Error ? error.message : "This action is unavailable."); }
  }
  return <div key={scopeKey} onSubmitCapture={event=>guard(event,"write")} onClickCapture={event=>{
    const target = event.target as HTMLElement;
    const button = target.closest("button");
    if (!button || button.dataset.readAction === "true") return;
    const label=(button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent || "").trim();
    const match=label.match(/^(add|new|create|save|update|delete|remove|approve|reject|submit|upload|import|post|record|confirm|commit|send|assign|deactivate|activate|invite|export|download)\b/i);
    if (!match) return;
    const verb=match[1].toLowerCase();
    const action: OperationalAction = /delete|remove|deactivate/.test(verb) ? "delete" : /approve|reject/.test(verb) ? "approve" : /export|download/.test(verb) ? "export" : "write";
    guard(event,action);
  }}>
    {preview && <div className="mb-4 flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900"><Info className="w-4 h-4 shrink-0"/><span>Frontend preview: this workspace includes sample or browser-saved records. New module data will become shared company records after backend integration. Existing live registers remain available in the menu.</span></div>}
    {notice && <div role="alert" className="mb-4 flex justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><span>{notice}</span><button type="button" aria-label="Dismiss notice" onClick={()=>setNotice(null)}><X className="w-4 h-4"/></button></div>}
    {children}
  </div>;
}
