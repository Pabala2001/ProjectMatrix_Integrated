import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { 
  X, 
  Check, 
  ShieldCheck, 
  FileText, 
  Scale, 
  Building, 
  Calendar, 
  DollarSign, 
  Clock, 
  AlertCircle, 
  Upload, 
  Sparkles, 
  HelpCircle,
  FileCheck,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  Sliders,
  CheckCircle2,
  FolderOpen
} from "lucide-react";
import { ProjectContractProfile, ContractFamilyId } from "../../types/contractRules";
import { ContractEngine } from "../../services/ContractEngine";

interface ContractConfigWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onProfileSaved: (profile: ProjectContractProfile) => void;
}

export default function ContractConfigWizardModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  onProfileSaved
}: ContractConfigWizardModalProps) {
  const existingProfile = ContractEngine.getContractProfile(projectId);

  const [step, setStep] = useState<number>(1);
  const totalSteps = 6;

  // Form State
  const [family, setFamily] = useState<ContractFamilyId>(existingProfile.family || "FIDIC");
  const [formName, setFormName] = useState<string>(existingProfile.formName || "Red Book (Construction)");
  const [edition, setEdition] = useState<string>(existingProfile.edition || "2017 / 2022 reprint");
  const [suiteCode, setSuiteCode] = useState<string>(existingProfile.suiteCode || "FIDIC_2017_RED");
  const [amendments, setAmendments] = useState<string>(existingProfile.amendments || "2022 Reprint Amendments");
  const [governingLaw, setGoverningLaw] = useState<string>(existingProfile.governingLaw || "Tanzania");
  const [contractLanguage, setContractLanguage] = useState<string>(existingProfile.contractLanguage || "English");
  const [disputeForum, setDisputeForum] = useState<any>(existingProfile.disputeForum || "DAAB");

  // Parties
  const [employerName, setEmployerName] = useState<string>(existingProfile.employer?.name || "Tanzania National Roads Agency (TANROADS)");
  const [employerRep, setEmployerRep] = useState<string>(existingProfile.employer?.representative || "Chief Executive Officer");
  const [employerOrg, setEmployerOrg] = useState<string>(existingProfile.employer?.organisation || "Ministry of Works and Transport");
  
  const [engineerRoleTitle, setEngineerRoleTitle] = useState<any>(existingProfile.engineerOrPM?.roleTitle || "Engineer");
  const [engineerName, setEngineerName] = useState<string>(existingProfile.engineerOrPM?.name || "Dr. Angela Mwamba, PrEng CEng");
  const [engineerOrg, setEngineerOrg] = useState<string>(existingProfile.engineerOrPM?.organisation || "SMEC International Pty Ltd");
  const [engineerReg, setEngineerReg] = useState<string>(existingProfile.engineerOrPM?.registrationNumber || "PrEng 20140889 / CEng 649201");
  
  const [contractorName, setContractorName] = useState<string>(existingProfile.contractor?.name || "Project Matrix Construction JV");
  const [contractorRep, setContractorRep] = useState<string>(existingProfile.contractor?.representative || "Contractor's Representative");

  // Commercial & Financial
  const [contractCurrency, setContractCurrency] = useState<string>(existingProfile.commercial?.contractCurrency || "TZS");
  const [contractValue, setContractValue] = useState<number>(existingProfile.commercial?.contractValue || 142500000000);
  const [advancePercent, setAdvancePercent] = useState<number>(existingProfile.commercial?.advancePaymentPercent || 15);
  const [advanceAmortRate, setAdvanceAmortRate] = useState<number>(existingProfile.commercial?.advancePaymentAmortisationRate || 25);
  const [retentionPercent, setRetentionPercent] = useState<number>(existingProfile.commercial?.retentionPercent || 10);
  const [retentionLimitPercent, setRetentionLimitPercent] = useState<number>(existingProfile.commercial?.retentionLimitPercent || 5);
  const [performanceSecPercent, setPerformanceSecPercent] = useState<number>(existingProfile.commercial?.performanceSecurityPercent || 10);
  const [delayDamagesPerDay, setDelayDamagesPerDay] = useState<number>(existingProfile.commercial?.delayDamagesPerDay || 75000000);
  const [lateInterestFormula, setLateInterestFormula] = useState<string>(existingProfile.commercial?.interestRateOnLatePayment || "Central Bank Discount Rate + 3.0%");

  // Timelines
  const [commencementDate, setCommencementDate] = useState<string>(existingProfile.timelines?.commencementDate || "2024-02-01");
  const [timeForCompletionDays, setTimeForCompletionDays] = useState<number>(existingProfile.timelines?.timeForCompletionDays || 730);
  const [completionTargetDate, setCompletionTargetDate] = useState<string>(existingProfile.timelines?.completionTargetDate || "2026-01-31");
  const [defectsPeriodDays, setDefectsPeriodDays] = useState<number>(existingProfile.timelines?.defectsNotificationPeriodDays || 365);
  const [latentDefectsYears, setLatentDefectsYears] = useState<number>(existingProfile.timelines?.latentDefectsYears || 10);

  // Procedural Rules & Deadlines
  const [claimNoticeDays, setClaimNoticeDays] = useState<number>(existingProfile.proceduralRules?.claimNoticePeriodDays || 28);
  const [detailedClaimDays, setDetailedClaimDays] = useState<number>(existingProfile.proceduralRules?.detailedClaimSubmissionPeriodDays || 84);
  const [engineerDetDays, setEngineerDetDays] = useState<number>(existingProfile.proceduralRules?.engineerDeterminationPeriodDays || 42);
  const [ipcCertDays, setIpcCertDays] = useState<number>(existingProfile.proceduralRules?.interimPaymentCertificationPeriodDays || 28);
  const [paymentDueDays, setPaymentDueDays] = useState<number>(existingProfile.proceduralRules?.paymentDuePeriodDays || 56);
  const [rfiTurnaroundDays, setRfiTurnaroundDays] = useState<number>(existingProfile.proceduralRules?.rfiResponseTurnaroundDays || 7);
  const [submittalReviewDays, setSubmittalReviewDays] = useState<number>(existingProfile.proceduralRules?.submittalReviewPeriodDays || 21);

  // Particular Conditions & Document Upload
  const [hasCustomZClauses, setHasCustomZClauses] = useState<boolean>(existingProfile.particularConditions?.hasCustomZClauses || false);
  const [zClausesSummary, setZClausesSummary] = useState<string>(existingProfile.particularConditions?.zClausesSummary || "");
  const [uploadedFileName, setUploadedFileName] = useState<string>(existingProfile.particularConditions?.uploadedDocumentName || "TANROADS_Contract_Agreement_Particular_Conditions_2024.pdf");
  const [uploadedFileSize, setUploadedFileSize] = useState<string>(existingProfile.particularConditions?.uploadedDocumentSize || "4.8 MB");

  if (!isOpen) return null;

  // Handle Preset Changes when selecting Contract Family
  const handleFamilySelect = (fam: ContractFamilyId) => {
    setFamily(fam);
    if (fam === "FIDIC") {
      setFormName("Red Book (Construction)");
      setEdition("2017 / 2022 reprint");
      setSuiteCode("FIDIC_2017_RED");
      setAmendments("2022 Reprint Amendments");
      setDisputeForum("DAAB");
      setEngineerRoleTitle("Engineer");
      setClaimNoticeDays(28);
      setDetailedClaimDays(84);
      setEngineerDetDays(42);
      setIpcCertDays(28);
      setPaymentDueDays(56);
    } else if (fam === "NEC") {
      setFormName("ECC (Engineering and Construction Contract)");
      setEdition("NEC4 (June 2017 with 2023 amendments)");
      setSuiteCode("NEC4_ECC");
      setAmendments("Secondary Options X1, X2, X7, Y(ZA)1, Z-clauses");
      setDisputeForum("Adjudication");
      setEngineerRoleTitle("Project Manager");
      setClaimNoticeDays(56); // 8 weeks
      setDetailedClaimDays(21);
      setEngineerDetDays(14);
      setIpcCertDays(7);
      setPaymentDueDays(14);
    } else if (fam === "SOUTH_AFRICA") {
      setFormName("General Conditions of Contract (GCC)");
      setEdition("3rd Edition 2015");
      setSuiteCode("GCC_2015");
      setAmendments("Special Conditions of Contract (SANRAL)");
      setDisputeForum("Adjudication");
      setEngineerRoleTitle("Engineer");
      setClaimNoticeDays(28);
      setDetailedClaimDays(28);
      setEngineerDetDays(28);
      setIpcCertDays(7);
      setPaymentDueDays(28);
    } else if (fam === "UK_INTERNATIONAL") {
      setFormName("JCT Design and Build Contract");
      setEdition("2024 Edition");
      setSuiteCode("JCT_DB_2024");
      setAmendments("Schedule of Amendments");
      setDisputeForum("Adjudication");
      setEngineerRoleTitle("Employer's Agent");
      setClaimNoticeDays(14);
      setDetailedClaimDays(28);
      setEngineerDetDays(28);
      setIpcCertDays(14);
      setPaymentDueDays(14);
    } else {
      setFormName("Employer Bespoke EPC Contract");
      setEdition("2024 Custom Release");
      setSuiteCode("CUSTOM_BESPOKE");
      setAmendments("Client Tailored Schedules");
      setDisputeForum("ICC Arbitration");
      setEngineerRoleTitle("Engineer");
    }
  };

  const handleSave = () => {
    assertOperationalAction("write", "components/contracts/ContractConfigWizardModal.tsx");
    const updatedProfile: ProjectContractProfile = {
      id: existingProfile.id || `contract-profile-${projectId}`,
      projectId,
      projectName,
      family,
      formName,
      edition,
      suiteCode,
      amendments,
      governingLaw,
      contractLanguage,
      disputeForum,
      employer: {
        name: employerName,
        representative: employerRep,
        organisation: employerOrg
      },
      engineerOrPM: {
        roleTitle: engineerRoleTitle,
        name: engineerName,
        organisation: engineerOrg,
        registrationNumber: engineerReg
      },
      contractor: {
        name: contractorName,
        representative: contractorRep,
        organisation: contractorName
      },
      commercial: {
        contractCurrency,
        contractValue,
        contractValueFormatted: `${contractCurrency} ${contractValue.toLocaleString()}`,
        advancePaymentPercent: advancePercent,
        advancePaymentAmount: (contractValue * advancePercent) / 100,
        advancePaymentAmortisationRate: advanceAmortRate,
        retentionPercent,
        retentionLimitPercent,
        performanceSecurityPercent: performanceSecPercent,
        delayDamagesPerDay,
        delayDamagesCapPercent: 10,
        interestRateOnLatePayment: lateInterestFormula
      },
      timelines: {
        commencementDate,
        timeForCompletionDays,
        completionTargetDate,
        defectsNotificationPeriodDays: defectsPeriodDays,
        latentDefectsYears
      },
      proceduralRules: {
        claimNoticePeriodDays: claimNoticeDays,
        detailedClaimSubmissionPeriodDays: detailedClaimDays,
        engineerDeterminationPeriodDays: engineerDetDays,
        interimPaymentCertificationPeriodDays: ipcCertDays,
        paymentDuePeriodDays: paymentDueDays,
        rfiResponseTurnaroundDays: rfiTurnaroundDays,
        submittalReviewPeriodDays: submittalReviewDays
      },
      particularConditions: {
        hasCustomZClauses,
        zClausesSummary,
        uploadedDocumentName: uploadedFileName,
        uploadedDocumentSize: uploadedFileSize,
        uploadedDate: "19 Aug 2026",
        licensedDocumentUrl: `/docs/contracts/${uploadedFileName}`
      },
      status: "Active & Administered",
      lastConfiguredAt: "2026-08-19"
    };

    ContractEngine.saveContractProfile(updatedProfile);
    onProfileSaved(updatedProfile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Contract Configuration Wizard
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Step {step} of {totalSteps}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Configure legal parameters, notice time-bars, and financial governance for <strong className="text-slate-700 dark:text-slate-300">{projectName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Indicator */}
        <div className="grid grid-cols-6 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          {[
            { num: 1, label: "Form & Edition" },
            { num: 2, label: "Parties & Roles" },
            { num: 3, label: "Commercials" },
            { num: 4, label: "Timelines" },
            { num: 5, label: "Rules & Deadlines" },
            { num: 6, label: "Particulars & Deploy" }
          ].map(s => (
            <button
              key={s.num}
              onClick={() => setStep(s.num)}
              className={`p-3 text-center transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                step === s.num
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20 font-bold"
                  : step > s.num
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-400"
              }`}
            >
              <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-mono ${
                step === s.num 
                  ? "bg-blue-600 text-white" 
                  : step > s.num 
                  ? "bg-emerald-500 text-white" 
                  : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}>
                {step > s.num ? "✓" : s.num}
              </span>
              <span className="hidden md:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* STEP 1: FORM & EDITION */}
          {step === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  1. Select Contract Family & Standard Form
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choose the contract suite architecture. The ContractEngine will load default time-bars, notice triggers, and dispute mechanisms.
                </p>
              </div>

              {/* Family Selector Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  { id: "FIDIC", label: "FIDIC", sub: "Red, Yellow, Silver", desc: "International Civil/EPC" },
                  { id: "NEC", label: "NEC4 / NEC3", sub: "ECC, ECS, PSC", desc: "Collaborative / Target Cost" },
                  { id: "SOUTH_AFRICA", label: "South Africa", sub: "GCC 2015, JBCC 6.2", desc: "SAICE Civil / Building" },
                  { id: "UK_INTERNATIONAL", label: "UK / JCT", sub: "Standard, D&B, Minor", desc: "UK & International D&B" },
                  { id: "CUSTOM", label: "Custom / Bespoke", sub: "Uploaded Contract", desc: "Client-Tailored Form" }
                ].map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleFamilySelect(item.id as ContractFamilyId)}
                    className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none text-left ${
                      family === item.id
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900 dark:text-white block">{item.label}</span>
                    <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 block mt-0.5">{item.sub}</span>
                    <span className="text-[10px] text-slate-500 block mt-1">{item.desc}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contract Form Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Edition / Release
                  </label>
                  <input
                    type="text"
                    value={edition}
                    onChange={e => setEdition(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amendments / Reprints
                  </label>
                  <input
                    type="text"
                    value={amendments}
                    onChange={e => setAmendments(e.target.value)}
                    placeholder="e.g. 2022 Reprint Amendments, Z-Clauses"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Governing Law & Jurisdiction
                  </label>
                  <input
                    type="text"
                    value={governingLaw}
                    onChange={e => setGoverningLaw(e.target.value)}
                    placeholder="e.g. Tanzania, South Africa, Kenya, UK"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                <span>
                  <strong>Legal Metadata Principle:</strong> Project Matrix stores rules, time-bars, and action workflows rather than shipping copyrighted contract text. Licensed documents can be attached in Step 6.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: PARTIES & ROLES */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600" />
                  2. Key Contract Parties & Administrative Roles
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Specify formal entities and designated statutory representatives.
                </p>
              </div>

              {/* Employer Box */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block">Employer (Client)</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Employer Organisation</label>
                    <input
                      type="text"
                      value={employerName}
                      onChange={e => setEmployerName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Employer Representative</label>
                    <input
                      type="text"
                      value={employerRep}
                      onChange={e => setEmployerRep(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Department / Ministry</label>
                    <input
                      type="text"
                      value={employerOrg}
                      onChange={e => setEmployerOrg(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Engineer / PM Box */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block">Contract Administrator</span>
                  <select
                    value={engineerRoleTitle}
                    onChange={e => setEngineerRoleTitle(e.target.value as any)}
                    className="px-2 py-1 text-[11px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                  >
                    <option value="Engineer">Engineer (FIDIC / GCC)</option>
                    <option value="Project Manager">Project Manager (NEC)</option>
                    <option value="Principal Agent">Principal Agent (JBCC)</option>
                    <option value="Employer's Agent">Employer's Agent (JCT)</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Designated Professional</label>
                    <input
                      type="text"
                      value={engineerName}
                      onChange={e => setEngineerName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Consulting Engineering Firm</label>
                    <input
                      type="text"
                      value={engineerOrg}
                      onChange={e => setEngineerOrg(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Professional Registration #</label>
                    <input
                      type="text"
                      value={engineerReg}
                      onChange={e => setEngineerReg(e.target.value)}
                      placeholder="e.g. PrEng 20140889, CEng MICE"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Contractor Box */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">Main Contractor</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Contractor / Consortium Name</label>
                    <input
                      type="text"
                      value={contractorName}
                      onChange={e => setContractorName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Contractor's Representative</label>
                    <input
                      type="text"
                      value={contractorRep}
                      onChange={e => setContractorRep(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: COMMERCIALS */}
          {step === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  3. Commercial & Financial Parameters
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Define contract sum, advance payment guarantees, retention limits, and delay damages.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contract Currency
                  </label>
                  <select
                    value={contractCurrency}
                    onChange={e => setContractCurrency(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                  >
                    <option value="TZS">TZS - Tanzanian Shilling</option>
                    <option value="ZAR">ZAR - South African Rand</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="KES">KES - Kenyan Shilling</option>
                    <option value="AED">AED - UAE Dirham</option>
                    <option value="SAR">SAR - Saudi Riyal</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Accepted Contract Amount
                  </label>
                  <input
                    type="number"
                    value={contractValue}
                    onChange={e => setContractValue(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Advance Payment</span>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      value={advancePercent}
                      onChange={e => setAdvancePercent(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-xs font-mono font-bold rounded border border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-xs font-bold">%</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Amortisation: {advanceAmortRate}%</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Retention Deductions</span>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      value={retentionPercent}
                      onChange={e => setRetentionPercent(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-xs font-mono font-bold rounded border border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-xs font-bold">%</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Max Cap: {retentionLimitPercent}%</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Performance Bond</span>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      value={performanceSecPercent}
                      onChange={e => setPerformanceSecPercent(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-xs font-mono font-bold rounded border border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-xs font-bold">%</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Demand Guarantee</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Delay Damages / Day</span>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      value={delayDamagesPerDay}
                      onChange={e => setDelayDamagesPerDay(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs font-mono font-bold rounded border border-slate-300 dark:border-slate-700"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Cap: 10% Contract Sum</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Financing Charges / Late Payment Interest Rate
                </label>
                <input
                  type="text"
                  value={lateInterestFormula}
                  onChange={e => setLateInterestFormula(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
            </div>
          )}

          {/* STEP 4: TIMELINES */}
          {step === 4 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  4. Time for Completion & Defect Liability Periods
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Configure project baseline milestone dates and statutory liability periods.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Commencement Date
                  </label>
                  <input
                    type="date"
                    value={commencementDate}
                    onChange={e => setCommencementDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Time for Completion (Days)
                  </label>
                  <input
                    type="number"
                    value={timeForCompletionDays}
                    onChange={e => setTimeForCompletionDays(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={completionTargetDate}
                    onChange={e => setCompletionTargetDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Defects Notification Period (DNP)</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Warranty duration post-Taking Over Certificate</p>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      value={defectsPeriodDays}
                      onChange={e => setDefectsPeriodDays(Number(e.target.value))}
                      className="w-24 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Calendar Days (12 Months)</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Latent Defects Statutory Liability</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Decennial / Civil Law hidden structural defect period</p>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      value={latentDefectsYears}
                      onChange={e => setLatentDefectsYears(Number(e.target.value))}
                      className="w-24 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Years from Final Certificate</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: PROCEDURAL RULES & DEADLINES */}
          {step === 5 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  5. Procedural Rules & Notice Deadlines (ContractEngine Engine)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust default time-bar limits if modified by Particular Conditions. These drive active automated alerts.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-400">Claim Notice Time-Bar</span>
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 rounded">
                      Strict Condition Precedent
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Days from awareness of event before claim rights are forfeited forever.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      value={claimNoticeDays}
                      onChange={e => setClaimNoticeDays(Number(e.target.value))}
                      className="w-20 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Days (Default: 28 for FIDIC / GCC; 56 for NEC4)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400">Detailed Claim Submission</span>
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                      Full Particulars
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Days to submit CPM Time Impact Analysis and direct cost records.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      value={detailedClaimDays}
                      onChange={e => setDetailedClaimDays(Number(e.target.value))}
                      className="w-20 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Days (Default: 84 for FIDIC; 28 for GCC)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Engineer Determination Window</span>
                  <p className="text-[11px] text-slate-500">
                    Days for Engineer to issue formal determination before deemed rejection / DAAB trigger.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      value={engineerDetDays}
                      onChange={e => setEngineerDetDays(Number(e.target.value))}
                      className="w-20 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Days (Default: 42 for FIDIC)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Payment Certification Period</span>
                  <p className="text-[11px] text-slate-500">
                    Days from Contractor's monthly statement to Engineer's signed IPC.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      value={ipcCertDays}
                      onChange={e => setIpcCertDays(Number(e.target.value))}
                      className="w-20 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Days (Default: 28 for FIDIC; 7 for GCC)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: PARTICULARS & DEPLOY */}
          {step === 6 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                  6. Attach Particular Conditions & Deploy Engine
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Upload project-specific Particular Conditions / Z-Clauses and finalize contract governance.
                </p>
              </div>

              {/* Upload Dropzone */}
              <div className="p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Upload Licensed Contract Agreement / Particular Conditions (PDF / DOCX)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Safe Document Vault: Links authorized project documents without distributing third-party copyrighted texts.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <span className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    {uploadedFileName} ({uploadedFileSize})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedFileName("TANROADS_Project_Agreement_Signed_2024.pdf");
                      setUploadedFileSize("6.2 MB");
                    }}
                    className="px-2.5 py-1 text-[11px] bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 rounded-lg text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    Change File
                  </button>
                </div>
              </div>

              {/* Z-Clauses Particular Conditions Note */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={hasCustomZClauses}
                    onChange={e => setHasCustomZClauses(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Project includes Special Provisions / Z-Clauses / Special Conditions of Contract
                </label>
                {hasCustomZClauses && (
                  <textarea
                    rows={3}
                    value={zClausesSummary}
                    onChange={e => setZClausesSummary(e.target.value)}
                    placeholder="Describe specific Z-clauses (e.g. local content quotas, security guarantees, altered time-bars)..."
                    className="w-full p-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                )}
              </div>

              {/* Configuration Summary Card */}
              <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ContractEngine Deployment Ready
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{suiteCode}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Framework:</span>
                    <strong className="text-white">{family} {formName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Jurisdiction:</span>
                    <strong className="text-white">{governingLaw} ({disputeForum})</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Claim Time-Bar:</span>
                    <strong className="text-amber-400">{claimNoticeDays} Days</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Contract Value:</span>
                    <strong className="text-emerald-400">{contractCurrency} {contractValue.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Step
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            {step < totalSteps ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
              >
                Next Step
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-md flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Deploy Contract Rules
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
