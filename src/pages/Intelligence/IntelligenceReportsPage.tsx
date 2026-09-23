import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  FileText, 
  BarChart3, 
  Sparkles, 
  Download, 
  Calendar, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Share2, 
  Printer, 
  Eye, 
  Plus
} from "lucide-react";
import ProjectShell from "../../components/layout/ProjectShell";
import { MetricCard } from "../../components/ui/MetricCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Tabs } from "../../components/ui/Tabs";
import { Panel } from "../../components/ui/Panel";
import { DataTable } from "../../components/ui/DataTable";

type ReportViewTab = "executive-pack" | "evm-progress" | "commercial-summary" | "hseq-compliance";

export default function IntelligenceReportsPage() {
  const context = useOutletContext<any>() || {};
  const activeProject = context.activeProject;
  const activeCompany = context.activeCompany;

  const [activeTab, setActiveTab] = useState<ReportViewTab>("executive-pack");

  // Sample Generated Reports Library
  const reportsList = [
    { id: "rep-01", title: "Monthly Executive Steering Committee Pack - July 2026", type: "Executive Board Pack", format: "PDF / DOCX", pages: "28 pages", generatedAt: "01 Aug 2026", status: "Published", audience: "Board of Directors & Client Rep" },
    { id: "rep-02", title: "Earned Value Management (EVM) S-Curve & Milestone Report", type: "Controls & Schedule", format: "Interactive + XLSX", pages: "14 pages", generatedAt: "15 Aug 2026", status: "Live", audience: "Project Controls Director" },
    { id: "rep-03", title: "Interim Payment Certificate #05 Commercial Verification Dossier", type: "Commercial Valuation", format: "PDF + Appendices", pages: "42 pages", generatedAt: "10 Aug 2026", status: "Published", audience: "Resident QS & Client Auditor" },
    { id: "rep-04", title: "Quarterly HSEQ Audit & Environmental Compliance Summary", type: "HSEQ Governance", format: "PDF", pages: "18 pages", generatedAt: "30 Jun 2026", status: "Archived", audience: "Safety Steering Committee" },
  ];

  const tabsConfig = [
    { id: "executive-pack" as ReportViewTab, label: "Executive Board Pack", icon: FileText, badge: "Monthly" },
    { id: "evm-progress" as ReportViewTab, label: "EVM & Schedule Analysis", icon: BarChart3, badge: "CPI: 1.04" },
    { id: "commercial-summary" as ReportViewTab, label: "Commercial Valuation", icon: FileSpreadsheet, badge: "IPC #05" },
    { id: "hseq-compliance" as ReportViewTab, label: "HSEQ Governance Audit", icon: CheckCircle2, badge: "100% Pass" },
  ];

  return (
    <ProjectShell project={activeProject} section="overview">
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Module Header Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-[#00B894]" />
              <h2 className="text-xl sm:text-2xl font-black text-[#101828] dark:text-white tracking-tight uppercase">
                INTELLIGENCE REPORTS & EXPORTS
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#00B894] font-mono text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                Automated Compilers
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl font-medium">
              Multi-discipline project reporting engine: Executive Steering Committee packs, Earned Value S-Curves, Commercial valuation summaries, and exportable deliverables.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-[#00B894] hover:bg-[#009E7F] text-white text-xs font-black rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Compile Board Pack</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Schedule Performance Index (SPI)"
            value="0.97"
            trend={{ direction: "neutral", text: "Target: ≥ 1.00 (Critical Path Path 1)" }}
            intent="warning"
          />
          <MetricCard
            label="Cost Performance Index (CPI)"
            value="1.04"
            trend={{ direction: "up", text: "+4% under budget baseline" }}
            intent="good"
          />
          <MetricCard
            label="Executive Packs Published"
            value="18 Editions"
            trend={{ direction: "up", text: "Latest: Jul 2026 Board Pack" }}
            intent="good"
          />
          <MetricCard
            label="Automated Synthesis Engine"
            value="Active"
            trend={{ direction: "neutral", text: "Multi-Agent Gemini Analysis" }}
            intent="good"
          />
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-xs">
          <Tabs
            tabs={tabsConfig}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as ReportViewTab)}
          />
        </div>

        {/* TAB 1: EXECUTIVE PACK */}
        {activeTab === "executive-pack" && (
          <div className="space-y-6">
            <Panel
              title="Published Executive Report Deliverables"
              subtitle="Formal synthesized reporting packs ready for stakeholder dissemination, client submission, and board audit"
              action={
                <button className="px-3 py-1.5 bg-[#00B894] text-white text-xs font-bold rounded-lg flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Latest Pack (PDF)</span>
                </button>
              }
            >
              <DataTable
                data={reportsList}
                columns={[
                  { header: "Report Title", accessor: (row) => <span className="font-bold text-slate-900 dark:text-white">{row.title}</span> },
                  { header: "Discipline / Scope", accessor: (row) => <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{row.type}</span> },
                  { header: "Format & Size", accessor: (row) => <span className="text-xs font-mono text-slate-500">{row.format} ({row.pages})</span> },
                  { header: "Generated Date", accessor: (row) => <span className="text-xs font-mono text-slate-500">{row.generatedAt}</span> },
                  { header: "Intended Audience", accessor: (row) => <span className="text-xs text-slate-600 dark:text-slate-300">{row.audience}</span> },
                  { header: "Status", accessor: (row) => <StatusBadge label={row.status} variant="success" size="sm" /> },
                ]}
              />
            </Panel>
          </div>
        )}

        {/* TAB 2: EVM PROGRESS */}
        {activeTab === "evm-progress" && (
          <div className="space-y-6">
            <Panel
              title="Earned Value Management (EVM) Metrics & Forecast"
              subtitle="Planned Value (PV), Earned Value (EV), and Actual Cost (AC) variance S-Curves"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-400 font-bold uppercase">Planned Value (PV)</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">$86,500,000</div>
                  <div className="text-xs text-slate-500 mt-1">Baseline schedule value as of August 2026</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-400 font-bold uppercase">Earned Value (EV)</div>
                  <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">$83,905,000</div>
                  <div className="text-xs text-slate-500 mt-1">Schedule Variance (SV): -$2,595,000 (SPI 0.97)</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-400 font-bold uppercase">Actual Cost of Work (AC)</div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">$80,678,000</div>
                  <div className="text-xs text-slate-500 mt-1">Cost Variance (CV): +$3,227,000 (CPI 1.04)</div>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* TAB 3: COMMERCIAL */}
        {activeTab === "commercial-summary" && (
          <div className="space-y-6">
            <Panel
              title="Commercial Valuation & Cash Flow Realization"
              subtitle="Interim certification summary with advance payment recovery and retention deduction schedules"
            >
              <div className="p-6 text-center text-slate-500 text-xs">
                Valuation Certificate #05 claimed at <strong>$3,420,000</strong>. Net certified payable: <strong>$3,144,500</strong> after $165,500 retention deduction.
              </div>
            </Panel>
          </div>
        )}

        {/* TAB 4: HSEQ */}
        {activeTab === "hseq-compliance" && (
          <div className="space-y-6">
            <Panel
              title="HSEQ Audit Summary & Environmental Compliance Dossier"
              subtitle="Quarterly ISO 9001 and ISO 14001 compliance audit trail outputs"
            >
              <div className="p-6 text-center text-slate-500 text-xs">
                Zero open major non-conformances. 528,400 Lost-Time-Injury-free hours logged to date. Full EIA environmental parameters within statutory limits.
              </div>
            </Panel>
          </div>
        )}

      </div>
    </ProjectShell>
  );
}
