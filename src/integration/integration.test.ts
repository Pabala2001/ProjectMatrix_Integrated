import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { evaluateWorkspacePermission } from "./workspacePermission";
import { setOperationalAccess, assertOperationalAction } from "./operationalAccess";
import { previewStorage } from "./previewStorage";
import { resourceService } from "../services/resourceService";
import { routePermission, routeViewPermissions } from "./routePolicy";
import { navigation } from "../config/navigation";
import { saveCompanyDisplay, withCompanyDisplay } from "./companyDisplay";
import type { CompanyBillingEntitlement } from "../types";
import type { PermissionEvaluationContext } from "../services/permissionService";

const entitlement: CompanyBillingEntitlement = {
  company_id: "company-a", subscription_id: "subscription-a", subscription_status: "active",
  entitlement_state: "active", access_mode: "full", can_read: true, can_write: true,
  can_export: true, can_access_billing: true, can_access_settings: true,
  grace_started_at: null, grace_ends_at: null, read_only_since: null,
  reason_code: "ACTIVE", evaluated_at: new Date().toISOString()
};
function fixture(permission = "resources.workforce.create", role = "Company Administrator") {
  const context: PermissionEvaluationContext = {
    companyId: "company-a", projectId: "project-a", requestedPermission: permission,
    user: { id: "user-a", name: "Test member", roles: [role], primaryRole: role,
      status: "active", isCompanyAdmin: role === "Company Administrator", assignedProjectIds: ["project-a"] }
  };
  return { authenticated: true, userId: "user-a", entitlement, entitlementLoading: false,
    member: { id: "member-a", profile_id: "user-a", company_id: "company-a", role, is_active: true }, context };
}

test("verified primary workspace can use the added operational modules", () => {
  for (const permission of ["resources.workforce.create", "engineering.rfi.edit", "hse.incidents.create", "commercial.budget.approve"]) {
    assert.equal(evaluateWorkspacePermission(fixture(permission)).granted, true, permission);
  }
});

test("billing keeps the primary role contract after partner role expansion", () => {
  for (const role of ["CEO", "COO", "CFO", "Director", "Project Manager", "Company Admin"]) {
    assert.equal(evaluateWorkspacePermission(fixture("billing.view", role)).granted, true, role);
  }
  for (const role of ["Finance Manager", "Managing Director", "Systems Administrator", "General Employee"]) {
    const input = fixture("billing.view", role);
    input.context.user.isCompanyAdmin = true;
    assert.equal(evaluateWorkspacePermission(input).granted, false, role);
  }
});

test("inactive, wrong-user and wrong-company memberships cannot grant access", () => {
  for (const permission of ["billing.view", "resources.workforce.create", "settings.view"]) {
    for (const change of [{is_active:false}, {profile_id:"user-b"}, {company_id:"company-b"}]) {
      const input = fixture(permission);
      Object.assign(input.member, change);
      assert.equal(evaluateWorkspacePermission(input).granted, false, JSON.stringify(change));
    }
    assert.equal(evaluateWorkspacePermission({...fixture(permission), authenticated:false}).granted, false);
  }
});

test("read-only and loading subscriptions block writes but retain billing recovery", () => {
  const input = fixture();
  input.entitlement = {...entitlement, access_mode:"read_only", can_write:false, can_export:false};
  for (const action of ["create", "edit", "delete", "approve", "admin", "export"]) {
    input.context.requestedPermission = `resources.workforce.${action}`;
    assert.equal(evaluateWorkspacePermission(input).granted, false, action);
  }
  input.context.requestedPermission = "resources.workforce.view";
  assert.equal(evaluateWorkspacePermission(input).granted, true);
  input.context.requestedPermission = "billing.view";
  assert.equal(evaluateWorkspacePermission(input).granted, true);
  assert.equal(evaluateWorkspacePermission({...input, entitlementLoading:true, entitlement:null}).granted, true);
  input.context.requestedPermission = "resources.workforce.create";
  assert.equal(evaluateWorkspacePermission({...input, entitlementLoading:true}).granted, false);
});

test("switching companies never borrows another company's full entitlement", () => {
  const input = fixture();
  input.entitlement = {...entitlement,company_id:"company-b"};
  assert.equal(evaluateWorkspacePermission(input).granted, false);
});

test("project-scoped roles require an assignment to the selected project", () => {
  const input = fixture("programme.schedule.view", "Project Manager");
  assert.equal(evaluateWorkspacePermission(input).granted, true);
  input.context.user.assignedProjectIds = [];
  assert.equal(evaluateWorkspacePermission(input).granted, false);
});

test("browser permission drafts cannot override verified role access", () => {
  const input = fixture("commercial.costs.approve", "General Employee");
  input.context.userOverrides = [{id:"draft",userId:"user-a",permission:"*",allowed:true,
    reason:"Local draft",grantedBy:"browser",grantedAt:new Date().toISOString()}];
  assert.equal(evaluateWorkspacePermission(input).granted, false);
});

test("navigation items agree with direct-route access policies", () => {
  for (const domain of navigation) {
    for (const item of domain.children || [domain]) {
      if (!item.href || !item.permission) continue;
      const [path, query=""] = item.href.split("?");
      assert.ok(routeViewPermissions(path, query).includes(item.permission), `${item.title}: ${item.href}`);
    }
  }
});

test("specialist tabs use their own permissions", () => {
  for (const [path, query, expected] of [
    ["/resources", "tab=plant", "resources.plant.view"],
    ["/resources", "tab=materials", "resources.materials.view"],
    ["/engineering", "tab=queries", "engineering.rfi.view"],
    ["/engineering", "tab=submittals", "engineering.submissions.view"],
    ["/engineering", "tab=survey", "engineering.survey.view"],
    ["/hseq", "tab=safety&sub=permits", "hse.permits.view"],
    ["/hseq", "tab=quality&sub=ncrs", "quality.ncr.view"],
    ["/administration/hr", "tab=payroll", "finance.payroll.view"],
    ["/administration/hr", "tab=leave", "hr.leave.view"]
  ]) assert.equal(routePermission(path,query),expected);
});

// A small in-memory Storage implementation exercises real preview services, without a browser or network.
const storage = new Map<string,string>();
Object.defineProperty(globalThis,"localStorage", { configurable:true, value:{
  getItem:(key:string)=>storage.get(key) ?? null,
  setItem:(key:string,value:string)=>{storage.set(key,String(value));},
  removeItem:(key:string)=>{storage.delete(key);},
  clear:()=>storage.clear(), key:(index:number)=>[...storage.keys()][index] ?? null,
  get length(){return storage.size;}
}});
function workspace(companyId="company-a",userId="user-a",canWrite=true) {
  setOperationalAccess({companyId,userId,projectId:"project-a",canWrite,canExport:true,
    routePermission:"resources.workforce.view",permits:()=>true});
}
afterEach(()=>{setOperationalAccess(null);storage.clear();});

test("resource records persist in their workspace and remain isolated across users and companies", () => {
  workspace();
  const record = resourceService.addStaff("project-a",{name:"Workspace A staff"});
  assert.equal(resourceService.getStaff("project-a")[0].id,record.id);
  assert.equal(resourceService.getStaff("project-b").length,0);
  workspace("company-b");
  assert.equal(resourceService.getStaff("project-a").length,0);
  workspace("company-a","user-b");
  assert.equal(resourceService.getStaff("project-a").length,0);
  workspace();
  assert.equal(resourceService.getStaff("project-a")[0].name,"Workspace A staff");
});

test("read-only restrictions reach the preview service before data can be changed", () => {
  workspace();
  const record = resourceService.addStaff("project-a",{name:"Original"});
  const snapshot = [...storage.entries()];
  workspace("company-a","user-a",false);
  assert.throws(()=>resourceService.addStaff("project-a",{name:"Blocked"}),/read-only/);
  assert.throws(()=>resourceService.updateStaff("project-a",{...record,name:"Blocked"}),/read-only/);
  assert.throws(()=>resourceService.deleteStaff("project-a",record.id),/read-only/);
  assert.deepEqual([...storage.entries()],snapshot);
  assert.equal(resourceService.getStaff("project-a")[0].name,"Original");
});

test("service writes require a workspace and an action permission", () => {
  assert.throws(()=>resourceService.addStaff("project-a",{name:"Blocked"}),/authenticated company/);
  setOperationalAccess({companyId:"company-a",userId:"user-a",canWrite:true,canExport:false,
    routePermission:"resources.workforce.view",permits:()=>false});
  assert.throws(()=>resourceService.addStaff("project-a",{name:"Blocked"}),/role/);
  assert.throws(()=>assertOperationalAction("export"),/read-only/);
  setOperationalAccess(null);
  assert.equal(previewStorage.getItem("test"),null);
  assert.throws(()=>previewStorage.setItem("test","x"),/Select a company/);
});

test("company display drafts preserve primary identity and billing fields", () => {
  saveCompanyDisplay("user-a","company-a",{country:"South Africa",default_currency:"ZAR",
    id:"other",billing_status:"active",is_company_admin:true,trading_name:"Display name"});
  const company = withCompanyDisplay({id:"company-a",billing_status:"trial"},"user-a");
  assert.equal(company.trading_name,"Display name");
  assert.equal(company.countryCode,"ZA");
  assert.equal(company.id,"company-a");
  assert.equal(company.billing_status,"trial");
  assert.equal(company.is_company_admin,undefined);
  assert.equal(withCompanyDisplay({id:"company-a"},"user-b").trading_name,undefined);
});

test("aggregate preview readers enumerate only the current workspace", () => {
  workspace();previewStorage.setItem("items_project-a","[]");
  assert.equal(previewStorage.length,1);
  assert.equal(previewStorage.key(0),"items_project-a");
  workspace("company-b");
  assert.equal(previewStorage.length,0);
  assert.equal(previewStorage.key(0),null);
});
