import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  BookOpen, 
  Sparkles, 
  Search, 
  Layers, 
  FileText, 
  Scale, 
  Compass, 
  CheckCircle2, 
  Download, 
  Eye, 
  ExternalLink,
  Folder,
  Tag
} from "lucide-react";
import ProjectShell from "../../components/layout/ProjectShell";
import { MetricCard } from "../../components/ui/MetricCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Tabs } from "../../components/ui/Tabs";
import { Panel } from "../../components/ui/Panel";
import { DataTable } from "../../components/ui/DataTable";

type KnowledgeTab = "specs" | "fidic" | "method-statements" | "semantic-search";

export default function KnowledgePage() {
  const context = useOutletContext<any>() || {};
  const activeProject = context.activeProject;
  const activeCompany = context.activeCompany;

  const [activeTab, setActiveTab] = useState<KnowledgeTab>("specs");
  const [searchQuery, setSearchQuery] = useState("");

  // Standards Data
  const standardsData = [
    { id: "std-01", code: "COLTO 1998", title: "Standard Specifications for Road and Bridge Works for State Road Authorities", discipline: "Highways & Bridges", vectors: "Indexed (1,240 chunks)", authority: "SANRAL / SAICE" },
    { id: "std-02", code: "SANS 1200", title: "Standardized Specification for Civil Engineering Construction (Earthworks, Concrete, Pipelines)", discipline: "Civil Engineering", vectors: "Indexed (2,850 chunks)", authority: "SABS" },
    { id: "std-03", code: "BS EN 1992-1-1", title: "Eurocode 2: Design of Concrete Structures - General Rules and Rules for Buildings", discipline: "Structural Engineering", vectors: "Indexed (840 chunks)", authority: "BSI / CEN" },
    { id: "std-04", code: "TMH1 / TMH9", title: "Standard Methods of Testing Road Construction Materials & Pavement Manual", discipline: "Materials & Geotech", vectors: "Indexed (620 chunks)", authority: "CSIR" },
  ];

  // FIDIC Precedents
  const fidicData = [
    { id: "fid-01", clause: "Clause 20.1", topic: "Strict 28-day Notice of Claim Condition Precedent & Prevention Principle", precedent: "Obrascon Huarte Lain SA v HM Attorney General for Gibraltar (2014) EWHC 1028", ruling: "Notice condition strictly enforceable from when contractor became aware or should have become aware." },
    { id: "fid-02", clause: "Clause 8.4", topic: "Extension of Time for Exceptionally Adverse Climatic Conditions", precedent: "Walter Lilly & Co Ltd v Mackay (2012) EWHC 1773 (TCC)", ruling: "Weather must be demonstrated as exceptional against long-term 10-year meteorological statistical averages." },
    { id: "fid-03", clause: "Clause 13.3", topic: "Valuation of Variations where bill rates do not apply due to quantity change > 10%", precedent: "Henry Boot Construction Ltd v Alstom Combined Cycles (2000) BLR 247", ruling: "Contract rates remain primary unless substantial nature of work changes." },
  ];

  const tabsConfig = [
    { id: "specs" as KnowledgeTab, label: "Standards & Specifications", icon: BookOpen, badge: "COLTO / SANS" },
    { id: "fidic" as KnowledgeTab, label: "FIDIC Precedents & Legal Caselaw", icon: Scale, badge: "Contract Law" },
    { id: "method-statements" as KnowledgeTab, label: "Standard Method Statements", icon: FileText, badge: "Approved Templates" },
    { id: "semantic-search" as KnowledgeTab, label: "Vector Search Query", icon: Sparkles, badge: "AI Semantic" },
  ];

  return (
    <ProjectShell project={activeProject} section="documents">
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Module Header Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-[#00B894]" />
              <h2 className="text-xl sm:text-2xl font-black text-[#101828] dark:text-white tracking-tight uppercase">
                ENGINEERING KNOWLEDGE & STANDARDS
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#00B894] font-mono text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                Vector Indexed
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl font-medium">
              Enterprise engineering knowledge base: Standard specifications (COLTO, SANS, BS), FIDIC dispute precedents, approved method statements, and semantic search.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Query standards or clauses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00B894] w-56 sm:w-72"
              />
            </div>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Indexed Engineering Standards"
            value="42 Documents"
            trend={{ direction: "neutral", text: "COLTO, SANS, Eurocodes" }}
            intent="good"
          />
          <MetricCard
            label="FIDIC Caselaw Citations"
            value="156 Precedents"
            trend={{ direction: "neutral", text: "Clauses 8.4, 13, 20.1" }}
            intent="good"
          />
          <MetricCard
            label="Approved Method Statements"
            value="84 Library Items"
            trend={{ direction: "up", text: "+6 Added this quarter" }}
            intent="good"
          />
          <MetricCard
            label="Semantic Vector Chunks"
            value="14,280 Tokens"
            trend={{ direction: "neutral", text: "100% Vectorized" }}
            intent="good"
          />
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-xs">
          <Tabs
            tabs={tabsConfig}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as KnowledgeTab)}
          />
        </div>

        {/* TAB 1: STANDARDS & SPECS */}
        {activeTab === "specs" && (
          <div className="space-y-6">
            <Panel
              title="Standard Engineering Specifications & Codes of Practice"
              subtitle="Full-text indexed statutory specifications for roads, bridges, earthworks, concrete, and materials testing"
            >
              <DataTable
                data={standardsData}
                columns={[
                  { header: "Standard Code", accessor: (row) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{row.code}</span> },
                  { header: "Specification Title", accessor: (row) => <span className="font-bold text-slate-900 dark:text-white">{row.title}</span> },
                  { header: "Discipline", accessor: (row) => <span className="text-xs text-slate-600 dark:text-slate-300">{row.discipline}</span> },
                  { header: "Issuing Authority", accessor: (row) => <span className="text-xs font-semibold">{row.authority}</span> },
                  { header: "Vector Status", accessor: (row) => <StatusBadge label={row.vectors} variant="intelligence" size="sm" /> },
                ]}
              />
            </Panel>
          </div>
        )}

        {/* TAB 2: FIDIC PRECEDENTS */}
        {activeTab === "fidic" && (
          <div className="space-y-6">
            <Panel
              title="FIDIC & NEC Legal Precedents & Dispute Rulings"
              subtitle="Authoritative legal rulings interpreting notice condition precedents, time-at-large principles, and concurrent delay evaluation"
            >
              <DataTable
                data={fidicData}
                columns={[
                  { header: "Clause Reference", accessor: (row) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{row.clause}</span> },
                  { header: "Legal Topic & Principle", accessor: (row) => <span className="font-bold text-slate-900 dark:text-white">{row.topic}</span> },
                  { header: "Landmark Caselaw Citation", accessor: (row) => <span className="text-xs italic text-slate-700 dark:text-slate-300">{row.precedent}</span> },
                  { header: "Key Legal Ruling", accessor: (row) => <span className="text-xs text-slate-600 dark:text-slate-300">{row.ruling}</span> },
                ]}
              />
            </Panel>
          </div>
        )}

        {/* TAB 3: METHOD STATEMENTS */}
        {activeTab === "method-statements" && (
          <div className="space-y-6">
            <Panel
              title="Approved Standard Method Statements & ITP Templates"
              subtitle="Peer-reviewed technical execution procedures for deep foundations, precast bridge launching, asphalt surfacing, and culvert installation"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-600">MS-STR-012</span>
                    <StatusBadge label="Approved by Resident Engineer" variant="success" size="sm" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Method Statement: Tremie Method Under-Water Concrete Pouring for Bored Piles</h4>
                  <p className="text-xs text-slate-500">Includes slump retention requirements, continuous pour protocol, and bentonite slurry displacement monitoring.</p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-600">MS-PVMT-004</span>
                    <StatusBadge label="Approved by Resident Engineer" variant="success" size="sm" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Method Statement: Modified Binder Asphalt Concrete (AC) Paving & Rolling Protocol</h4>
                  <p className="text-xs text-slate-500">Specifies temperature thresholds at delivery, minimum breakdown rolling passes, and nuclear density test frequency.</p>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* TAB 4: SEMANTIC SEARCH */}
        {activeTab === "semantic-search" && (
          <div className="space-y-6">
            <Panel
              title="Vector Semantic Search Engine"
              subtitle="Query across contracts, drawings, specifications, and daily diaries simultaneously"
            >
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#00B894] mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">Query Vector Knowledge Base</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Type any question such as "What is the concrete curing duration under COLTO Section 6400?" or "What are the requirements for 28-day notice under FIDIC Red Book?".
                </p>
                <div className="max-w-md mx-auto pt-2">
                  <input
                    type="text"
                    placeholder="Enter natural language query..."
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-[#00B894] focus:outline-none"
                  />
                </div>
              </div>
            </Panel>
          </div>
        )}

      </div>
    </ProjectShell>
  );
}
