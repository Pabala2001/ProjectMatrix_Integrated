import React, { useState, useMemo } from "react";
import { 
  ShieldCheck, 
  Scale, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Search, 
  Filter, 
  Sparkles, 
  Sliders, 
  Calendar, 
  Download, 
  Building, 
  DollarSign, 
  Layers, 
  ChevronRight, 
  ArrowRight,
  Send,
  FileCheck,
  Eye,
  Copy,
  Check
} from "lucide-react";
import { ProjectContractProfile, ContractRuleItem, NoticeRequirementEvaluation } from "../../types/contractRules";
import { ContractEngine } from "../../services/ContractEngine";

interface ContractRulesEngineExplorerProps {
  contractProfile: ProjectContractProfile;
  onOpenWizard: () => void;
}

export default function ContractRulesEngineExplorer({
  contractProfile,
  onOpenWizard
}: ContractRulesEngineExplorerProps) {
  const [activeTab, setActiveTab] = useState<"simulator" | "rules_browser" | "project_profile">("simulator");
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Interactive Simulator State
  const [simTriggerKey, setSimTriggerKey] = useState<string>("contractor_awareness");
  const [simEventDate, setSimEventDate] = useState<string>(
    new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [simDescription, setSimDescription] = useState<string>(
    "Unforeseen high-water table and soft saturated silt encountered during northern bridge pier foundation excavation at Ch 14+200."
  );
  const [simDelayEstimate, setSimDelayEstimate] = useState<number>(18);
  const [simCostEstimate, setSimCostEstimate] = useState<number>(450000);
  
  // Notice Letter Generation Modal / Drawer
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Live Evaluation from ContractEngine
  const evaluation: NoticeRequirementEvaluation = useMemo(() => {
    return ContractEngine.getNoticeRequirement(contractProfile, simTriggerKey, simEventDate);
  }, [contractProfile, simTriggerKey, simEventDate]);

  // All Rules for Current Contract
  const activeRules = useMemo(() => {
    return ContractEngine.getAllRules(contractProfile);
  }, [contractProfile]);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return activeRules.filter(r => {
      const matchWorkflow = selectedWorkflow === "all" || r.workflowCategory === selectedWorkflow;
      const searchLower = searchQuery.toLowerCase();
      const matchSearch = !searchQuery || 
        r.clauseIdentifier.toLowerCase().includes(searchLower) ||
        r.clauseTitle.toLowerCase().includes(searchLower) ||
        r.requirementSummary.toLowerCase().includes(searchLower) ||
        r.triggerCondition.toLowerCase().includes(searchLower) ||
        r.requiredAction.toLowerCase().includes(searchLower) ||
        r.consequenceOfFailure.toLowerCase().includes(searchLower);
      return matchWorkflow && matchSearch;
    });
  }, [activeRules, selectedWorkflow, searchQuery]);

  const handleGenerateNotice = () => {
    const letter = ContractEngine.generateNoticeLetter(
      contractProfile,
      evaluation.rule.id,
      {
        subject: `Notice under Clause ${evaluation.rule.clauseIdentifier}: ${evaluation.rule.clauseTitle}`,
        eventDate: simEventDate,
        eventDescription: simDescription,
        preliminaryDelayDays: simDelayEstimate,
        preliminaryCostImpact: simCostEstimate
      }
    );
    setGeneratedLetter(letter);
  };

  const handleCopyLetter = () => {
    if (generatedLetter) {
      navigator.clipboard.writeText(generatedLetter);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Contract Admin Overview & Wizard Trigger */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white border border-slate-700 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Scale className="w-64 h-64 text-blue-400" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                {contractProfile.family} Standard Suite
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Governing Law: {contractProfile.governingLaw}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono text-slate-300 bg-slate-800 border border-slate-700">
                {contractProfile.suiteCode}
              </span>
            </div>
            
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>{contractProfile.formName}</span>
              <span className="text-sm font-normal text-slate-400">({contractProfile.edition})</span>
            </h2>
            
            <p className="text-xs text-slate-300 max-w-2xl">
              Contract administration engine actively evaluating procedural requirements, condition precedents, reciprocal notice triggers, and time-bar deadlines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenWizard}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 hover:scale-[1.02]"
            >
              <Sliders className="w-4 h-4" />
              Configure Contract Wizard
            </button>
          </div>
        </div>

        {/* Quick Parameters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-5 mt-4 border-t border-slate-800 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block">Employer</span>
            <strong className="text-white truncate block">{contractProfile.employer?.name?.split(" ")[0]}...</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">{contractProfile.engineerOrPM?.roleTitle || "Engineer"}</span>
            <strong className="text-white truncate block">{contractProfile.engineerOrPM?.name}</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Contract Sum</span>
            <strong className="text-emerald-400 font-mono block">
              {contractProfile.commercial?.contractCurrency} {(contractProfile.commercial?.contractValue / 1000000).toFixed(1)}M
            </strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Claim Notice Limit</span>
            <strong className="text-rose-400 font-mono block">{contractProfile.proceduralRules?.claimNoticePeriodDays || 28} Calendar Days</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Detailed Claim</span>
            <strong className="text-amber-400 font-mono block">{contractProfile.proceduralRules?.detailedClaimSubmissionPeriodDays || 84} Days</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">IPC Assessment</span>
            <strong className="text-blue-300 font-mono block">{contractProfile.proceduralRules?.interimPaymentCertificationPeriodDays || 28} Days</strong>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("simulator")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "simulator"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Ask ContractEngine (Notice & Trigger Simulator)
        </button>

        <button
          onClick={() => setActiveTab("rules_browser")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "rules_browser"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          Normalized Rules Database ({activeRules.length} Rules)
        </button>

        <button
          onClick={() => setActiveTab("project_profile")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "project_profile"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          Contract Administration Dossier
        </button>
      </div>

      {/* TAB 1: INTERACTIVE SIMULATOR (ASK CONTRACTENGINE) */}
      {activeTab === "simulator" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* Left Column: Trigger Inputs */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Trigger Event Parameters
                </h3>
                <span className="text-[10px] text-slate-400">Real-time Rule Resolution</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  1. Trigger Event / Condition
                </label>
                <select
                  value={simTriggerKey}
                  onChange={e => setSimTriggerKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white"
                >
                  <option value="contractor_awareness">Contractor becomes aware of delay / cost event (Clause 20.2.1 / 61.3 / 10.1)</option>
                  <option value="notice_of_claim_submitted">Notice of Claim submitted → Detailed Claim deadline (Clause 20.2.4)</option>
                  <option value="detailed_claim_received">Detailed Claim submitted → Engineer Determination (Clause 3.7.3 / 62.6)</option>
                  <option value="monthly_billing_cycle">Monthly Billing Cycle → IPC Application (Clause 14.3 / 6.10)</option>
                  <option value="ipc_statement_received">IPC Statement submitted → Engineer Certification (Clause 14.6)</option>
                  <option value="payment_due_cycle">Payment due cycle → Employer Disbursement (Clause 14.7)</option>
                  <option value="probable_future_delay">Early Warning Trigger / Advance Notice (Clause 8.4 / 15.1)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  2. Event Awareness / Occurrence Date
                </label>
                <input
                  type="date"
                  value={simEventDate}
                  onChange={e => setSimEventDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  3. Incident / Circumstance Description
                </label>
                <textarea
                  rows={3}
                  value={simDescription}
                  onChange={e => setSimDescription(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Estimated Delay (Days)
                  </label>
                  <input
                    type="number"
                    value={simDelayEstimate}
                    onChange={e => setSimDelayEstimate(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Estimated Cost ({contractProfile.commercial?.contractCurrency})
                  </label>
                  <input
                    type="number"
                    value={simCostEstimate}
                    onChange={e => setSimCostEstimate(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerateNotice}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <FileCheck className="w-4 h-4" />
                  Generate Compliant Notice Letter
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live ContractEngine Dynamic Output */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              
              {/* Header: Rule Match */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Clause {evaluation.rule.clauseIdentifier}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {evaluation.rule.clauseTitle}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{evaluation.rule.requirementSummary}</p>
                </div>

                {/* Time-Bar Status Badge */}
                <div className={`px-3 py-1.5 rounded-xl border text-center shrink-0 ${
                  evaluation.timeBarStatus === "TIME_BARRED"
                    ? "bg-rose-100 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                    : evaluation.timeBarStatus === "IMMINENT_TIME_BAR"
                    ? "bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                    : "bg-emerald-100 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                }`}>
                  <span className="text-[10px] font-bold block uppercase tracking-wider">
                    {evaluation.timeBarStatus.replace(/_/g, " ")}
                  </span>
                  <strong className="text-sm font-mono font-black block">
                    {evaluation.daysRemaining >= 0 ? `${evaluation.daysRemaining} Days Left` : `${Math.abs(evaluation.daysRemaining)} Days Overdue`}
                  </strong>
                </div>
              </div>

              {/* Deadline Radar Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Event Trigger Date</span>
                  <strong className="text-slate-900 dark:text-white font-mono">{simEventDate}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Notice Time Limit</span>
                  <strong className="text-blue-600 dark:text-blue-400 font-mono">
                    {evaluation.rule.deadline.durationValue} {evaluation.rule.deadline.durationUnit.replace(/_/g, " ")}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Absolute Deadline</span>
                  <strong className="text-rose-600 dark:text-rose-400 font-mono">{evaluation.deadlineDate}</strong>
                </div>
              </div>

              {/* Roles & Required Action */}
              <div className="space-y-3">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider block mb-1">
                    Required Action & Workflow Step
                  </span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl">
                    {evaluation.requiredActionSummary}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <span className="text-[10px] text-slate-400 block">Responsible Role</span>
                    <strong className="text-slate-900 dark:text-white">{evaluation.responsibleRole} ({contractProfile.contractor.name})</strong>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <span className="text-[10px] text-slate-400 block">Recipient Role</span>
                    <strong className="text-slate-900 dark:text-white">{evaluation.recipientRole} ({contractProfile.engineerOrPM.name})</strong>
                  </div>
                </div>
              </div>

              {/* Consequence of Failure Warning */}
              <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Legal Consequence of Failure to Comply:
                </div>
                <p className="text-[11px] text-rose-900 dark:text-rose-300">
                  {evaluation.legalConsequence}
                </p>
              </div>

              {/* Deliverables Checklist */}
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider block mb-2">
                  Mandatory Notice Dossier Deliverables:
                </span>
                <div className="space-y-1.5">
                  {evaluation.draftingChecklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* TAB 2: NORMALIZED RULES DATABASE BROWSER */}
      {activeTab === "rules_browser" && (
        <div className="space-y-4 animate-fadeIn">
          
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search clause, trigger, or action..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: "all", label: "All Categories" },
                { id: "claims", label: "Claims & EOT" },
                { id: "early_warning", label: "Early Warning" },
                { id: "payment", label: "Interim Payment" },
                { id: "variations", label: "Variations" }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedWorkflow(f.id)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg whitespace-nowrap transition-colors ${
                    selectedWorkflow === f.id
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rules Cards List */}
          <div className="space-y-3">
            {filteredRules.map(rule => (
              <div
                key={rule.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Clause {rule.clauseIdentifier}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {rule.clauseTitle}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {rule.workflowCategory.toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      rule.strictness === "STRICT_TIME_BAR"
                        ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                        : rule.strictness === "DEEMED_ACCEPTANCE"
                        ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                        : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                    }`}>
                      {rule.strictness.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {/* 6-Level Hierarchy Normalized Display */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Trigger & Condition */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      1. Trigger Event
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">
                      {rule.triggerCondition}
                    </p>
                  </div>

                  {/* Deadline Rule */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      2. Statutory Deadline
                    </span>
                    <p className="text-blue-600 dark:text-blue-400 font-bold font-mono">
                      {rule.deadline.durationValue} {rule.deadline.durationUnit.replace(/_/g, " ")} from {rule.deadline.computedFrom.replace(/_/g, " ")}
                    </p>
                    <span className="text-[10px] text-slate-400 block">
                      {rule.deadline.extendable ? "Extendable with agreement" : "Non-extendable strict time-bar"}
                    </span>
                  </div>

                  {/* Required Action */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      3. Action & Responsible Role
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">
                      {rule.requiredAction}
                    </p>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                      Role: {rule.responsibleRole} → {rule.recipientRole}
                    </span>
                  </div>
                </div>

                {/* Consequence of Failure */}
                <div className="p-3 bg-rose-50/40 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/50 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-rose-900 dark:text-rose-300 font-semibold block">
                      Consequence of Non-Compliance:
                    </strong>
                    <span className="text-slate-700 dark:text-slate-300 text-[11px]">
                      {rule.consequenceOfFailure}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* TAB 3: PROJECT ADMINISTRATIVE PROFILE */}
      {activeTab === "project_profile" && (
        <div className="space-y-5 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Key Entities */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" />
                Contract Administration Roster
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">The Employer</span>
                  <strong className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">
                    {contractProfile.employer.name}
                  </strong>
                  <span className="text-slate-500 block text-[11px]">{contractProfile.employer.representative} ({contractProfile.employer.organisation})</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Contract Administrator</span>
                  <strong className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">
                    {contractProfile.engineerOrPM.name}
                  </strong>
                  <span className="text-slate-500 block text-[11px]">
                    {contractProfile.engineerOrPM.roleTitle} • {contractProfile.engineerOrPM.organisation}
                  </span>
                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 block mt-1">
                    Reg: {contractProfile.engineerOrPM.registrationNumber || "PrEng Verified"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">The Contractor</span>
                  <strong className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">
                    {contractProfile.contractor.name}
                  </strong>
                  <span className="text-slate-500 block text-[11px]">{contractProfile.contractor.representative}</span>
                </div>
              </div>
            </div>

            {/* Document Vault & Particular Conditions */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Licensed Project Documents Vault
              </h3>

              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-blue-600" />
                    {contractProfile.particularConditions?.uploadedDocumentName || "Contract_Particular_Conditions.pdf"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {contractProfile.particularConditions?.uploadedDocumentSize || "4.8 MB"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Authorized project contract agreement & special conditions linked to active project workspace.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => alert("Downloading authorized project contract agreement...")}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Open Authorized Project Document
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                <strong>Z-Clauses / Special Conditions Summary:</strong>
                <p>{contractProfile.particularConditions?.zClausesSummary || "Standard General Conditions applied without clause deletions."}</p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* GENERATED NOTICE LETTER MODAL */}
      {generatedLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600" />
                ContractEngine Generated Contractual Notice
              </h3>
              <button
                onClick={() => setGeneratedLetter(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-slate-50 dark:bg-slate-950 flex-1 leading-relaxed">
              {generatedLetter}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Generated under {contractProfile.family} {contractProfile.formName} ({contractProfile.edition})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLetter}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                >
                  {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {isCopied ? "Copied to Clipboard!" : "Copy Notice Text"}
                </button>
                <button
                  onClick={() => setGeneratedLetter(null)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
