/**
 * Project Matrix – 47 Standard Enterprise Roles Definition & Permission Sets
 */

import { Permission, PERMISSION_MODULES, expandPermissionLevel } from "./permissions";

export interface SystemRoleDefinition {
  id: string;
  name: string;
  category: 
    | "Executive & Corporate Governance" 
    | "Project & Construction Management" 
    | "Engineering & Technical" 
    | "Contracts & Commercial" 
    | "Finance & Procurement" 
    | "Human Resources & Workforce" 
    | "HSEQ & Assurance" 
    | "Plant, Materials & Logistics" 
    | "IT, Security & Administration" 
    | "External Stakeholders";
  description: string;
  permissions: string[];
  isAdministrative?: boolean;
  isExternal?: boolean;
}

export const STANDARD_ROLES: Record<string, SystemRoleDefinition> = {
  // 1. Systems Administrator
  systems_administrator: {
    id: "systems_administrator",
    name: "Systems Administrator",
    category: "Executive & Corporate Governance",
    description: "Full platform-level administration across company accounts, user provisioning, security architecture, system roles and audit logs.",
    isAdministrative: true,
    permissions: [
      "company.manage",
      "projects.create",
      "projects.update",
      "projects.archive",
      "projects.restore",
      "users.invite",
      "users.manage",
      "roles.manage",
      "permissions.manage",
      "administration.view",
      "administration.manage",
      "administration.*",
      "security.*",
      "settings.*",
      "audit.*",
      "reports.*",
      "dashboard.*",
      "portfolio.*",
      "documents.view"
    ]
  },

  // 2. Company Administrator
  company_administrator: {
    id: "company_administrator",
    name: "Company Administrator",
    category: "Executive & Corporate Governance",
    description: "Full administrative control within company domain: users, roles, permissions, settings, project access, and corporate governance.",
    isAdministrative: true,
    permissions: [
      "dashboard.*",
      "portfolio.*",
      "programme.*",
      "commercial.*",
      "contracts.*",
      "engineering.*",
      "site.*",
      "resources.*",
      "quality.*",
      "hse.*",
      "finance.*",
      "hr.*",
      "documents.*",
      "reports.*",
      "security.*",
      "administration.*"
    ]
  },

  // 3. Managing Director / CEO
  managing_director: {
    id: "managing_director",
    name: "Managing Director / CEO",
    category: "Executive & Corporate Governance",
    description: "Executive APPROVE authority across all company operations, commercial contracts, budgets, variations, claims, and strategic reports.",
    permissions: [
      "dashboard.*",
      "portfolio.*",
      "programme.schedule.view",
      "programme.schedule.approve",
      "commercial.*",
      "contracts.*",
      "engineering.drawings.view",
      "engineering.design.view",
      "engineering.rfi.view",
      "site.dailyDiary.view",
      "site.progress.view",
      "resources.workforce.view",
      "resources.plant.view",
      "resources.materials.view",
      "resources.logistics.view",
      "quality.inspections.view",
      "quality.ncr.view",
      "hse.incidents.view",
      "hse.risks.view",
      "finance.*",
      "hr.employees.view",
      "hr.leave.approve",
      "documents.*",
      "reports.*",
      "security.view",
      "administration.company.view",
      "administration.audit.view"
    ]
  },

  // 4. Chief Operating Officer
  chief_operating_officer: {
    id: "chief_operating_officer",
    name: "Chief Operating Officer",
    category: "Executive & Corporate Governance",
    description: "Operational APPROVE authority across projects, programme, engineering oversight, construction, plant, logistics and procurement.",
    permissions: [
      "dashboard.*",
      "portfolio.*",
      "programme.*",
      "engineering.*",
      "site.*",
      "resources.*",
      "quality.*",
      "hse.*",
      "commercial.financialOverview.view",
      "commercial.budget.view",
      "commercial.costs.view",
      "commercial.procurement.approve",
      "commercial.certificates.view",
      "commercial.variations.approve",
      "contracts.contractRegister.view",
      "contracts.notices.view",
      "contracts.earlyWarnings.view",
      "documents.*",
      "reports.*",
      "security.view"
    ]
  },

  // 5. Project Director
  project_director: {
    id: "project_director",
    name: "Project Director",
    category: "Project & Construction Management",
    description: "Assigned project leadership with APPROVE authority for project decisions, commercial requests, engineering submittals, and site progress.",
    permissions: [
      "dashboard.*",
      "portfolio.view",
      "programme.*",
      "engineering.*",
      "site.*",
      "resources.*",
      "quality.*",
      "hse.*",
      "commercial.*",
      "contracts.*",
      "documents.*",
      "reports.*",
      "security.view"
    ]
  },

  // 6. Project Manager
  project_manager: {
    id: "project_manager",
    name: "Project Manager",
    category: "Project & Construction Management",
    description: "OPERATE / APPROVE for assigned projects: programme, work packages, site activities, RFIs, resources, subcontractors, and risks.",
    permissions: [
      "dashboard.view",
      "programme.schedule.view",
      "programme.schedule.create",
      "programme.schedule.edit",
      "programme.schedule.approve",
      "engineering.drawings.view",
      "engineering.rfi.create",
      "engineering.rfi.edit",
      "engineering.submissions.create",
      "engineering.methodStatements.approve",
      "site.*",
      "resources.workforce.view",
      "resources.workforce.edit",
      "resources.labour.view",
      "resources.labour.edit",
      "resources.plant.view",
      "resources.plant.edit",
      "resources.materials.view",
      "resources.materials.edit",
      "resources.logistics.view",
      "commercial.financialOverview.view",
      "commercial.boq.view",
      "commercial.budget.view",
      "commercial.costs.view",
      "commercial.procurement.create",
      "commercial.procurement.edit",
      "commercial.certificates.view",
      "commercial.variations.create",
      "commercial.claims.create",
      "contracts.contractRegister.view",
      "contracts.correspondence.view",
      "contracts.notices.create",
      "contracts.earlyWarnings.create",
      "quality.*",
      "hse.*",
      "documents.view",
      "documents.create",
      "documents.edit",
      "reports.view",
      "reports.create"
    ]
  },

  // 7. Head of Engineering (Explicit Rule: SAME contractual and commercial-information access as Contracts Manager)
  head_of_engineering: {
    id: "head_of_engineering",
    name: "Head of Engineering",
    category: "Engineering & Technical",
    description: "Company-wide Engineering Authority (ADMIN/APPROVE) with full Contracts Manager contractual & commercial information visibility.",
    permissions: [
      "dashboard.view",
      // Engineering ADMIN / APPROVE
      "engineering.*",
      // Contracts (Full visibility & management equivalent to Contracts Manager)
      "contracts.*",
      // Commercial VIEW / OPERATE
      "commercial.financialOverview.view",
      "commercial.boq.view",
      "commercial.budget.view",
      "commercial.costs.view",
      "commercial.procurement.view",
      "commercial.certificates.view",
      "commercial.variations.view",
      "commercial.claims.view",
      // Programme APPROVE engineering activities
      "programme.schedule.view",
      "programme.schedule.edit",
      "programme.schedule.approve",
      // Site & Resources technical oversight
      "site.dailyDiary.view",
      "site.progress.view",
      "site.inspections.approve",
      "resources.workforce.view",
      "resources.plant.view",
      "resources.materials.view",
      // Quality & HSE oversight
      "quality.*",
      "hse.incidents.view",
      "hse.risks.view",
      "documents.*",
      "reports.*"
    ]
  },

  // 8. Contracts Manager
  contracts_manager: {
    id: "contracts_manager",
    name: "Contracts Manager",
    category: "Contracts & Commercial",
    description: "ADMIN / APPROVE for Contracts: notices, early warnings, compensation events, claims, EOT, disputes, guarantees and subcontract agreements.",
    permissions: [
      "dashboard.view",
      "contracts.*",
      "commercial.financialOverview.view",
      "commercial.boq.view",
      "commercial.budget.view",
      "commercial.costs.view",
      "commercial.certificates.view",
      "commercial.certificates.create",
      "commercial.certificates.edit",
      "commercial.variations.view",
      "commercial.variations.create",
      "commercial.claims.view",
      "commercial.claims.create",
      "commercial.claims.approve",
      "programme.schedule.view",
      "engineering.drawings.view",
      "engineering.submissions.view",
      "site.dailyDiary.view",
      "site.progress.view",
      "documents.*",
      "reports.view"
    ]
  },

  // 9. Commercial Manager
  commercial_manager: {
    id: "commercial_manager",
    name: "Commercial Manager",
    category: "Contracts & Commercial",
    description: "ADMIN / APPROVE for Commercial: BOQ, budgets, cost plans, actual costs, forecasts, EVM, payment certificates, variations and claims.",
    permissions: [
      "dashboard.view",
      "commercial.*",
      "contracts.contractRegister.view",
      "contracts.correspondence.view",
      "contracts.notices.view",
      "contracts.earlyWarnings.view",
      "contracts.eot.view",
      "contracts.compensationEvents.view",
      "contracts.claims.view",
      "procurement.approve",
      "engineering.drawings.view",
      "programme.schedule.view",
      "site.progress.view",
      "documents.view",
      "reports.*"
    ]
  },

  // 10. Quantity Surveyor
  quantity_surveyor: {
    id: "quantity_surveyor",
    name: "Quantity Surveyor",
    category: "Contracts & Commercial",
    description: "OPERATE in Commercial: BOQ measurements, valuations, variations, payment applications, cost reports, and subcontractor assessments.",
    permissions: [
      "dashboard.view",
      "commercial.financialOverview.view",
      "commercial.boq.view",
      "commercial.boq.create",
      "commercial.boq.edit",
      "commercial.budget.view",
      "commercial.costs.view",
      "commercial.costs.create",
      "commercial.costs.edit",
      "commercial.certificates.view",
      "commercial.certificates.create",
      "commercial.certificates.edit",
      "commercial.variations.view",
      "commercial.variations.create",
      "commercial.variations.edit",
      "commercial.claims.view",
      "commercial.claims.create",
      "contracts.contractRegister.view",
      "engineering.drawings.view",
      "programme.schedule.view",
      "site.progress.view",
      "site.inspections.view",
      "documents.view"
    ]
  },

  // 11. Procurement Manager
  procurement_manager: {
    id: "procurement_manager",
    name: "Procurement Manager",
    category: "Finance & Procurement",
    description: "ADMIN / APPROVE in Procurement: requisitions, RFQs, quotations, bid evaluations, purchase orders, vendor performance, materials.",
    permissions: [
      "dashboard.view",
      "commercial.procurement.*",
      "commercial.budget.view",
      "commercial.costs.view",
      "resources.materials.view",
      "resources.materials.create",
      "resources.materials.edit",
      "resources.materials.approve",
      "resources.logistics.view",
      "resources.logistics.create",
      "resources.logistics.edit",
      "contracts.contractRegister.view",
      "documents.view",
      "documents.create",
      "reports.view"
    ]
  },

  // 12. Finance Manager
  finance_manager: {
    id: "finance_manager",
    name: "Finance Manager",
    category: "Finance & Procurement",
    description: "ADMIN / APPROVE Finance: AP/AR, payments, banking, tax, VAT, cash flow, ledgers, reconciliations and payment authorizations.",
    permissions: [
      "dashboard.view",
      "finance.*",
      "commercial.financialOverview.view",
      "commercial.budget.view",
      "commercial.costs.view",
      "commercial.certificates.view",
      "commercial.procurement.view",
      "contracts.contractRegister.view",
      "hr.employees.view",
      "documents.view",
      "reports.*"
    ]
  },

  // 13. Accountant
  accountant: {
    id: "accountant",
    name: "Accountant",
    category: "Finance & Procurement",
    description: "OPERATE Finance: invoice capture, reconciliations, account processing, tax/VAT entries, payroll journal entries.",
    permissions: [
      "dashboard.view",
      "finance.invoices.view",
      "finance.invoices.create",
      "finance.invoices.edit",
      "finance.payments.view",
      "finance.payments.create",
      "finance.payments.edit",
      "finance.bank.view",
      "finance.bank.edit",
      "finance.tax.view",
      "finance.tax.edit",
      "finance.payroll.view",
      "finance.payroll.create",
      "finance.payroll.edit",
      "commercial.costs.view",
      "documents.view"
    ]
  },

  // 14. Human Resources Manager (Core Rule: Full HR and Workforce access without System Administration)
  human_resources_manager: {
    id: "human_resources_manager",
    name: "Human Resources Manager",
    category: "Human Resources & Workforce",
    description: "ADMIN / APPROVE Human Resources and Workforce: employee profiles, labour records, contracts, certifications, attendance, leave, disciplinary.",
    permissions: [
      "dashboard.view",
      // Resources -> Workforce & Labour ADMIN
      "resources.workforce.view",
      "resources.workforce.create",
      "resources.workforce.edit",
      "resources.workforce.delete",
      "resources.workforce.approve",
      "resources.workforce.admin",
      "resources.labour.view",
      "resources.labour.create",
      "resources.labour.edit",
      "resources.labour.approve",
      // HR Module full administration
      "hr.employees.admin",
      "hr.attendance.admin",
      "hr.leave.admin",
      "hr.training.admin",
      "hr.disciplinary.admin",
      "hr.onboarding.admin",
      "hr.employees.*",
      "hr.attendance.*",
      "hr.leave.*",
      "hr.training.*",
      "hr.disciplinary.*",
      "hr.onboarding.*",
      // Site -> Labour OPERATE
      "site.labour.view",
      "site.labour.edit",
      // Linked Plant & Logistics VIEW
      "resources.plant.view",
      "resources.logistics.view",
      // Commercial labour summaries VIEW
      "commercial.costs.view",
      "documents.view",
      "documents.create",
      "reports.view"
    ]
  },

  // 15. HR Officer
  hr_officer: {
    id: "hr_officer",
    name: "HR Officer",
    category: "Human Resources & Workforce",
    description: "OPERATE Workforce: employee onboarding, attendance, leave requests, timesheets, training records, employee documents.",
    permissions: [
      "dashboard.view",
      "resources.workforce.view",
      "resources.workforce.create",
      "resources.workforce.edit",
      "resources.labour.view",
      "resources.labour.create",
      "resources.labour.edit",
      "hr.employees.view",
      "hr.employees.create",
      "hr.employees.edit",
      "hr.attendance.view",
      "hr.attendance.create",
      "hr.attendance.edit",
      "hr.leave.view",
      "hr.leave.create",
      "hr.training.view",
      "hr.training.create",
      "hr.onboarding.view",
      "hr.onboarding.create",
      "site.labour.view",
      "documents.view"
    ]
  },

  // 16. Engineering Manager
  engineering_manager: {
    id: "engineering_manager",
    name: "Engineering Manager",
    category: "Engineering & Technical",
    description: "APPROVE Engineering: engineering teams, drawings, RFIs, technical submissions, method statements, survey, calculations.",
    permissions: [
      "dashboard.view",
      "engineering.drawings.view",
      "engineering.drawings.create",
      "engineering.drawings.edit",
      "engineering.drawings.approve",
      "engineering.design.view",
      "engineering.design.edit",
      "engineering.design.approve",
      "engineering.rfi.*",
      "engineering.submissions.*",
      "engineering.methodStatements.*",
      "engineering.survey.*",
      "engineering.bim.*",
      "engineering.calculations.*",
      "contracts.contractRegister.view",
      "commercial.boq.view",
      "commercial.budget.view",
      "programme.schedule.view",
      "programme.schedule.edit",
      "site.inspections.view",
      "site.progress.view",
      "quality.itp.view",
      "documents.*",
      "reports.view"
    ]
  },

  // 17. Civil Engineer
  civil_engineer: {
    id: "civil_engineer",
    name: "Civil Engineer",
    category: "Engineering & Technical",
    description: "OPERATE Engineering: create RFIs, review drawings, submit technical documents, progress updates, inspection requests, calculations.",
    permissions: [
      "dashboard.view",
      "engineering.drawings.view",
      "engineering.drawings.create",
      "engineering.drawings.edit",
      "engineering.rfi.view",
      "engineering.rfi.create",
      "engineering.rfi.edit",
      "engineering.submissions.view",
      "engineering.submissions.create",
      "engineering.submissions.edit",
      "engineering.methodStatements.view",
      "engineering.methodStatements.create",
      "engineering.calculations.view",
      "engineering.calculations.create",
      "programme.schedule.view",
      "commercial.boq.view",
      "site.progress.view",
      "site.inspections.create",
      "quality.inspections.create",
      "documents.view",
      "documents.create"
    ]
  },

  // 18. Site Engineer
  site_engineer: {
    id: "site_engineer",
    name: "Site Engineer",
    category: "Project & Construction Management",
    description: "OPERATE Site + Engineering: daily works, site diaries, inspections, quantities, RFIs, work fronts, labour/plant allocation, photographs.",
    permissions: [
      "dashboard.view",
      "site.dailyDiary.view",
      "site.dailyDiary.create",
      "site.dailyDiary.edit",
      "site.progress.view",
      "site.progress.create",
      "site.progress.edit",
      "site.inspections.view",
      "site.inspections.create",
      "site.inspections.edit",
      "site.workfronts.view",
      "site.workfronts.edit",
      "site.labour.view",
      "site.labour.edit",
      "site.plant.view",
      "site.plant.edit",
      "site.materials.view",
      "site.materials.edit",
      "engineering.drawings.view",
      "engineering.rfi.create",
      "engineering.rfi.view",
      "programme.schedule.view",
      "commercial.boq.view",
      "quality.inspections.create",
      "documents.view",
      "documents.create"
    ]
  },

  // 19. Resident Engineer
  resident_engineer: {
    id: "resident_engineer",
    name: "Resident Engineer",
    category: "Engineering & Technical",
    description: "APPROVE technical and site activities for assigned projects: contractor submissions, inspections, instructions, testing and QA/QC.",
    permissions: [
      "dashboard.view",
      "engineering.drawings.view",
      "engineering.rfi.approve",
      "engineering.submissions.approve",
      "engineering.methodStatements.approve",
      "site.dailyDiary.view",
      "site.inspections.approve",
      "site.progress.view",
      "quality.inspections.approve",
      "quality.ncr.approve",
      "quality.testing.view",
      "quality.itp.approve",
      "programme.schedule.view",
      "contracts.correspondence.view",
      "documents.view"
    ]
  },

  // 20. Planning Engineer
  planning_engineer: {
    id: "planning_engineer",
    name: "Planning Engineer",
    category: "Engineering & Technical",
    description: "ADMIN / OPERATE Programme: WBS, baseline programme, schedules, CPM, look-aheads, delays, progress updates, earned schedule.",
    permissions: [
      "dashboard.view",
      "programme.schedule.*",
      "commercial.financialOverview.view",
      "commercial.boq.view",
      "site.progress.view",
      "site.dailyDiary.view",
      "engineering.drawings.view",
      "contracts.eot.view",
      "documents.view",
      "reports.*"
    ]
  },

  // 21. Surveyor
  surveyor: {
    id: "surveyor",
    name: "Surveyor",
    category: "Engineering & Technical",
    description: "OPERATE Survey module: survey points, coordinates, levels, setting out, benchmarks, as-built surveys, quantities and reports.",
    permissions: [
      "dashboard.view",
      "engineering.survey.view",
      "engineering.survey.create",
      "engineering.survey.edit",
      "engineering.drawings.view",
      "site.progress.view",
      "site.inspections.view",
      "documents.view",
      "documents.create"
    ]
  },

  // 22. QA/QC Manager
  qa_qc_manager: {
    id: "qa_qc_manager",
    name: "QA/QC Manager",
    category: "HSEQ & Assurance",
    description: "ADMIN / APPROVE QA/QC: ITPs, inspections, NCRs, material approvals, test results, checklists, quality plans, corrective actions.",
    permissions: [
      "dashboard.view",
      "quality.*",
      "engineering.drawings.view",
      "engineering.submissions.view",
      "site.inspections.view",
      "resources.materials.view",
      "documents.view",
      "documents.create",
      "reports.view"
    ]
  },

  // 23. QA/QC Engineer
  qa_qc_engineer: {
    id: "qa_qc_engineer",
    name: "QA/QC Engineer",
    category: "HSEQ & Assurance",
    description: "OPERATE QA/QC: create and edit inspections, NCRs, laboratory tests, and quality records (with segregation of duties on own NCR closure).",
    permissions: [
      "dashboard.view",
      "quality.inspections.view",
      "quality.inspections.create",
      "quality.inspections.edit",
      "quality.ncr.view",
      "quality.ncr.create",
      "quality.ncr.edit",
      "quality.testing.view",
      "quality.testing.create",
      "quality.testing.edit",
      "quality.itp.view",
      "engineering.drawings.view",
      "site.inspections.view",
      "documents.view"
    ]
  },

  // 24. HSE Manager
  hse_manager: {
    id: "hse_manager",
    name: "HSE Manager",
    category: "HSEQ & Assurance",
    description: "ADMIN / APPROVE HSE: incidents, hazards, risk assessments, toolbox talks, work permits, safety inductions, environmental audits.",
    permissions: [
      "dashboard.view",
      "hse.*",
      "resources.workforce.view",
      "site.inspections.view",
      "site.dailyDiary.view",
      "documents.view",
      "documents.create",
      "reports.*"
    ]
  },

  // 25. Safety Officer
  safety_officer: {
    id: "safety_officer",
    name: "Safety Officer",
    category: "HSEQ & Assurance",
    description: "OPERATE HSE: site inspections, incident logs, safety observations, inductions, toolbox talks, permit administration.",
    permissions: [
      "dashboard.view",
      "hse.incidents.view",
      "hse.incidents.create",
      "hse.incidents.edit",
      "hse.risks.view",
      "hse.risks.create",
      "hse.risks.edit",
      "hse.permits.view",
      "hse.permits.create",
      "hse.toolbox.view",
      "hse.toolbox.create",
      "hse.induction.view",
      "hse.induction.create",
      "site.inspections.view",
      "documents.view"
    ]
  },

  // 26. Construction Manager
  construction_manager: {
    id: "construction_manager",
    name: "Construction Manager",
    category: "Project & Construction Management",
    description: "APPROVE Site operations: work fronts, site programme, site staff, plant, materials, subcontractor coordination, daily progress.",
    permissions: [
      "dashboard.view",
      "site.*",
      "programme.schedule.view",
      "engineering.drawings.view",
      "engineering.rfi.create",
      "resources.workforce.view",
      "resources.workforce.edit",
      "resources.plant.view",
      "resources.plant.edit",
      "resources.materials.view",
      "resources.materials.edit",
      "quality.inspections.view",
      "hse.incidents.view",
      "commercial.boq.view",
      "documents.view"
    ]
  },

  // 27. Site Agent
  site_agent: {
    id: "site_agent",
    name: "Site Agent",
    category: "Project & Construction Management",
    description: "OPERATE Site: daily works execution, site staff allocation, plant utilization, material staging, site diaries and production tracking.",
    permissions: [
      "dashboard.view",
      "site.dailyDiary.view",
      "site.dailyDiary.create",
      "site.dailyDiary.edit",
      "site.progress.view",
      "site.progress.create",
      "site.progress.edit",
      "site.workfronts.view",
      "site.workfronts.edit",
      "site.labour.view",
      "site.labour.edit",
      "site.plant.view",
      "site.plant.edit",
      "site.materials.view",
      "resources.workforce.view",
      "resources.plant.view",
      "resources.materials.view",
      "engineering.drawings.view",
      "documents.view"
    ]
  },

  // 28. General Foreman
  general_foreman: {
    id: "general_foreman",
    name: "General Foreman",
    category: "Project & Construction Management",
    description: "OPERATE field execution: staff teams, daily allocations, labour attendance, equipment requisitions, material staging, daily production logs.",
    permissions: [
      "dashboard.view",
      "site.dailyDiary.view",
      "site.dailyDiary.create",
      "site.progress.view",
      "site.progress.create",
      "site.labour.view",
      "site.labour.edit",
      "site.plant.view",
      "site.materials.view",
      "resources.workforce.view",
      "engineering.drawings.view"
    ]
  },

  // 29. Foreman
  foreman: {
    id: "foreman",
    name: "Foreman",
    category: "Project & Construction Management",
    description: "OPERATE assigned work fronts: assign tradesmen, record attendance, track quantities completed, submit daily updates.",
    permissions: [
      "site.dailyDiary.view",
      "site.dailyDiary.create",
      "site.progress.view",
      "site.progress.create",
      "site.labour.view",
      "site.labour.edit",
      "resources.workforce.view"
    ]
  },

  // 30. Plant Manager
  plant_manager: {
    id: "plant_manager",
    name: "Plant Manager",
    category: "Plant, Materials & Logistics",
    description: "ADMIN / APPROVE Plant: equipment fleet, plant registry, utilization, operator assignments, maintenance, fuel logs, breakdown tracking.",
    permissions: [
      "dashboard.view",
      "resources.plant.*",
      "site.plant.view",
      "site.plant.edit",
      "commercial.procurement.create",
      "commercial.costs.view",
      "documents.view",
      "reports.view"
    ]
  },

  // 31. Plant Officer
  plant_officer: {
    id: "plant_officer",
    name: "Plant Officer",
    category: "Plant, Materials & Logistics",
    description: "OPERATE Plant: plant movements, daily fuel capture, operating hours, routine inspections, maintenance tickets.",
    permissions: [
      "dashboard.view",
      "resources.plant.view",
      "resources.plant.create",
      "resources.plant.edit",
      "site.plant.view",
      "site.plant.edit",
      "documents.view"
    ]
  },

  // 32. Materials Manager
  materials_manager: {
    id: "materials_manager",
    name: "Materials Manager",
    category: "Plant, Materials & Logistics",
    description: "ADMIN / APPROVE Materials: inventory registry, stock on hand, delivery receipts, consumption tracking, mill certificates, reconciliations.",
    permissions: [
      "dashboard.view",
      "resources.materials.*",
      "commercial.procurement.create",
      "commercial.procurement.edit",
      "commercial.boq.view",
      "site.materials.view",
      "documents.view",
      "reports.view"
    ]
  },

  // 33. Materials Engineer
  materials_engineer: {
    id: "materials_engineer",
    name: "Materials Engineer",
    category: "Plant, Materials & Logistics",
    description: "OPERATE Materials + QA/QC: material approvals, technical specifications, mix designs, laboratory test results, compliance.",
    permissions: [
      "dashboard.view",
      "resources.materials.view",
      "resources.materials.create",
      "resources.materials.edit",
      "quality.testing.view",
      "quality.testing.create",
      "quality.testing.edit",
      "engineering.submissions.view",
      "engineering.submissions.create",
      "documents.view"
    ]
  },

  // 34. Storekeeper
  storekeeper: {
    id: "storekeeper",
    name: "Storekeeper",
    category: "Plant, Materials & Logistics",
    description: "OPERATE Stores: receive goods, issue stock, maintain batch records, conduct physical counts, process internal site transfers.",
    permissions: [
      "resources.materials.view",
      "resources.materials.create",
      "resources.materials.edit",
      "site.materials.view",
      "documents.view"
    ]
  },

  // 35. Logistics Manager
  logistics_manager: {
    id: "logistics_manager",
    name: "Logistics Manager",
    category: "Plant, Materials & Logistics",
    description: "ADMIN / APPROVE Logistics: fleet movements, freight consignments, site transport, delivery dispatch, accommodation.",
    permissions: [
      "dashboard.view",
      "resources.logistics.*",
      "resources.workforce.view",
      "resources.plant.view",
      "resources.materials.view",
      "documents.view",
      "reports.view"
    ]
  },

  // 36. Logistics Officer
  logistics_officer: {
    id: "logistics_officer",
    name: "Logistics Officer",
    category: "Plant, Materials & Logistics",
    description: "OPERATE Logistics: daily transport logs, dispatch manifests, consignment tracking, waypoint updates.",
    permissions: [
      "dashboard.view",
      "resources.logistics.view",
      "resources.logistics.create",
      "resources.logistics.edit",
      "documents.view"
    ]
  },

  // 37. Document Controller
  document_controller: {
    id: "document_controller",
    name: "Document Controller",
    category: "IT, Security & Administration",
    description: "ADMIN Document Repository: upload, classify, distribute, revise, transmittals, revision control, OCR indexing.",
    permissions: [
      "dashboard.view",
      "documents.*",
      "engineering.drawings.view",
      "engineering.submissions.view",
      "contracts.contractRegister.view",
      "reports.view"
    ]
  },

  // 38. IT Administrator
  it_administrator: {
    id: "it_administrator",
    name: "IT Administrator",
    category: "IT, Security & Administration",
    description: "ADMIN Technical Infrastructure: user accounts, authentication, integrations, API keys, security policy, backups, SSO/MFA.",
    isAdministrative: true,
    permissions: [
      "dashboard.view",
      "administration.users.*",
      "administration.roles.view",
      "administration.integrations.*",
      "administration.audit.*",
      "security.*"
    ]
  },

  // 39. Security Manager
  security_manager: {
    id: "security_manager",
    name: "Security Manager",
    category: "IT, Security & Administration",
    description: "ADMIN Security: guard rosters, access control posts, incident logs, visitor registers, patrol sweeps, site perimeter protection.",
    permissions: [
      "dashboard.view",
      "security.*",
      "resources.workforce.view",
      "resources.logistics.view",
      "documents.view",
      "reports.view"
    ]
  },

  // 40. Security Officer
  security_officer: {
    id: "security_officer",
    name: "Security Officer",
    category: "IT, Security & Administration",
    description: "OPERATE Security: record visitors, gate entry logs, security incident reports, patrol checklists, shift handover.",
    permissions: [
      "security.view",
      "security.create",
      "security.edit"
    ]
  },

  // 41. Client Representative
  client_representative: {
    id: "client_representative",
    name: "Client Representative",
    category: "External Stakeholders",
    description: "VIEW / APPROVE within assigned project scope: project dashboards, approved programme, certificates, drawings, RFIs, QA/QC.",
    isExternal: true,
    permissions: [
      "dashboard.view",
      "programme.schedule.view",
      "commercial.financialOverview.view",
      "commercial.certificates.view",
      "commercial.certificates.approve",
      "commercial.variations.view",
      "commercial.variations.approve",
      "contracts.contractRegister.view",
      "contracts.correspondence.view",
      "engineering.drawings.view",
      "engineering.rfi.view",
      "quality.inspections.view",
      "quality.ncr.view",
      "hse.incidents.view",
      "reports.view",
      "documents.view"
    ]
  },

  // 42. Consultant / Engineer
  consultant_engineer: {
    id: "consultant_engineer",
    name: "Consultant / Engineer",
    category: "External Stakeholders",
    description: "Technical review and engineering instructions per professional appointment: drawings, technical submittals, RFIs, certificates.",
    isExternal: true,
    permissions: [
      "dashboard.view",
      "engineering.drawings.view",
      "engineering.submissions.view",
      "engineering.submissions.approve",
      "engineering.rfi.view",
      "engineering.rfi.approve",
      "programme.schedule.view",
      "quality.inspections.view",
      "quality.inspections.approve",
      "site.inspections.view",
      "commercial.certificates.view",
      "documents.view"
    ]
  },

  // 43. Auditor
  auditor: {
    id: "auditor",
    name: "Auditor",
    category: "External Stakeholders",
    description: "READ-ONLY across financial, commercial, procurement, contracts, and audit trails without transaction modification capability.",
    isExternal: true,
    permissions: [
      "dashboard.view",
      "portfolio.view",
      "commercial.financialOverview.view",
      "commercial.boq.view",
      "commercial.budget.view",
      "commercial.costs.view",
      "commercial.procurement.view",
      "commercial.certificates.view",
      "contracts.contractRegister.view",
      "finance.invoices.view",
      "finance.payments.view",
      "finance.tax.view",
      "administration.audit.view",
      "documents.view",
      "reports.view"
    ]
  },

  // 44. Subcontractor
  subcontractor: {
    id: "subcontractor",
    name: "Subcontractor",
    category: "External Stakeholders",
    description: "Limited access to assigned subcontract scope: view drawings, programme activities, submit progress, invoices, RFIs, and safety logs.",
    isExternal: true,
    permissions: [
      "programme.schedule.view",
      "engineering.drawings.view",
      "engineering.rfi.view",
      "engineering.rfi.create",
      "site.progress.create",
      "hse.incidents.create",
      "documents.view",
      "documents.create"
    ]
  },

  // 45. Supplier
  supplier: {
    id: "supplier",
    name: "Supplier",
    category: "External Stakeholders",
    description: "Supplier Portal access: receive RFQs, submit quotations, view purchase orders, submit delivery manifests and invoices.",
    isExternal: true,
    permissions: [
      "commercial.procurement.view",
      "commercial.procurement.create",
      "resources.materials.view",
      "documents.view",
      "documents.create"
    ]
  },

  // 46. General Employee
  general_employee: {
    id: "general_employee",
    name: "General Employee",
    category: "Human Resources & Workforce",
    description: "Personal and assigned work information: own profile, leave requests, attendance, timesheets, training notices, HSE briefings.",
    permissions: [
      "hr.employees.view",
      "hr.leave.view",
      "hr.leave.create",
      "hr.attendance.view",
      "hr.training.view",
      "hse.toolbox.view",
      "hse.induction.view"
    ]
  },

  // 47. Read-Only Executive
  read_only_executive: {
    id: "read_only_executive",
    name: "Read-Only Executive",
    category: "Executive & Corporate Governance",
    description: "VIEW across executive information: portfolio dashboard, project dashboards, programme, budget summaries, performance, risks.",
    permissions: [
      "dashboard.view",
      "portfolio.view",
      "programme.schedule.view",
      "commercial.financialOverview.view",
      "commercial.budget.view",
      "commercial.costs.view",
      "contracts.contractRegister.view",
      "resources.workforce.view",
      "resources.plant.view",
      "reports.view",
      "documents.view"
    ]
  }
};

export interface RoleOption {
  value: string;
  label: string;
  group: string;
  description?: string;
}

/**
 * Dropdown options for UI selectors (deduplicated by role id)
 */
export const ROLE_OPTIONS: RoleOption[] = (() => {
  const seen = new Set<string>();
  const list: RoleOption[] = [];
  for (const role of Object.values(STANDARD_ROLES)) {
    if (role && role.id && !seen.has(role.id)) {
      seen.add(role.id);
      list.push({
        value: role.id,
        label: role.name,
        group: role.category,
        description: role.description
      });
    }
  }
  return list;
})();

export type MasterRoleValue = keyof typeof STANDARD_ROLES | string;

export const LEGACY_ROLE_LABELS: string[] = [
  "Finance Directorate",
  "Accounts",
  "Human Resources",
  "General Worker",
  "Consultant",
  "Auditor",
  "Supplier"
];

export const LEGACY_ROLE_MAP: Record<string, string> = Object.values(STANDARD_ROLES).reduce((acc, r) => {
  acc[r.id] = r.name;
  return acc;
}, {} as Record<string, string>);

export function getRoleLabel(roleId: string): string {
  const canon = normalizeRoleId(roleId);
  return STANDARD_ROLES[canon]?.name || roleId;
}

export function isActiveRole(roleId: string): boolean {
  const canon = normalizeRoleId(roleId);
  return !!STANDARD_ROLES[canon];
}

/**
 * Normalization helper to map any casing or aliases to canonical role ID
 */
export function normalizeRoleId(roleNameOrId: string | null | undefined): string {
  if (!roleNameOrId) return "general_employee";
  const clean = roleNameOrId.toLowerCase().trim().replace(/[\s\/-]+/g, "_");

  const aliasMap: Record<string, string> = {
    ceo: "managing_director",
    managing_director: "managing_director",
    managing_director_ceo: "managing_director",
    coo: "chief_operating_officer",
    chief_operating_officer: "chief_operating_officer",
    cfo: "finance_manager",
    director: "project_director",
    project_director: "project_director",
    project_manager: "project_manager",
    assistant_project_manager: "project_manager",
    site_agent_manager: "site_agent",
    site_agent: "site_agent",
    site_manager: "construction_manager",
    construction_manager: "construction_manager",
    head_of_engineering: "head_of_engineering",
    contracts_manager: "contracts_manager",
    commercial_manager: "commercial_manager",
    quantity_surveyor: "quantity_surveyor",
    lead_commercial_qs: "quantity_surveyor",
    procurement: "procurement_manager",
    procurement_manager: "procurement_manager",
    procurement_officer: "procurement_manager",
    finance: "finance_manager",
    finance_manager: "finance_manager",
    accountant: "accountant",
    accounts: "accountant",
    human_resources: "human_resources_manager",
    human_resources_manager: "human_resources_manager",
    hr_manager: "human_resources_manager",
    hr_officer: "hr_officer",
    engineering_manager: "engineering_manager",
    senior_engineer: "civil_engineer",
    civil_engineer: "civil_engineer",
    site_engineer: "site_engineer",
    junior_engineer: "site_engineer",
    project_engineer: "civil_engineer",
    resident_engineer: "resident_engineer",
    resident_project_engineer: "resident_engineer",
    planning_engineer: "planning_engineer",
    planner: "planning_engineer",
    surveyor: "surveyor",
    senior_geomatic_surveyor: "surveyor",
    qa_qc_manager: "qa_qc_manager",
    qa_qc_engineer: "qa_qc_engineer",
    quality: "qa_qc_manager",
    hse_manager: "hse_manager",
    hse_safety_manager: "hse_manager",
    safety_officer: "safety_officer",
    hse: "hse_manager",
    general_foreman: "general_foreman",
    general_site_foreman: "general_foreman",
    foreman: "foreman",
    plant_manager: "plant_manager",
    plant_officer: "plant_officer",
    materials_manager: "materials_manager",
    materials_engineer: "materials_engineer",
    storekeeper: "storekeeper",
    logistics_manager: "logistics_manager",
    logistics_officer: "logistics_officer",
    document_controller: "document_controller",
    it_administrator: "it_administrator",
    security_manager: "security_manager",
    security_officer: "security_officer",
    client_representative: "client_representative",
    consultant_engineer: "consultant_engineer",
    consultant: "consultant_engineer",
    auditor: "auditor",
    subcontractor: "subcontractor",
    supplier: "supplier",
    general_employee: "general_employee",
    general_worker: "general_employee",
    viewer: "read_only_executive",
    read_only_executive: "read_only_executive",
    company_admin: "company_administrator",
    company_administrator: "company_administrator",
    super_admin: "systems_administrator",
    system_admin: "systems_administrator",
    systems_admin: "systems_administrator",
    system_administrator: "systems_administrator",
    systems_administrator: "systems_administrator",
    sys_admin: "systems_administrator",
    admin: "company_administrator"
  };

  return aliasMap[clean] || clean;
}

export function getRoleDefinition(role: string | null | undefined): SystemRoleDefinition | null { return STANDARD_ROLES[normalizeRoleId(role)] || null; }
