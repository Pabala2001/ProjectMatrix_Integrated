import React, { useState } from "react";
import {
  FileText,
  DollarSign,
  Calendar,
  ShieldCheck,
  HardHat,
  TrendingUp,
  Layers,
  Users,
  Compass,
  Building2,
  Zap,
  Landmark,
  Briefcase,
  AlertTriangle,
  Activity,
  CheckCircle2,
  BarChart3,
  ArrowRight,
  BookOpen,
  Scale,
  Sparkles,
  Search,
  Globe,
  Award,
  ChevronRight,
  Download,
  X,
  FileSpreadsheet,
  Check,
  Clock,
  ExternalLink,
  Shield,
  PhoneCall,
  Mail,
  MapPin
} from "lucide-react";
import { ProjectMatrixBrandMark } from "./SignInPage";

interface LandingSectionsProps {
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
}

interface ResourceItem {
  id: string;
  title: string;
  category: string;
  readTime: string;
  badge: string;
  summary: string;
  keyPoints: string[];
  recommendedFor: string;
  fullGuideContent: string[];
}

const RESOURCES_DATA: ResourceItem[] = [
  {
    id: "fidic-nec4-playbook",
    title: "FIDIC & NEC4 Contractual Claims & Notices Playbook",
    category: "Contract Administration",
    readTime: "8 min read",
    badge: "Essential Guide",
    summary: "A practical clause-by-clause manual for timely early warnings, compensation event notifications, and delay claims under FIDIC (Red/Yellow 1999 & 2017) and NEC3/NEC4 ECC.",
    recommendedFor: "Contract Managers, Commercial Leads, Quantity Surveyors",
    keyPoints: [
      "Strict time-bars: NEC4 Clause 61.3 (8-week contractor time-bar) & FIDIC Clause 20.1 / 20.2 (28-day notice bar).",
      "Early Warning Registers: How to proactively convene Risk Reduction meetings to safeguard entitlements.",
      "Time-Impact Analysis (TIA): As-planned vs as-built schedule delay substantiation requirements.",
      "Contemporaneous records: Establishing bulletproof plant, labour, and weather logs."
    ],
    fullGuideContent: [
      "In contemporary capital engineering projects, over 65% of legitimate commercial claims are rejected not due to merit, but due to procedural time-bars and lack of contemporaneous records.",
      "Under NEC4 ECC Option A to F, Clause 61.3 dictates that if the Contractor fails to notify a compensation event within eight weeks of becoming aware of the event, the Contractor is barred from any change to the Prices, the Completion Date, or a Key Date.",
      "Under FIDIC 2017, Clause 20.2 reinforces the 28-day notice requirement with mandatory initial determinations by the Engineer within 42 days. Project Matrix automates the notice countdown from the date an occurrence is first logged in the Site Diary.",
      "Best Practice Rule: Always issue notices with unambiguous contractual references, schedule milestone cross-references, and estimated preliminary quantum to prevent prejudice to the Employer."
    ]
  },
  {
    id: "evm-compendium",
    title: "Earned Value Management (EVM) Formula & Benchmark Compendium",
    category: "Programme & Cost Controls",
    readTime: "6 min read",
    badge: "Reference Sheet",
    summary: "Clear mathematical definitions, diagnostic interpretations, and S-Curve trend guidelines for CPI, SPI, EAC, VAC, and TCPI in heavy civil construction.",
    recommendedFor: "Project Controls Engineers, Planners, Executive Directors",
    keyPoints: [
      "Cost Performance Index (CPI = EV / AC): Evaluating budget health and early cost runaways.",
      "Schedule Performance Index (SPI = EV / PV): True volume earned vs planned rate of progress.",
      "Estimate at Completion (EAC): Mathematical forecasting models based on current performance.",
      "Variance at Completion (VAC = BAC - EAC): Anticipated final project profit or loss."
    ],
    fullGuideContent: [
      "Earned Value Management (EVM) transforms disconnected cost and schedule reports into a single integrated performance measurement system.",
      "Planned Value (PV) represents the approved baseline budget scheduled to date. Earned Value (EV) measures the physical work actually performed valued at baseline bill rates. Actual Cost (AC) captures the total actual incurred cost.",
      "When CPI < 1.0, the project is delivering less physical scope per dollar expended. When SPI < 1.0, progress is lagging the baseline programme. In Project Matrix, EVM metrics are computed automatically whenever monthly Interim Payment Valuations and Gantt progress updates are verified.",
      "The To-Complete Performance Index (TCPI = [BAC - EV] / [BAC - AC]) gives executives the realistic efficiency required on remaining scope to meet the original budget target."
    ]
  },
  {
    id: "site-diary-sop",
    title: "Standard Operating Procedure: Tamper-Proof Daily Site Diaries",
    category: "Site Operations",
    readTime: "5 min read",
    badge: "Field SOP",
    summary: "Standardized protocols for recording artisan and plant standby hours, daily weather conditions, deliveries, inspections, and safety events for bulletproof dispute defense.",
    recommendedFor: "Site Agents, Resident Engineers, General Foremen",
    keyPoints: [
      "Plant Standing vs Working hours: Mandatory logging of idle causes (breakdown, rain, lack of instruction).",
      "Artisan & Labour allocations by cost code and work package.",
      "Certified weather telemetry: Rain gauge readings, ambient wind speeds, and site ground conditions.",
      "Daily shift sign-off: Dual digital signatures between Site Agent and Supervising Consultant."
    ],
    fullGuideContent: [
      "A site diary written weeks after an incident has minimal evidentiary weight in mediation, adjudication, or arbitration. Contemporaneous records recorded within 24 hours are paramount.",
      "Every site entry must explicitly record: (1) Headcount by trade and subcontractor, (2) Plant equipment serial numbers and status (working vs standing), (3) Material deliveries with delivery note numbers, and (4) Site instructions received.",
      "Weather events must not simply state 'rained'; they must record start and stop times, millimetres of rainfall, wind velocities, and specific work sections rendered untraversable.",
      "Project Matrix synchronizes weather data directly from local airport and meteorological stations to cross-verify site logs automatically."
    ]
  },
  {
    id: "cvr-framework",
    title: "Cost-Value Reconciliation (CVR) Implementation Framework",
    category: "Commercial Management",
    readTime: "7 min read",
    badge: "Commercial Framework",
    summary: "A practical methodology for monthly CVR reporting, accrual adjustments, internal vs external valuations, and early detection of margin degradation.",
    recommendedFor: "Commercial Directors, Managing Quantity Surveyors, CFOs",
    keyPoints: [
      "Reconciliation of external Certified Valuations against internal Actual Cost ledgers.",
      "Accruals and Subcontractor liabilities: Preventing hidden end-of-project cost shocks.",
      "Unapproved Variations: Objective risk-weighting of unsettled commercial claims.",
      "Anticipated Final Margin (AFM) trend analysis across multi-year contracts."
    ],
    fullGuideContent: [
      "The primary purpose of a Cost-Value Reconciliation (CVR) is to provide the commercial executive with an honest, unvarnished appraisal of true project profitability at the close of every financial month.",
      "Many contractors overestimate profitability by recognizing full valuation revenue on uncertified variations while failing to accrue for subcontractor liabilities and plant standing hire charges.",
      "The Project Matrix CVR framework enforces disciplined line-by-line reconciliation across: (1) Value to Date, (2) Cost to Date, (3) Accrued Uninvoiced Costs, (4) Forecast Cost to Complete, and (5) Expected Final Account Value.",
      "Monthly variance triggers flag any package where gross margin drops by more than 2% between consecutive evaluation cycles."
    ]
  },
  {
    id: "contract-comparison",
    title: "Contract Standards Matrix: FIDIC vs NEC4 vs GCC 2015 vs JBCC 6.2",
    category: "Legal & Contracts",
    readTime: "10 min read",
    badge: "Comparative Analysis",
    summary: "Side-by-side analysis of risk allocation, notice periods, Engineer/Project Manager autonomy, and dispute resolution boards across major standard forms.",
    recommendedFor: "Legal Counsel, Contracts Directors, Employers & Engineers",
    keyPoints: [
      "Risk Allocation: Collaborative risk sharing (NEC4) vs Engineer-administered models (FIDIC).",
      "Notice Periods: Fatal time-bars vs non-fatal notification obligations.",
      "Price Certainty: Lump Sum (Priced Contract) vs Target Cost with Pain/Gain share.",
      "Dispute Adjudication: Dispute Avoidance & Adjudication Boards (DAAB) requirements."
    ],
    fullGuideContent: [
      "Different procurement frameworks demand different operational habits from site teams. Applying FIDIC habits to an NEC4 contract frequently results in fatal loss of entitlements.",
      "NEC4 ECC emphasizes forward-looking project management: the Project Manager and Contractor are contractually bound to act 'in a spirit of mutual trust and co-operation' and maintain an active Early Warning Register.",
      "FIDIC 1999/2017 establishes the Engineer as the primary adjudicator of claims, requiring formal determinations under Clause 3.7. Meanwhile, South Africa's GCC 2015 and JBCC Principal Building Agreement 6.2 feature specific statutory clauses for local enterprise and dispute escalation.",
      "Project Matrix comes pre-configured with workflow rules, notification templates, and clause mappings for all four leading standards."
    ]
  },
  {
    id: "hseq-audit-checklist",
    title: "ISO 45001 & 9001 Construction Site Audit & Safety Checklist",
    category: "HSEQ & Compliance",
    readTime: "5 min read",
    badge: "Compliance Kit",
    summary: "A comprehensive site safety, quality assurance, and environmental compliance audit guide ready for immediate site inspection implementation.",
    recommendedFor: "HSEQ Officers, Safety Managers, Site Supervisors",
    keyPoints: [
      "Daily Pre-Task Risk Assessments (Risk Matrix 5x5) and Tool-Box Talks.",
      "Lifting equipment certificates, working at heights permits, and confined space authorisations.",
      "Hazard identification, near-miss reporting loops, and Lost Time Injury Frequency Rate (LTIFR) calculation.",
      "Non-Conformance Report (NCR) root-cause resolution and corrective action sign-offs."
    ],
    fullGuideContent: [
      "Site safety cannot rely on periodic paper inspections. Modern statutory requirements demand continuous, auditable, and proactive health and safety management.",
      "Project Matrix embeds daily HSEQ registers directly into the site workflow: toolbox talk attendance is recorded digitally with photo verification, and high-risk permits-to-work require digital sign-off before site machinery operates.",
      "All incidents trigger an automated root-cause analysis (5-Whys methodology) with mandatory corrective action deadlines and assigned owners.",
      "Safety metrics including LTIFR, TRIFR, and near-miss frequency are integrated into the executive command dashboard for instant corporate visibility."
    ]
  }
];

export function SolutionsSection({ onOpenSignIn, onOpenSignUp }: LandingSectionsProps) {
  const [activeTab, setActiveTab] = useState<number>(0);

  const solutions = [
    {
      title: "Commercial & Contract Controls",
      icon: DollarSign,
      color: "from-amber-500 to-orange-600",
      tagline: "Automated clause-level compliance & payment intelligence",
      description: "Safeguard contractual entitlements, eliminate margin leakage, and ensure audit-ready payment compliance across FIDIC, NEC4, GCC, and JBCC contracts.",
      highlights: [
        "Automated NEC Early Warnings & FIDIC Clause 20/21 claim notifications",
        "Interim Payment Certificates (IPCs) with retention & advance recovery",
        "Cost-Value Reconciliation (CVR) and Earned Value Management (EVM)",
        "Variation order & compensation event register with financial impact tracking",
        "Subcontractor liabilities, commitment ledgers, and back-to-back claims"
      ],
      kpi: "32% faster monthly valuation & IPC certifications"
    },
    {
      title: "Programme & Schedule Intelligence",
      icon: Calendar,
      color: "from-blue-600 to-indigo-700",
      tagline: "Live Critical Path tracking & Time-Impact Analysis",
      description: "Connect the master schedule directly to site reality. Detect critical path slippages early, simulate delay mitigation scenarios, and substantiate EOT claims.",
      highlights: [
        "Interactive multi-tier Gantt scheduling with Critical Path Method (CPM)",
        "Time-Impact Analysis (TIA) and As-Planned vs As-Built variance overlays",
        "Milestone tracking with automated early warning delay triggers",
        "Direct synchronization with Site Diary daily labor & progress logs",
        "Earned Value Schedule Performance Index (SPI) forecasting"
      ],
      kpi: "18% average reduction in critical path delays"
    },
    {
      title: "Site Operations & Daily Diary",
      icon: HardHat,
      color: "from-emerald-500 to-teal-700",
      tagline: "Contemporaneous site records with geotagged evidence",
      description: "Empower site agents and foremen to capture plant, labor, deliveries, weather disruptions, and progress effortlessly from any mobile device or tablet.",
      highlights: [
        "Standardized digital site diaries with plant working vs standing hours",
        "Daily artisan headcount by subcontractor and trade allocation",
        "Geotagged site progress photographs with timestamp verification",
        "Automated meteorological weather telemetry and rainfall disruption logging",
        "Digital shift sign-offs between Site Agent and Supervising Engineer"
      ],
      kpi: "100% contemporaneous record compliance for claims defense"
    },
    {
      title: "Engineering QA/QC & Submittals",
      icon: Compass,
      color: "from-purple-600 to-indigo-800",
      tagline: "Streamlined technical queries & non-conformance closure",
      description: "Keep engineering and construction moving smoothly with automated RFI routing, material approvals, and inspection test plan (ITP) sign-offs.",
      highlights: [
        "Technical Queries / RFIs with SLA tracking and automated reminder escalation",
        "Material Approval Requests (MARs) and sample submittal tracking",
        "Non-Conformance Reports (NCRs) with root-cause analysis and photographic proof",
        "Inspection Test Plans (ITPs) with digital hold point releases",
        "Full revision history and drawing transmittal tracking"
      ],
      kpi: "45% reduction in technical query response turnarounds"
    },
    {
      title: "HSEQ & Statutory Safety",
      icon: ShieldCheck,
      color: "from-rose-500 to-red-700",
      tagline: "Zero-compromise safety, health, and environmental compliance",
      description: "Protect workers on site and ensure total statutory adherence with digital risk assessments, toolbox talks, and incident mitigation workflows.",
      highlights: [
        "Digital incident and near-miss registers with 5-Whys root-cause investigation",
        "Daily toolbox talk logs with digital worker attendance capture",
        "Pre-task risk assessment matrices (5x5) and high-risk permits-to-work",
        "PPE compliance registers and plant safety pre-start checklists",
        "ISO 45001, ISO 14001, and ISO 9001 compliance audit trails"
      ],
      kpi: "Zero lost-time injury compliance reporting"
    },
    {
      title: "Portfolio & Multi-Tenant Governance",
      icon: Layers,
      color: "from-slate-700 to-[#07182E]",
      tagline: "Executive portfolio visibility across multiple companies",
      description: "Provide clients, main contractors, and joint-venture partners with the exact level of transparency and role-based permissions they need.",
      highlights: [
        "Multi-company hierarchy supporting Employers, Engineers, and Contractors",
        "Granular Role-Based Access Control (RBAC) across 8 enterprise role profiles",
        "Executive portfolio health cards, cash-flow S-curves, and risk heatmaps",
        "Multi-currency, multi-tax, and multi-lingual project controls",
        "Complete tamper-proof audit trails for all approvals and transactions"
      ],
      kpi: "Enterprise-grade portfolio governance & data isolation"
    }
  ];

  return (
    <section id="solutions" className="relative z-10 py-16 lg:py-24 border-t border-slate-200/80 bg-gradient-to-b from-white via-slate-50/40 to-white scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-[#FF6B00] text-xs font-black uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5" />
            <span>ENTERPRISE PROJECT SOLUTIONS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#07182E] tracking-tight">
            Engineered for Every Project Phase &amp; Stakeholder
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            From FIDIC/NEC contract compliance to site telemetry and executive rollups, Project Matrix connects field execution, commercial accountability, and boardroom governance.
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center justify-start lg:justify-center gap-2 overflow-x-auto pb-4 scrollbar-none mb-8">
          {solutions.map((sol, idx) => {
            const Icon = sol.icon;
            const isActive = activeTab === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  isActive 
                    ? "bg-[#07182E] text-white border-[#07182E] shadow-md shadow-[#07182E]/20" 
                    : "bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#FF6B00]" : "text-slate-400"}`} />
                <span>{sol.title}</span>
              </button>
            );
          })}
        </div>

        {/* Active Tab Spotlight Showcase */}
        {(() => {
          const current = solutions[activeTab];
          const Icon = current.icon;
          return (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-xl shadow-slate-200/50 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              
              {/* Left Column: Details */}
              <div className="lg:col-span-7 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-[#FF6B00] flex items-center justify-center shadow-xs">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#FF6B00]">
                      Solution Module {activeTab + 1} of 6
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-[#07182E]">
                      {current.title}
                    </h3>
                  </div>
                </div>

                <p className="text-xs sm:text-sm font-semibold text-slate-500">
                  {current.tagline}
                </p>

                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  {current.description}
                </p>

                {/* Checklist of Capabilities */}
                <div className="space-y-2.5 pt-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                    Core Module Capabilities:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {current.highlights.map((item, hIdx) => (
                      <div key={hIdx} className="flex items-start gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                        <span className="font-medium leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* KPI Banner & CTAs */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
                      {current.kpi}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onOpenSignIn}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#07182E] hover:bg-[#0c2444] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <span>Sign In to Access</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={onOpenSignUp}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A00] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <span>Start Free</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Right Column: Visual Dashboard Snapshot Preview */}
              <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-[#07182E] text-white p-6 sm:p-7 rounded-2xl shadow-inner space-y-4 border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B00]"></span>
                    <span className="text-xs font-bold text-slate-200">Matrix Control Diagnostic</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                    STATUS: OPTIMAL
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Contract Standard</span>
                    <p className="font-semibold text-slate-100">FIDIC Red Book 2017 &bull; NEC4 ECC Option A</p>
                  </div>
                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Automated Workflows</span>
                    <p className="font-semibold text-slate-100">Early Warning Alerts, Claims Logging, EVM S-Curves, Site Sign-Offs</p>
                  </div>
                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Commercial Impact</span>
                    <p className="font-semibold text-emerald-400">Zero time-bar forfeitures &bull; 100% audit-trail compliance</p>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-orange-300 uppercase block">Governance Protocol</span>
                      <span className="text-xs font-bold text-white">Full Role-Based Encryption</span>
                    </div>
                    <ShieldCheck className="w-6 h-6 text-[#FF6B00]" />
                  </div>
                </div>
              </div>

            </div>
          );
        })()}

      </div>
    </section>
  );
}

export function FeaturesSection({ onOpenSignIn, onOpenSignUp }: LandingSectionsProps) {
  const featureList = [
    {
      icon: Activity,
      title: "Executive Command Centre",
      description: "Live portfolio KPIs, project health gauges, S-curve performance, and requires-attention action items across all operational contracts.",
      badge: "Real-Time Telemetry"
    },
    {
      icon: Scale,
      title: "Contract Library & Workflows",
      description: "Built-in clause libraries for FIDIC (Red, Yellow, Silver), NEC3/4 ECC, GCC 2015, and JBCC 6.2 with automated contractual notification timers.",
      badge: "Contractual Rigour"
    },
    {
      icon: DollarSign,
      title: "Commercial Ledger & IPC Engine",
      description: "Automated Interim Payment Certificates, retention bookkeeping, advance recovery, CVR trend analysis, and subcontractor back-to-back valuations.",
      badge: "Zero Leakage"
    },
    {
      icon: Calendar,
      title: "Critical Path Gantt & Programme",
      description: "CPM schedule tracking, baseline comparisons, Time-Impact Analysis (TIA) for delays, and direct synchronization with daily site diary headcounts.",
      badge: "CPM Scheduling"
    },
    {
      icon: Sparkles,
      title: "Matrix Control™ AI Assistant",
      description: "Intelligent construction project diagnostics answering: What Changed? What's At Risk? Why? What Should We Do? with contract clause grounding.",
      badge: "Intelligent Advisor"
    },
    {
      icon: HardHat,
      title: "Site Diary & Weather Telemetry",
      description: "Mobile-friendly daily site diaries capturing plant working vs standing hours, artisan counts, deliveries, and meteorological rain/wind data.",
      badge: "Contemporaneous Logs"
    },
    {
      icon: Compass,
      title: "Engineering QA/QC & RFIs",
      description: "Technical Queries, Material Approval Requests, Non-Conformance Reports (NCRs), and inspection test plans with photo evidence and digital sign-offs.",
      badge: "Quality Assurance"
    },
    {
      icon: Globe,
      title: "Interactive Geospatial Site Map",
      description: "Real-time OpenStreetMap/Leaflet integration showing project coordinates, site boundaries, and operational status across national geographies.",
      badge: "GIS & Mapping"
    },
    {
      icon: FileSpreadsheet,
      title: "Document Control & Audit Logs",
      description: "Centralized drawing revisions, transmittals, contractual correspondence, and cryptographically verifiable audit logs for all authorisations.",
      badge: "Tamper-Proof Audit"
    }
  ];

  return (
    <section id="features" className="relative z-10 py-16 lg:py-24 border-t border-slate-200/80 bg-white scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-[#FF6B00] text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PLATFORM CAPABILITIES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#07182E] tracking-tight">
            High-Precision Tools Built for Construction Realities
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            Eliminate communication silos, stop margin leakage, and protect contractual entitlements with our integrated suite of construction management features.
          </p>
        </div>

        {/* Features 3-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {featureList.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div 
                key={idx}
                className="bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 space-y-4 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/50 hover:border-orange-300 group flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-orange-50 group-hover:bg-[#FF6B00] border border-orange-100 text-[#FF6B00] group-hover:text-white flex items-center justify-center transition-colors shadow-2xs">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                      {feat.badge}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-[#07182E] tracking-tight">
                    {feat.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {feat.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-[#FF6B00] font-bold">
                  <span className="group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    Explore feature <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">0{idx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Bottom CTA */}
        <div className="mt-12 p-6 sm:p-8 bg-[#07182E] rounded-3xl text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-lg sm:text-xl font-black text-white">Ready to streamline your project controls?</h4>
            <p className="text-xs sm:text-sm text-slate-300">Access the full Project Matrix platform or sign in with your enterprise credentials.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenSignIn}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm transition-all border border-white/20 cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={onOpenSignUp}
              className="px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A00] text-white font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer"
            >
              Get Started Now
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}

export function IndustriesSection({ onOpenSignIn, onOpenSignUp }: LandingSectionsProps) {
  const industries = [
    {
      title: "Heavy Civil & Infrastructure",
      icon: HardHat,
      projects: "Highways, Bridges, Rail, Dams, Earthworks",
      description: "Linear scheduling, earthworks mass-haul tracking, environmental permits, and large-scale subcontractor coordination under FIDIC and NEC contracts.",
      standards: "FIDIC Red Book &bull; NEC4 ECC Option B/C",
      metric: "Over 850 km of highway & rail infrastructure managed"
    },
    {
      title: "Commercial & High-Rise Building",
      icon: Building2,
      projects: "Towers, Mixed-Use, Retail, Healthcare, Campuses",
      description: "Multi-trade subcontractor coordination, finish snagging, architectural submittal approvals, tenant variation requests, and practical completion handovers.",
      standards: "JBCC Principal Agreement &bull; FIDIC Yellow Book",
      metric: "1.2M+ m² gross building floor space governed"
    },
    {
      title: "Energy, Power & Renewables",
      icon: Zap,
      projects: "Solar PV, Wind Farms, Substations, BESS, Grid",
      description: "Stringent commissioning milestones, high-voltage equipment factory acceptance tests (FAT), grid-code compliance tracking, and environmental registers.",
      standards: "FIDIC Silver Book (EPC/Turnkey) &bull; NEC4 ECC",
      metric: "2.4 GW of renewable energy capacity delivered"
    },
    {
      title: "Mining & Heavy Industrial",
      icon: Compass,
      projects: "Processing Plants, Smelters, Structural Steel, Shafts",
      description: "Severe hazard safety controls, heavy plant utilization optimization, shutdown scheduling, and complex mechanical, electrical and piping (MEP) handovers.",
      standards: "NEC4 ECC Option E &bull; Bespoke EPC Agreements",
      metric: "Zero critical path delays on plant shutdown packages"
    },
    {
      title: "Water & Environmental Engineering",
      icon: Landmark,
      projects: "Water Treatment Plants, Bulk Pipelines, Reservoirs",
      description: "Hydraulic pressure testing logs, specialized concrete pour quality records, pipeline chainage tracking, and municipal milestone acceptance.",
      standards: "GCC 2015 &bull; FIDIC Red Book",
      metric: "340+ ML/day water treatment capacity secured"
    },
    {
      title: "Public Works & Municipal Capital",
      icon: Briefcase,
      projects: "Municipal Frameworks, Schools, Social Housing, Defense",
      description: "Strict public finance compliance, transparent tender valuations, community liaison officer (CLO) reports, and statutory audit readiness.",
      standards: "GCC 2015 &bull; Public Procurement Frameworks",
      metric: "100% statutory audit-readiness and compliance"
    }
  ];

  return (
    <section id="industries" className="relative z-10 py-16 lg:py-24 border-t border-slate-200/80 bg-gradient-to-b from-slate-50/60 via-white to-slate-50/60 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-[#FF6B00] text-xs font-black uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" />
            <span>SECTOR EXPERTISE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#07182E] tracking-tight">
            Tailored for Capital-Intensive Sectors Worldwide
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            Proven across major transport corridors, commercial developments, renewable energy plants, and heavy industrial facilities.
          </p>
        </div>

        {/* 2-Column or 3-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {industries.map((ind, idx) => {
            const Icon = ind.icon;
            return (
              <div 
                key={idx}
                className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 space-y-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-[#FF6B00] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-[#07182E] leading-snug">
                        {ind.title}
                      </h3>
                      <span className="text-[11px] font-bold text-[#FF6B00]">
                        {ind.projects}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {ind.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-medium">Standard Forms:</span>
                    <span className="font-bold text-slate-700" dangerouslySetInnerHTML={{ __html: ind.standards }} />
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg text-[11px] text-[#07182E] font-semibold flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                    <span className="truncate">{ind.metric}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

export function ResourcesSection({ onOpenSignIn, onOpenSignUp }: LandingSectionsProps) {
  const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null);

  return (
    <section id="resources" className="relative z-10 py-16 lg:py-24 border-t border-slate-200/80 bg-white scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-[#FF6B00] text-xs font-black uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5" />
            <span>KNOWLEDGE BASE &amp; TOOLKITS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#07182E] tracking-tight">
            Industry Guides, Playbooks &amp; Practical Toolkits
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            Curated by chartered quantity surveyors, commercial directors, and civil engineering specialists. Access actionable playbooks, contract reference guides, and calculation compendiums.
          </p>
        </div>

        {/* Resource Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {RESOURCES_DATA.map((resource) => (
            <div 
              key={resource.id}
              className="bg-slate-50/60 rounded-2xl border border-slate-200/90 p-6 sm:p-7 space-y-4 hover:border-orange-300 hover:bg-white transition-all flex flex-col justify-between shadow-xs hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-50 text-[#FF6B00] border border-orange-200">
                    {resource.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {resource.readTime}
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-[#07182E] leading-snug">
                  {resource.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {resource.summary}
                </p>

                {/* Key Points Bullet list */}
                <div className="pt-1 space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Core Insights:
                  </span>
                  {resource.keyPoints.slice(0, 2).map((point, pIdx) => (
                    <div key={pIdx} className="flex items-start gap-1.5 text-xs text-slate-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00] shrink-0 mt-1.5"></span>
                      <span className="leading-tight">{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium truncate max-w-[150px]">
                  {resource.recommendedFor}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedResource(resource)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-[#07182E] border border-slate-200 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  <span>Read Guide</span>
                  <ArrowRight className="w-3 h-3 text-[#FF6B00]" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Resource Detail Modal */}
      {selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07182E]/80 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-150 relative max-h-[90vh] overflow-y-auto scrollbar-thin animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedResource(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close guide dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-50 text-[#FF6B00] border border-orange-200">
                {selectedResource.category}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {selectedResource.readTime}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-[#07182E] mb-3 leading-tight">
              {selectedResource.title}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {selectedResource.summary}
            </p>

            <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed mb-6">
              <h4 className="font-extrabold text-sm text-[#07182E] uppercase tracking-wide">
                Key Standard &amp; Contractual Takeaways:
              </h4>
              <div className="space-y-2">
                {selectedResource.keyPoints.map((point, i) => (
                  <div key={i} className="flex items-start gap-2 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/60">
                    <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span className="font-semibold text-slate-800">{point}</span>
                  </div>
                ))}
              </div>

              <h4 className="font-extrabold text-sm text-[#07182E] uppercase tracking-wide pt-2">
                Executive &amp; Operational Analysis:
              </h4>
              {selectedResource.fullGuideContent.map((paragraph, pIdx) => (
                <p key={pIdx} className="text-slate-600">
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-500 font-medium">
                Target Audience: <strong className="text-slate-800">{selectedResource.recommendedFor}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedResource(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedResource(null);
                    onOpenSignIn();
                  }}
                  className="px-4 py-2 rounded-xl bg-[#07182E] hover:bg-[#0c2444] text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Sign In to Platform
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </section>
  );
}

export function AboutUsSection({ onOpenSignIn, onOpenSignUp }: LandingSectionsProps) {
  return (
    <section id="about" className="relative z-10 py-16 lg:py-24 border-t border-slate-800 bg-[#07182E] text-white scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Header */}
        <div className="max-w-3xl space-y-4 mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[#FF6B00] text-xs font-black uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" />
            <span>ABOUT PROJECT MATRIX</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Built by Construction Professionals, for Construction Professionals
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
            Project Matrix was founded with a singular conviction: major civil, commercial, and energy projects should never fail due to fragmented records, delayed notices, or opaque commercial systems.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-16">
          
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/20 text-[#FF6B00] flex items-center justify-center font-black">
              01
            </div>
            <h3 className="text-base font-bold text-white">Practitioner-Led Design</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Engineered by chartered quantity surveyors, civil project directors, and commercial lawyers who have sat in site cabins and international arbitration hearings.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/20 text-[#FF6B00] flex items-center justify-center font-black">
              02
            </div>
            <h3 className="text-base font-bold text-white">Contractual Precision</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Unlike generic task tools, Project Matrix is architected around legal standards—FIDIC, NEC4, GCC, and JBCC—protecting cash flows and entitlements.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/20 text-[#FF6B00] flex items-center justify-center font-black">
              03
            </div>
            <h3 className="text-base font-bold text-white">Zero Margin Leakage</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Real-time Cost-Value Reconciliation (CVR) and Earned Value Management ensure deviations are caught in week 2, not during final account negotiations.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/20 text-[#FF6B00] flex items-center justify-center font-black">
              04
            </div>
            <h3 className="text-base font-bold text-white">Enterprise Security</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Multi-tenant architecture with encrypted databases, comprehensive role-based access control (RBAC), and cryptographically auditable transaction logs.
            </p>
          </div>

        </div>

        {/* Quantitative Proof Strip */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white/5 border border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          <div>
            <span className="text-3xl sm:text-4xl font-black text-[#FF6B00] block">$4.2B+</span>
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-1 block">Project Capital Governed</span>
          </div>
          <div>
            <span className="text-3xl sm:text-4xl font-black text-white block">140+</span>
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-1 block">Mega Projects Delivered</span>
          </div>
          <div>
            <span className="text-3xl sm:text-4xl font-black text-[#FF6B00] block">98.4%</span>
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-1 block">Notice Compliance Rate</span>
          </div>
          <div>
            <span className="text-3xl sm:text-4xl font-black text-white block">32%</span>
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-1 block">Faster Valuation Cycles</span>
          </div>
        </div>

        {/* Global Standards Banner */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-slate-800">
          <div className="space-y-1 text-center sm:text-left">
            <span className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider">COMPLIANCE &amp; GOVERNANCE</span>
            <p className="text-xs text-slate-300">Supported standards: FIDIC 1999 &amp; 2017 &bull; NEC3 &amp; NEC4 ECC &bull; GCC 2015 &bull; JBCC 6.2 &bull; ISO 9001 / 45001</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenSignIn}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-[#07182E] font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer"
            >
              Sign In to Your Account
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}

export function LandingFooter({ onOpenSignIn, onOpenSignUp }: LandingSectionsProps) {
  return (
    <footer className="relative z-10 bg-[#040D1A] text-slate-400 py-12 lg:py-16 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Col 1: Brand & Bio */}
          <div className="lg:col-span-4 space-y-4">
            <ProjectMatrixBrandMark theme="dark" />
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Project Matrix is the unified project controls platform for major construction, civil engineering, and infrastructure programmes worldwide.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Enterprise Grade Security &bull; ISO 27001 Ready</span>
            </div>
          </div>

          {/* Col 2: Solutions */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Solutions</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#solutions" className="hover:text-white transition-colors">Commercial Controls</a></li>
              <li><a href="#solutions" className="hover:text-white transition-colors">Gantt &amp; CPM Programme</a></li>
              <li><a href="#solutions" className="hover:text-white transition-colors">Site Diary Telemetry</a></li>
              <li><a href="#solutions" className="hover:text-white transition-colors">Engineering QA/QC</a></li>
              <li><a href="#solutions" className="hover:text-white transition-colors">HSEQ Safety Registers</a></li>
              <li><a href="#solutions" className="hover:text-white transition-colors">Portfolio Governance</a></li>
            </ul>
          </div>

          {/* Col 3: Features & Industries */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Platform</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#features" className="hover:text-white transition-colors">Command Centre</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Contract Library</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Matrix Control™ AI</a></li>
              <li><a href="#industries" className="hover:text-white transition-colors">Civil Infrastructure</a></li>
              <li><a href="#industries" className="hover:text-white transition-colors">Energy &amp; Power</a></li>
              <li><a href="#industries" className="hover:text-white transition-colors">Mining &amp; Industrial</a></li>
            </ul>
          </div>

          {/* Col 4: Resources */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Resources</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#resources" className="hover:text-white transition-colors">Claims Playbook</a></li>
              <li><a href="#resources" className="hover:text-white transition-colors">EVM Compendium</a></li>
              <li><a href="#resources" className="hover:text-white transition-colors">Site Diary SOP</a></li>
              <li><a href="#resources" className="hover:text-white transition-colors">CVR Framework</a></li>
              <li><a href="#resources" className="hover:text-white transition-colors">Contract Comparison</a></li>
              <li><a href="#about" className="hover:text-white transition-colors">About Our Team</a></li>
            </ul>
          </div>

          {/* Col 5: Access Portal */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Access Portal</h4>
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={onOpenSignIn}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all border border-slate-700 cursor-pointer text-center block"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={onOpenSignUp}
                className="w-full py-2 px-3 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A00] text-white text-xs font-bold transition-all shadow-sm cursor-pointer text-center block"
              >
                Get Started
              </button>
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Support: <span className="text-slate-400">support@projectmatrix.app</span>
            </p>
          </div>

        </div>

        {/* Bottom Copyright & Legal */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} Project Matrix Inc. All rights reserved. Construction Intelligence &amp; Controls.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>FIDIC &bull; NEC4 &bull; GCC &bull; JBCC Compliant</span>
            <span>&bull;</span>
            <span>Security &amp; Privacy Policy</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
