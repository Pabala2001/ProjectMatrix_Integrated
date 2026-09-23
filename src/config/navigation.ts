import { 
  Globe, 
  Layers, 
  Briefcase, 
  Calendar, 
  Calculator, 
  Compass, 
  FileSpreadsheet, 
  BookOpen, 
  CheckSquare, 
  Shield, 
  Folder, 
  Sparkles, 
  Wrench, 
  Settings, 
  Wallet, 
  Coins, 
  Truck, 
  Users, 
  MessageSquare, 
  BarChart3, 
  AlertTriangle, 
  FileText, 
  Activity, 
  Clock, 
  FileCheck,
  Building,
  HardHat,
  Award,
  CheckCircle2,
  DollarSign,
  Boxes,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Camera,
  Search,
  LucideIcon
} from "lucide-react";
import { DirectoryKey } from "./accessControl";

export interface NavigationChildItem {
  title: string;
  href: string;
  icon?: LucideIcon;
  permission?: string;
  accessKey?: DirectoryKey;
  unrestricted?: boolean;
  badge?: string;
  badgeColor?: string;
  description?: string;
}

export interface NavigationDomainItem {
  title: string;
  href?: string;
  icon?: LucideIcon;
  permission?: string;
  accessKey?: DirectoryKey;
  unrestricted?: boolean;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  section?: "executive" | "projects" | "commercial" | "resources" | "governance" | "intelligence" | "settings";
  children?: NavigationChildItem[];
}

/**
 * Project Matrix Central Navigation Definition
 * Restructured with granular permission keys (module.submodule.action)
 */
export const navigation: NavigationDomainItem[] = [
  // --- 1. EXECUTIVE ---
  {
    title: "Executive",
    icon: Globe,
    permission: "dashboard.view",
    section: "executive",
    children: [
      {
        title: "Command Centre",
        href: "/command",
        icon: Globe,
        permission: "dashboard.view",
        description: "Global Multi-Corridor Command Centre"
      },
      {
        title: "Portfolio",
        href: "/portfolio",
        icon: Layers,
        permission: "portfolio.view",
        description: "Portfolio Health & Decision Matrix (27 Projects)"
      }
    ]
  },

  // --- 2. PROJECTS ---
  {
    title: "Projects",
    icon: Building,
    permission: "dashboard.view",
    section: "projects",
    children: [
      {
        title: "Project Overview",
        href: "/projects",
        icon: Building,
        permission: "dashboard.view",
        description: "Project Delivery Hub & Health Summary"
      },
      {
        title: "My Actions",
        href: "/actions",
        icon: CheckSquare,
        permission: "dashboard.view",
        badge: "5",
        badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        description: "Consequential Decisions & Approvals"
      },
      {
        title: "Programme",
        href: "/controls/programme",
        icon: Calendar,
        permission: "programme.schedule.view",
        description: "CPM Schedule, Milestones & Critical Path"
      },
      {
        title: "Engineering",
        href: "/engineering",
        icon: Layers,
        permission: "engineering.drawings.view",
        badge: "RFIs & Change",
        badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        description: "RFIs, Submittals, Assurance, Change Control & Survey"
      },
      {
        title: "Site",
        href: "/site",
        icon: HardHat,
        permission: "site.dailyDiary.view",
        description: "Daily Reports, Site Diaries & Inspections"
      },
      { title: "Detailed Reports", href: "/reports", icon: FileText, permission: "reports.view" },
      { title: "Site Diary Register", href: "/site-diaries", icon: BookOpen, permission: "site.dailyDiary.view" },
      {
        title: "Documents",
        href: "/documents",
        icon: Folder,
        permission: "documents.view",
        description: "Document Repository & Extraction Pipeline"
      }
    ]
  },

  // --- 3. COMMERCIAL ---
  {
    title: "Commercial",
    icon: Coins,
    permission: "commercial.financialOverview.view",
    section: "commercial",
    children: [
      {
        title: "Overview",
        href: "/commercial/overview",
        icon: Coins,
        permission: "commercial.financialOverview.view",
        description: "Source-Driven Project Commercial Summary"
      },
      {
        title: "Budget & Forecast",
        href: "/commercial/budget-forecast",
        icon: Calculator,
        permission: "commercial.budget.view",
        description: "Approved Budgets & Outturn Cost Forecasts"
      },
      {
        title: "Commitments",
        href: "/commercial/commitments",
        icon: Truck,
        permission: "commercial.procurement.view",
        description: "Purchase Orders, Subcontracts & Commitments"
      },
      {
        title: "Actual Costs",
        href: "/commercial/actual-costs",
        icon: DollarSign,
        permission: "commercial.costs.view",
        description: "Posted Invoices, Direct Costs & Journals"
      },
      {
        title: "Client Accounts",
        href: "/commercial/client-accounts",
        icon: FileCheck,
        permission: "commercial.certificates.view",
        description: "Interim Payment Certificates & Client Claims"
      },
      {
        title: "Supplier Accounts",
        href: "/commercial/supplier-accounts",
        icon: Building,
        permission: "commercial.costs.view",
        description: "Supplier Invoices, Credit Notes & Payables"
      },
      {
        title: "Cash & Bank",
        href: "/commercial/cash-bank",
        icon: Wallet,
        permission: "commercial.cashflow.view",
        description: "Reconciled Bank Statements & Cash Movements"
      },
      {
        title: "Reports & Audit",
        href: "/commercial/reports-audit",
        icon: FileText,
        permission: "commercial.financialOverview.view",
        description: "Commercial Reports, Provenance & Audit Trail"
      },
      { title: "Procurement & Inventory", href: "/commercial/procurement-register", icon: Truck, permission: "commercial.procurement.view" },
      { title: "Accounts Register", href: "/commercial/accounts-register", icon: Wallet, permission: "commercial.financialOverview.view" }
    ]
  },

  // --- 4. RESOURCES ---
  {
    title: "Resources",
    icon: Users,
    permission: "resources.workforce.view",
    section: "resources",
    children: [
      {
        title: "Workforce",
        href: "/resources?tab=workforce",
        icon: Users,
        permission: "resources.workforce.view",
        description: "People, Staff Teams, Artisans & Competency Matrix"
      },
      {
        title: "Plant",
        href: "/resources?tab=plant",
        icon: Truck,
        permission: "resources.plant.view",
        description: "Fleet Machinery, Allocation, Operating Hours & Maintenance"
      },
      {
        title: "Materials",
        href: "/resources?tab=materials",
        icon: Boxes,
        permission: "resources.materials.view",
        description: "Raw Materials Inventory, Consumption & Batching"
      },
      {
        title: "Logistics",
        href: "/resources?tab=logistics",
        icon: Truck,
        permission: "resources.logistics.view",
        description: "Site Transport, Freight Consignments & Movement"
      }
    ]
  },

  // --- 5. GOVERNANCE ---
  {
    title: "Governance",
    icon: Shield,
    permission: "quality.inspections.view",
    section: "governance",
    children: [
      {
        title: "HSEQ",
        href: "/hseq",
        icon: ShieldCheck,
        permission: "quality.inspections.view",
        description: "Quality ITPs, Safety HSE & Environmental Audits"
      },
      {
        title: "Contracts",
        href: "/governance/contracts",
        icon: Scale,
        permission: "contracts.contractRegister.view",
        description: "FIDIC Administration, Notices & Securities"
      },
      {
        title: "Risk & Issues",
        href: "/governance/risks",
        icon: AlertTriangle,
        permission: "hse.risks.view",
        description: "Early Warning Radar & Delay Registers"
      },
      {
        title: "Administration",
        href: "/administration",
        icon: Settings,
        permission: "administration.company.view",
        accessKey: "administration",
        description: "Company Profile, Roles, Permissions, Security & Audit Ledger"
      },
      { title: "Human Resources", href: "/administration/hr", icon: Users, permission: "hr.employees.view" },
      { title: "Communication", href: "/administration/communication", icon: MessageSquare, permission: "contracts.correspondence.view" }
    ]
  },

  // --- 6. INTELLIGENCE ---
  {
    title: "Intelligence",
    icon: Sparkles,
    permission: "dashboard.view",
    section: "intelligence",
    children: [
      {
        title: "Project Advisor",
        href: "/intelligence/advisor",
        icon: Sparkles,
        permission: "dashboard.view",
        badge: "AI Agent",
        badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        description: "Multi-Agent Advisory & Delay Reasoning"
      },
      {
        title: "Reports",
        href: "/intelligence/reports",
        icon: BarChart3,
        permission: "reports.view",
        description: "Consolidated Executive Reports & EVM"
      },
      {
        title: "Knowledge",
        href: "/intelligence/knowledge",
        icon: BookOpen,
        permission: "documents.view",
        description: "Vector Indexed Engineering Standards & Caselaw"
      },
      { title: "Advisor V2", href: "/project-advisor-2", icon: Sparkles, permission: "dashboard.view" }
    ]
  },
  { title: "Billing", icon: Wallet, section: "settings", children: [
    { title: "Subscriptions", href: "/billing/subscriptions", permission: "billing.view", icon: Wallet },
    { title: "Payment History", href: "/billing/payment-history", permission: "billing.view", icon: FileText },
    { title: "Payment Methods", href: "/billing/payment-methods", permission: "billing.view", icon: Coins }
  ] },
  { title: "Settings", href: "/settings", icon: Settings, permission: "settings.view", section: "settings" },
];
