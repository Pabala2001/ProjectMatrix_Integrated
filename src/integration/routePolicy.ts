/** One route policy for navigation, direct links, and operational mutation checks. */
export function routePermission(path: string, search = ""): string {
  const tab = new URLSearchParams(search).get("tab") || "";
  const sub = new URLSearchParams(search).get("sub") || "";
  if (path.startsWith("/billing")) return "billing.view";
  if (path === "/settings") return "settings.view";
  if (path.includes("payroll") || (path === "/administration/hr" && tab === "payroll")) return "finance.payroll.view";
  if (path.includes("employee-leave") || (path === "/administration/hr" && tab === "leave")) return "hr.leave.view";
  if (path.startsWith("/administration/hr") || path === "/human-resources") return "hr.employees.view";
  if (path.includes("communication") || path.includes("transmittals")) return "contracts.correspondence.view";
  if (path.includes("security")) return "security.view";
  if (path.includes("information-technology")) return "administration.company.view";
  if (path.startsWith("/administration")) return "administration.company.view";
  if (path.includes("programme") || path.startsWith("/controls")) return "programme.schedule.view";
  if (path.startsWith("/engineering")) {
    if (path.includes("survey") || ["survey","survey_geospatial"].includes(tab)) return "engineering.survey.view";
    if (path.includes("rfis") || ["queries","rfis","technical_control"].includes(tab)) return "engineering.rfi.view";
    if (path.includes("submittals") || tab === "submittals") return "engineering.submissions.view";
    if (["design","assurance","changes","change_control"].includes(tab)) return "engineering.design.view";
    return "engineering.drawings.view";
  }
  if (path.startsWith("/commercial")) {
    if (path.includes("logistics")) return "resources.logistics.view";
    if (path.includes("procurement") || path.includes("commitments")) return "commercial.procurement.view";
    if (path.includes("budget") || path.includes("boq")) return "commercial.budget.view";
    if (path.includes("client") || path.includes("certificates")) return "commercial.certificates.view";
    if (path.includes("supplier") || path.includes("actual-costs")) return "commercial.costs.view";
    if (path.includes("cash")) return "commercial.cashflow.view";
    return "commercial.financialOverview.view";
  }
  if (path.startsWith("/resources")) {
    const tab = new URLSearchParams(search).get("tab") || "workforce";
    return `resources.${["workforce","plant","materials","logistics"].includes(tab) ? tab : "workforce"}.view`;
  }
  if (path.startsWith("/governance/contracts")) return "contracts.contractRegister.view";
  if (path.startsWith("/governance/risks")) return "hse.risks.view";
  if (path.startsWith("/hseq") || path.startsWith("/quality-control")) {
    if (tab === "safety" || path.endsWith("/safety")) return sub === "permits" ? "hse.permits.view" : sub === "toolbox-talks" ? "hse.toolbox.view" : "hse.incidents.view";
    if (["environment","environmental"].includes(tab)) return "hse.risks.view";
    if (tab === "quality") return sub === "ncrs" ? "quality.ncr.view" : sub === "test-results" ? "quality.testing.view" : sub === "inspections" ? "quality.inspections.view" : "quality.itp.view";
    return "quality.inspections.view";
  }
  if (path.startsWith("/reports") || path === "/intelligence/reports") return "reports.view";
  if (path.startsWith("/site")) return tab === "inspections" ? "site.inspections.view" : tab === "reports" ? "reports.view" : "site.dailyDiary.view";
  if (path.startsWith("/documents") || path === "/intelligence/knowledge") return "documents.view";
  if (path.startsWith("/portfolio") || path === "/project-map") return "portfolio.view";
  return "dashboard.view";
}
export function directoryPermission(directory: string): string {
  return ({commandCentre:"dashboard.view",dashboard:"dashboard.view",programme:"programme.schedule.view",dailyReports:"reports.view",siteDiaries:"site.dailyDiary.view",documents:"documents.view",communication:"contracts.correspondence.view",qualityControl:"quality.inspections.view",procurement:"commercial.procurement.view",administration:"administration.company.view",labourPayroll:"finance.payroll.view",accounts:"commercial.financialOverview.view",settings:"settings.view",billing:"billing.view",projectAdvisor:"dashboard.view",projectAdvisor2:"dashboard.view"} as Record<string,string>)[directory] || `${directory}.view`;
}
export function sourcePermission(source: string, fallback: string): string {
  const name = source.toLowerCase();
  if (name.includes("rfi")) return "engineering.rfi";
  if (name.includes("submittal")) return "engineering.submissions";
  if (name.includes("engineering")) return "engineering.drawings";
  if (name.includes("leave")) return "hr.leave";
  if (name.includes("payroll")) return "finance.payroll";
  if (name.includes("procurement") || name.includes("commitment")) return "commercial.procurement";
  if (name.includes("inventory") || name.includes("material")) return "resources.materials";
  if (name.includes("supplier") || name.includes("actualcost")) return "commercial.costs";
  if (name.includes("cashbook") || name.includes("cashbank")) return "commercial.cashflow";
  if (name.includes("programme")) return "programme.schedule";
  if (name.includes("contract")) return "contracts.contractRegister";
  if (name.includes("quality") || name.includes("inspection") || name.includes("ncr") || name.includes("itp")) return "quality.inspections";
  if (name.includes("safety") || name.includes("environmental") || name.includes("permit")) return "hse.incidents";
  if (name.includes("sitediar") || name.includes("sitehub")) return "site.dailyDiary";
  if (name.includes("report")) return "reports";
  if (name.includes("document")) return "documents";
  return fallback.replace(/\.view$/, "");
}

/** Hub landing pages may be entered by any of their operational teams. Specific tabs still use their own permission. */
export function routeViewPermissions(path: string, search = ""): string[] {
  const tab = new URLSearchParams(search).get("tab");
  if ((!tab || tab === "overview") && path === "/hseq") return ["quality.inspections.view","hse.incidents.view","hse.risks.view"];
  if ((!tab || tab === "overview") && path === "/engineering") return ["engineering.drawings.view","engineering.rfi.view","engineering.submissions.view","engineering.survey.view"];
  return [routePermission(path,search)];
}
