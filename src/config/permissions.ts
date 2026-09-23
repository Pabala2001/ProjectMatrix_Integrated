/**
 * Project Matrix – Enterprise Granular Permissions Definition
 * Based on the format: module.submodule.action
 */

export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "export"
  | "admin";

export type PermissionLevel = "NONE" | "VIEW" | "OPERATE" | "APPROVE" | "ADMIN";

export type Permission = `${string}.${Action}` | `${string}.*` | "*";

/**
 * Standard System Modules & Submodules
 */
export const PERMISSION_MODULES = {
  // 1. Dashboard & Portfolio
  DASHBOARD: {
    VIEW: "dashboard.view",
    ADMIN: "dashboard.admin",
    ALL: "dashboard.*"
  },
  PORTFOLIO: {
    VIEW: "portfolio.view",
    ADMIN: "portfolio.admin",
    ALL: "portfolio.*"
  },

  // 2. Programme & Controls
  PROGRAMME: {
    VIEW: "programme.schedule.view",
    CREATE: "programme.schedule.create",
    EDIT: "programme.schedule.edit",
    DELETE: "programme.schedule.delete",
    APPROVE: "programme.schedule.approve",
    EXPORT: "programme.schedule.export",
    ADMIN: "programme.schedule.admin",
    ALL: "programme.*"
  },

  // 3. Commercial & Cost Ledger
  COMMERCIAL: {
    FINANCIAL_OVERVIEW_VIEW: "commercial.financialOverview.view",
    BOQ_VIEW: "commercial.boq.view",
    BOQ_CREATE: "commercial.boq.create",
    BOQ_EDIT: "commercial.boq.edit",
    BOQ_DELETE: "commercial.boq.delete",
    BOQ_APPROVE: "commercial.boq.approve",
    
    BUDGET_VIEW: "commercial.budget.view",
    BUDGET_CREATE: "commercial.budget.create",
    BUDGET_EDIT: "commercial.budget.edit",
    BUDGET_APPROVE: "commercial.budget.approve",

    COSTS_VIEW: "commercial.costs.view",
    COSTS_CREATE: "commercial.costs.create",
    COSTS_EDIT: "commercial.costs.edit",
    COSTS_APPROVE: "commercial.costs.approve",

    PROCUREMENT_VIEW: "commercial.procurement.view",
    PROCUREMENT_CREATE: "commercial.procurement.create",
    PROCUREMENT_EDIT: "commercial.procurement.edit",
    PROCUREMENT_APPROVE: "commercial.procurement.approve",

    CERTIFICATES_VIEW: "commercial.certificates.view",
    CERTIFICATES_CREATE: "commercial.certificates.create",
    CERTIFICATES_EDIT: "commercial.certificates.edit",
    CERTIFICATES_APPROVE: "commercial.certificates.approve",

    VARIATIONS_VIEW: "commercial.variations.view",
    VARIATIONS_CREATE: "commercial.variations.create",
    VARIATIONS_EDIT: "commercial.variations.edit",
    VARIATIONS_APPROVE: "commercial.variations.approve",

    CLAIMS_VIEW: "commercial.claims.view",
    CLAIMS_CREATE: "commercial.claims.create",
    CLAIMS_EDIT: "commercial.claims.edit",
    CLAIMS_APPROVE: "commercial.claims.approve",

    CASHFLOW_VIEW: "commercial.cashflow.view",
    ALL: "commercial.*"
  },

  // 4. Contracts & Governance
  CONTRACTS: {
    REGISTER_VIEW: "contracts.contractRegister.view",
    REGISTER_EDIT: "contracts.contractRegister.edit",
    REGISTER_ADMIN: "contracts.contractRegister.admin",

    CORRESPONDENCE_VIEW: "contracts.correspondence.view",
    CORRESPONDENCE_CREATE: "contracts.correspondence.create",
    CORRESPONDENCE_EDIT: "contracts.correspondence.edit",

    NOTICES_VIEW: "contracts.notices.view",
    NOTICES_CREATE: "contracts.notices.create",
    NOTICES_APPROVE: "contracts.notices.approve",

    EARLY_WARNINGS_VIEW: "contracts.earlyWarnings.view",
    EARLY_WARNINGS_CREATE: "contracts.earlyWarnings.create",
    EARLY_WARNINGS_APPROVE: "contracts.earlyWarnings.approve",

    EOT_VIEW: "contracts.eot.view",
    EOT_CREATE: "contracts.eot.create",
    EOT_APPROVE: "contracts.eot.approve",

    COMPENSATION_EVENTS_VIEW: "contracts.compensationEvents.view",
    COMPENSATION_EVENTS_CREATE: "contracts.compensationEvents.create",
    COMPENSATION_EVENTS_APPROVE: "contracts.compensationEvents.approve",

    DISPUTES_VIEW: "contracts.disputes.view",
    DISPUTES_CREATE: "contracts.disputes.create",
    DISPUTES_APPROVE: "contracts.disputes.approve",

    ADJUDICATION_VIEW: "contracts.adjudication.view",
    BONDS_VIEW: "contracts.bonds.view",
    INSURANCE_VIEW: "contracts.insurance.view",
    ALL: "contracts.*"
  },

  // 5. Engineering & Technical
  ENGINEERING: {
    DRAWINGS_VIEW: "engineering.drawings.view",
    DRAWINGS_CREATE: "engineering.drawings.create",
    DRAWINGS_EDIT: "engineering.drawings.edit",
    DRAWINGS_APPROVE: "engineering.drawings.approve",

    DESIGN_VIEW: "engineering.design.view",
    DESIGN_EDIT: "engineering.design.edit",
    DESIGN_APPROVE: "engineering.design.approve",

    RFI_VIEW: "engineering.rfi.view",
    RFI_CREATE: "engineering.rfi.create",
    RFI_EDIT: "engineering.rfi.edit",
    RFI_APPROVE: "engineering.rfi.approve",

    SUBMISSIONS_VIEW: "engineering.submissions.view",
    SUBMISSIONS_CREATE: "engineering.submissions.create",
    SUBMISSIONS_APPROVE: "engineering.submissions.approve",

    METHOD_STATEMENTS_VIEW: "engineering.methodStatements.view",
    METHOD_STATEMENTS_CREATE: "engineering.methodStatements.create",
    METHOD_STATEMENTS_APPROVE: "engineering.methodStatements.approve",

    SURVEY_VIEW: "engineering.survey.view",
    SURVEY_CREATE: "engineering.survey.create",
    SURVEY_EDIT: "engineering.survey.edit",

    BIM_VIEW: "engineering.bim.view",
    BIM_EDIT: "engineering.bim.edit",

    CALCULATIONS_VIEW: "engineering.calculations.view",
    CALCULATIONS_CREATE: "engineering.calculations.create",
    CALCULATIONS_EDIT: "engineering.calculations.edit",
    ALL: "engineering.*"
  },

  // 6. Site Operations
  SITE: {
    DAILY_DIARY_VIEW: "site.dailyDiary.view",
    DAILY_DIARY_CREATE: "site.dailyDiary.create",
    DAILY_DIARY_EDIT: "site.dailyDiary.edit",
    DAILY_DIARY_APPROVE: "site.dailyDiary.approve",

    PROGRESS_VIEW: "site.progress.view",
    PROGRESS_CREATE: "site.progress.create",
    PROGRESS_EDIT: "site.progress.edit",

    INSPECTIONS_VIEW: "site.inspections.view",
    INSPECTIONS_CREATE: "site.inspections.create",
    INSPECTIONS_APPROVE: "site.inspections.approve",

    WORKFRONTS_VIEW: "site.workfronts.view",
    WORKFRONTS_EDIT: "site.workfronts.edit",

    LABOUR_VIEW: "site.labour.view",
    LABOUR_EDIT: "site.labour.edit",

    PLANT_VIEW: "site.plant.view",
    PLANT_EDIT: "site.plant.edit",

    MATERIALS_VIEW: "site.materials.view",
    MATERIALS_EDIT: "site.materials.edit",
    ALL: "site.*"
  },

  // 7. Resources & Supply Chain
  RESOURCES: {
    WORKFORCE_VIEW: "resources.workforce.view",
    WORKFORCE_CREATE: "resources.workforce.create",
    WORKFORCE_EDIT: "resources.workforce.edit",
    WORKFORCE_DELETE: "resources.workforce.delete",
    WORKFORCE_APPROVE: "resources.workforce.approve",
    WORKFORCE_ADMIN: "resources.workforce.admin",

    LABOUR_VIEW: "resources.labour.view",
    LABOUR_CREATE: "resources.labour.create",
    LABOUR_EDIT: "resources.labour.edit",
    LABOUR_APPROVE: "resources.labour.approve",

    PLANT_VIEW: "resources.plant.view",
    PLANT_CREATE: "resources.plant.create",
    PLANT_EDIT: "resources.plant.edit",
    PLANT_APPROVE: "resources.plant.approve",
    PLANT_ADMIN: "resources.plant.admin",

    MATERIALS_VIEW: "resources.materials.view",
    MATERIALS_CREATE: "resources.materials.create",
    MATERIALS_EDIT: "resources.materials.edit",
    MATERIALS_APPROVE: "resources.materials.approve",
    MATERIALS_ADMIN: "resources.materials.admin",

    LOGISTICS_VIEW: "resources.logistics.view",
    LOGISTICS_CREATE: "resources.logistics.create",
    LOGISTICS_EDIT: "resources.logistics.edit",
    LOGISTICS_APPROVE: "resources.logistics.approve",
    LOGISTICS_ADMIN: "resources.logistics.admin",

    ALL: "resources.*"
  },

  // 8. Quality Assurance
  QUALITY: {
    INSPECTIONS_VIEW: "quality.inspections.view",
    INSPECTIONS_CREATE: "quality.inspections.create",
    INSPECTIONS_EDIT: "quality.inspections.edit",
    INSPECTIONS_APPROVE: "quality.inspections.approve",

    NCR_VIEW: "quality.ncr.view",
    NCR_CREATE: "quality.ncr.create",
    NCR_EDIT: "quality.ncr.edit",
    NCR_APPROVE: "quality.ncr.approve",

    TESTING_VIEW: "quality.testing.view",
    TESTING_CREATE: "quality.testing.create",
    TESTING_EDIT: "quality.testing.edit",

    ITP_VIEW: "quality.itp.view",
    ITP_CREATE: "quality.itp.create",
    ITP_EDIT: "quality.itp.edit",
    ITP_APPROVE: "quality.itp.approve",
    ALL: "quality.*"
  },

  // 9. HSE
  HSE: {
    INCIDENTS_VIEW: "hse.incidents.view",
    INCIDENTS_CREATE: "hse.incidents.create",
    INCIDENTS_EDIT: "hse.incidents.edit",
    INCIDENTS_APPROVE: "hse.incidents.approve",

    RISKS_VIEW: "hse.risks.view",
    RISKS_CREATE: "hse.risks.create",
    RISKS_EDIT: "hse.risks.edit",

    PERMITS_VIEW: "hse.permits.view",
    PERMITS_CREATE: "hse.permits.create",
    PERMITS_APPROVE: "hse.permits.approve",

    TOOLBOX_VIEW: "hse.toolbox.view",
    TOOLBOX_CREATE: "hse.toolbox.create",

    INDUCTION_VIEW: "hse.induction.view",
    INDUCTION_CREATE: "hse.induction.create",
    ALL: "hse.*"
  },

  // 10. Finance & Banking
  FINANCE: {
    INVOICES_VIEW: "finance.invoices.view",
    INVOICES_CREATE: "finance.invoices.create",
    INVOICES_EDIT: "finance.invoices.edit",
    INVOICES_APPROVE: "finance.invoices.approve",

    PAYMENTS_VIEW: "finance.payments.view",
    PAYMENTS_CREATE: "finance.payments.create",
    PAYMENTS_APPROVE: "finance.payments.approve",

    BANK_VIEW: "finance.bank.view",
    BANK_EDIT: "finance.bank.edit",

    TAX_VIEW: "finance.tax.view",
    TAX_EDIT: "finance.tax.edit",

    PAYROLL_VIEW: "finance.payroll.view",
    PAYROLL_CREATE: "finance.payroll.create",
    PAYROLL_EDIT: "finance.payroll.edit",
    PAYROLL_APPROVE: "finance.payroll.approve",
    ALL: "finance.*"
  },

  // 11. Human Resources
  HR: {
    EMPLOYEES_VIEW: "hr.employees.view",
    EMPLOYEES_CREATE: "hr.employees.create",
    EMPLOYEES_EDIT: "hr.employees.edit",
    EMPLOYEES_DELETE: "hr.employees.delete",
    EMPLOYEES_ADMIN: "hr.employees.admin",

    ATTENDANCE_VIEW: "hr.attendance.view",
    ATTENDANCE_CREATE: "hr.attendance.create",
    ATTENDANCE_EDIT: "hr.attendance.edit",
    ATTENDANCE_ADMIN: "hr.attendance.admin",

    LEAVE_VIEW: "hr.leave.view",
    LEAVE_CREATE: "hr.leave.create",
    LEAVE_APPROVE: "hr.leave.approve",
    LEAVE_ADMIN: "hr.leave.admin",

    TRAINING_VIEW: "hr.training.view",
    TRAINING_CREATE: "hr.training.create",
    TRAINING_EDIT: "hr.training.edit",
    TRAINING_ADMIN: "hr.training.admin",

    DISCIPLINARY_VIEW: "hr.disciplinary.view",
    DISCIPLINARY_CREATE: "hr.disciplinary.create",
    DISCIPLINARY_EDIT: "hr.disciplinary.edit",

    ONBOARDING_VIEW: "hr.onboarding.view",
    ONBOARDING_CREATE: "hr.onboarding.create",
    ONBOARDING_ADMIN: "hr.onboarding.admin",
    ALL: "hr.*"
  },

  // 12. Documents, Reports, Security
  DOCUMENTS: {
    VIEW: "documents.view",
    CREATE: "documents.create",
    EDIT: "documents.edit",
    DELETE: "documents.delete",
    APPROVE: "documents.approve",
    EXPORT: "documents.export",
    ADMIN: "documents.admin",
    UPLOAD: "documents.upload",
    EDIT_METADATA: "documents.edit_metadata",
    SUBMIT: "documents.submit",
    REVIEW: "documents.review",
    ISSUE: "documents.issue",
    DOWNLOAD: "documents.download",
    ARCHIVE: "documents.archive",
    RESTORE: "documents.restore",
    VIEW_CONFIDENTIAL: "documents.view_confidential",
    MANAGE_REVISIONS: "documents.manage_revisions",
    MANAGE_REGISTERS: "documents.manage_registers",
    MANAGE_NUMBERING: "documents.manage_numbering",
    ALL: "documents.*"
  },
  REPORTS: {
    VIEW: "reports.view",
    CREATE: "reports.create",
    EXPORT: "reports.export",
    ALL: "reports.*"
  },
  SECURITY: {
    VIEW: "security.view",
    CREATE: "security.create",
    EDIT: "security.edit",
    ADMIN: "security.admin",
    ALL: "security.*"
  },

  // 13. System & Tenant Administration
  ADMINISTRATION: {
    COMPANY_VIEW: "administration.company.view",
    COMPANY_EDIT: "administration.company.edit",
    COMPANY_ADMIN: "administration.company.admin",

    USERS_VIEW: "administration.users.view",
    USERS_CREATE: "administration.users.create",
    USERS_EDIT: "administration.users.edit",
    USERS_DELETE: "administration.users.delete",
    USERS_ADMIN: "administration.users.admin",

    ROLES_VIEW: "administration.roles.view",
    ROLES_EDIT: "administration.roles.edit",
    ROLES_ADMIN: "administration.roles.admin",

    PERMISSIONS_VIEW: "administration.permissions.view",
    PERMISSIONS_EDIT: "administration.permissions.edit",
    PERMISSIONS_ADMIN: "administration.permissions.admin",

    INTEGRATIONS_VIEW: "administration.integrations.view",
    INTEGRATIONS_ADMIN: "administration.integrations.admin",

    AUDIT_VIEW: "administration.audit.view",
    AUDIT_EXPORT: "administration.audit.export",
    AUDIT_ADMIN: "administration.audit.admin",
    ALL: "administration.*"
  }
} as const;

/**
 * Helper to expand a PermissionLevel into explicit action strings
 */
export function expandPermissionLevel(submodulePrefix: string, level: PermissionLevel): string[] {
  switch (level) {
    case "NONE":
      return [];
    case "VIEW":
      return [`${submodulePrefix}.view`];
    case "OPERATE":
      return [`${submodulePrefix}.view`, `${submodulePrefix}.create`, `${submodulePrefix}.edit`];
    case "APPROVE":
      return [
        `${submodulePrefix}.view`, 
        `${submodulePrefix}.create`, 
        `${submodulePrefix}.edit`, 
        `${submodulePrefix}.approve`
      ];
    case "ADMIN":
      return [
        `${submodulePrefix}.view`,
        `${submodulePrefix}.create`,
        `${submodulePrefix}.edit`,
        `${submodulePrefix}.delete`,
        `${submodulePrefix}.approve`,
        `${submodulePrefix}.export`,
        `${submodulePrefix}.admin`
      ];
  }
}

/**
 * Checks if a granted permission pattern matches a requested permission
 * Handles wildcards like:
 * - "*" (grants everything)
 * - "resources.*" (grants all actions on all resources submodules)
 * - "resources.workforce.*" (grants all actions on workforce)
 * - "resources.workforce.admin" (implies view, create, edit, delete, approve, export, admin)
 */
export function matchesPermission(grantedPattern: string, requestedPerm: string): boolean {
  if (grantedPattern === "*" || grantedPattern === "all") return true;
  if (grantedPattern === requestedPerm) return true;

  // Wildcard match e.g. "resources.*" matches "resources.workforce.view"
  if (grantedPattern.endsWith(".*")) {
    const prefix = grantedPattern.slice(0, -2);
    if (requestedPerm.startsWith(prefix + ".")) return true;
  }

  // Action hierarchy: "admin" granted on a submodule implies other actions on that submodule
  const grantedParts = grantedPattern.split(".");
  const requestedParts = requestedPerm.split(".");

  if (grantedParts.length === 3 && requestedParts.length === 3) {
    const [gMod, gSub, gAct] = grantedParts;
    const [rMod, rSub, rAct] = requestedParts;

    if (gMod === rMod && (gSub === rSub || gSub === "*")) {
      if (gAct === "admin") return true;
      if (gAct === "approve" && (rAct === "view" || rAct === "create" || rAct === "edit" || rAct === "approve")) {
        return true;
      }
      if (gAct === "edit" && (rAct === "view" || rAct === "create" || rAct === "edit")) {
        return true;
      }
      if (gAct === "create" && (rAct === "view" || rAct === "create")) {
        return true;
      }
    }
  }

  return false;
}
