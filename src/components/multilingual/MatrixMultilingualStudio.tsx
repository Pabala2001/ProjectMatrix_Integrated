import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { 
  Globe2, 
  Languages, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  ArrowRight, 
  Layers, 
  ShieldCheck, 
  Clock, 
  Database, 
  FileSpreadsheet, 
  RefreshCw, 
  UserCheck, 
  Info,
  ChevronRight,
  Eye,
  Sliders,
  Check
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { LanguageCode, MultilingualIngestionResult } from "../../types/language";
import { PRESET_MULTILINGUAL_SAMPLES, processMultilingualReport } from "../../services/multilingualAiService";

interface MatrixMultilingualStudioProps {
  onRecordCommitted?: (result: MultilingualIngestionResult) => void;
  isOpenInModal?: boolean;
  onClose?: () => void;
}

export default function MatrixMultilingualStudio({
  onRecordCommitted,
  isOpenInModal = false,
  onClose
}: MatrixMultilingualStudioProps) {
  const { currentLanguage, setLanguage, languages, t, isRTL } = useLanguage();

  const [selectedPresetId, setSelectedPresetId] = useState<string>("swahili-dar");
  const [inputText, setInputText] = useState<string>(PRESET_MULTILINGUAL_SAMPLES[0].text);
  const [authorName, setAuthorName] = useState<string>(PRESET_MULTILINGUAL_SAMPLES[0].author.name);
  const [authorRole, setAuthorRole] = useState<string>(PRESET_MULTILINGUAL_SAMPLES[0].author.role);
  const [authorLocation, setAuthorLocation] = useState<string>(PRESET_MULTILINGUAL_SAMPLES[0].author.location);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ingestionResult, setIngestionResult] = useState<MultilingualIngestionResult | null>(() => {
    // Initial result for preset 0
    return {
      id: "SYNC-894201",
      timestamp: new Date().toISOString(),
      sourceText: PRESET_MULTILINGUAL_SAMPLES[0].text,
      sourceLanguage: "sw",
      detectedLanguageName: "Kiswahili (East Africa)",
      author: PRESET_MULTILINGUAL_SAMPLES[0].author,
      englishMaster: {
        title: "Daily Site Ingestion: 65 m³ Concrete Placement (Dar es Salaam Rail Corridor)",
        summary: "Successful placement of 65 m³ structural concrete executed by Juma Mkwawa (Senior Concrete Foreman). Slump and consistency tests passed with zero HSE incidents. 12 site operatives on duty. 1-hour initial rain delay absorbed without critical path impact.",
        workPackage: "WP-03: Heavy Civils & SGR Substructure",
        wbsCode: "WBS 2.4.1 - Bridge Pier Concrete Pour",
        formalRecord: "FIDIC Red Book Site Record Ref #SYNC-894201. Work executed under Technical Specification Sect. 03300. Slump test approved prior to pump discharge.",
        actionRequired: "Automatic progress credit +2.8% logged against Programme of Works Task ACT-204."
      },
      structuredData: {
        activityType: "Structural Concrete Placement",
        quantity: 65,
        unit: "m³",
        material: "Ready-Mix C35/45 Concrete",
        wbsCode: "WBS-2.4.1",
        location: "Dar es Salaam SGR Rail Yard - Section 2",
        labourCount: 12,
        equipmentUsed: ["Concrete Boom Pump (x2)", "Agitator Trucks (x4)", "Immersion Vibrators (x3)"],
        weatherConditions: "Rain delayed 1 hr, operational (28°C)",
        hseIncidentCount: 0,
        qualityPassed: true,
        scheduleImpactDays: 0,
        costImpact: 0
      },
      localizedViews: {
        en: {
          title: "65 m³ Concrete Placement Completed",
          summary: "Field crew completed pouring 65 m³ of concrete. 12 personnel active, zero HSE safety variances reported. Quality inspection approved.",
          actionItems: ["Archived slump test compliance sheet", "Logged +2.8% progress in Programme of Works", "Approved daily subcontractor ticket"],
          fieldNotes: PRESET_MULTILINGUAL_SAMPLES[0].text
        },
        ar: {
          title: "اكتمال صب 65 متر مكعب من الخرسانة المسلحة",
          summary: "أتم طاقم الموقع صب 65 م³ من الخرسانة الإنشائية. تواجد 12 فنياً، مع صفر حوادث سلامة. تم اعتماد اختبارات الجودة والهبوط بنجاح.",
          actionItems: ["أرشفة شهادة مطابقة اختبار الهبوط", "تحديث تقدم الأعمال في البرنامج الزمني العام (+2.8%)", "اعتماد السجل اليومي لمقاول الباطن"],
          fieldNotes: PRESET_MULTILINGUAL_SAMPLES[0].text
        },
        fr: {
          title: "Coulage de 65 m³ de béton achevé",
          summary: "L'équipe de chantier a finalisé le coulage de 65 m³ de béton armé. 12 ouvriers mobilisés, aucun incident HSE. Contrôle qualité validé.",
          actionItems: ["Archivage de la fiche de contrôle d'affaissement", "Mise à jour du planning directeur (+2.8%)", "Validation du bon journalier du sous-traitant"],
          fieldNotes: PRESET_MULTILINGUAL_SAMPLES[0].text
        },
        pt: {
          title: "Concluída a betonagem de 65 m³ de betão estrutural",
          summary: "A equipa de obra concluiu a colocação de 65 m³ de betão. 12 operários no terreno, zero incidentes de segurança. Testes de consistência aprovados.",
          actionItems: ["Arquivo da ficha de ensaio de abaixamento", "Atualização do cronograma mestre (+2.8%)", "Validação do registo diário do subempreiteiro"],
          fieldNotes: PRESET_MULTILINGUAL_SAMPLES[0].text
        },
        sw: {
          title: "Kazi ya kumwaga zege mita za ujazo 65 imekamilika",
          summary: "Wafanyakazi wamekamilisha kumwaga 65 m³ za zege kwenye nguzo za reli. Mafundi 12 walikuwepo, hakuna ajali yoyote ya kiusalama. Ukaguzi wa ubora umepita.",
          actionItems: ["Kuhifadhi cheti cha ukaguzi wa ubora wa zege", "Kusasisha maendeleo kwenye ratiba kuu ya mradi (+2.8%)", "Kuidhinisha ripoti ya kila siku ya mkandarasi msaidizi"],
          fieldNotes: PRESET_MULTILINGUAL_SAMPLES[0].text
        }
      },
      crossLingualSyncStatus: "synchronized",
      complianceNote: "Contractual Baseline Verified (FIDIC Cl. 4.12 / NEC3 Cl. 60.1)"
    };
  });

  const [activeTabLanguage, setActiveTabLanguage] = useState<LanguageCode>("ar");
  const [committedSuccess, setCommittedSuccess] = useState<boolean>(false);

  const handleSelectPreset = (preset: typeof PRESET_MULTILINGUAL_SAMPLES[0]) => {
    setSelectedPresetId(preset.id);
    setInputText(preset.text);
    setAuthorName(preset.author.name);
    setAuthorRole(preset.author.role);
    setAuthorLocation(preset.author.location);
    handleProcess(preset.text, preset.author);
  };

  const handleProcess = async (textToProcess = inputText, authorObj?: any) => {
    if (!textToProcess.trim()) return;
    setIsProcessing(true);
    setCommittedSuccess(false);

    try {
      const result = await processMultilingualReport({
        text: textToProcess,
        authorName: authorObj?.name || authorName,
        authorRole: authorObj?.role || authorRole,
        authorLocation: authorObj?.location || authorLocation,
        hubCode: authorObj?.hubCode || "GLB"
      });

      setIngestionResult(result);
    } catch (err) {
      console.error("Multilingual processing error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommitRecord = () => {
    assertOperationalAction("write", "components/multilingual/MatrixMultilingualStudio.tsx");
    if (!ingestionResult) return;
    setCommittedSuccess(true);
    if (onRecordCommitted) {
      onRecordCommitted(ingestionResult);
    }
    setTimeout(() => {
      setCommittedSuccess(false);
    }, 4000);
  };

  return (
    <div className="space-y-6" id="matrix-multilingual-studio">
      
      {/* 1. STUDIO HEADER WITH STRATEGIC ARCHITECTURAL BANNER */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#07182E] via-[#0E2A47] to-[#07182E] text-white border border-[#1E3A5F] shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FF9F1C] text-slate-950 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5" />
                Matrix AI Cross-Lingual Engine
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live 5-Way Telemetry Sync
              </span>
              <span className="text-[10px] font-mono text-slate-300">
                EN • AR (RTL) • FR • PT • SW
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>{t("ai.multilingualHeadline", "One Source of Truth. Any Language on Site.")}</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {t("ai.multilingualDesc", "A foreman logs in Swahili, a Saudi engineer enters Arabic, and an executive in London sees standardized English in real-time with full WBS and BOQ reconciliation.")}
            </p>
          </div>

          {/* Current App UI Language Switcher Bar */}
          <div className="p-2.5 rounded-xl bg-[#07182E]/90 border border-[#1E3A5F] flex flex-col gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Globe2 className="w-3 h-3 text-[#FF9F1C]" />
              App Interface Language
            </span>
            <div className="flex flex-wrap gap-1">
              {languages.map((lang) => {
                const isSelected = currentLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-[#FF9F1C] text-slate-950 shadow-xs"
                        : "bg-[#102846] text-slate-200 hover:bg-[#1E3A5F] hover:text-white"
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.nativeName}</span>
                    {lang.direction === "rtl" && <span className="text-[9px] opacity-75 font-mono">(RTL)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 2. ONE-CLICK MULTILINGUAL PRESET SIMULATION TILES */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FF9F1C]" />
            Test Cross-Lingual Ingestion Scenarios
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">
            CLICK TO RUN REAL-TIME INGESTION
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {PRESET_MULTILINGUAL_SAMPLES.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-amber-50 dark:bg-amber-950/20 border-[#FF9F1C] ring-1 ring-[#FF9F1C]/40 shadow-xs"
                    : "bg-white dark:bg-[#07182E] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{preset.language === "sw" ? "🇹🇿" : preset.language === "ar" ? "🇸🇦" : preset.language === "fr" ? "🇫🇷" : preset.language === "pt" ? "🇲🇿" : "🇬🇧"}</span>
                      <span>{preset.languageName.split(" ")[0]}</span>
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {preset.author.hubCode}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 line-clamp-2 italic">
                    "{preset.text.slice(0, 70)}..."
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="truncate">{preset.author.name}</span>
                  <ChevronRight className="w-3 h-3 shrink-0 text-[#FF9F1C]" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. INTERACTIVE INGESTION WORKBENCH & REAL-TIME OUTPUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT COLUMN (5 cols): Native Field Input */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-amber-500/10 text-[#FF9F1C] rounded-md">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    {t("ai.foremanInputLabel", "Site Personnel Native Input")}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Foreman / Site Engineer Terminal</p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                Any Dialect / Language
              </span>
            </div>

            {/* Author Meta */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Reporter Name</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Role / Trade</label>
                <input
                  type="text"
                  value={authorRole}
                  onChange={(e) => setAuthorRole(e.target.value)}
                  className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Site Location / Package</label>
              <input
                type="text"
                value={authorLocation}
                onChange={(e) => setAuthorLocation(e.target.value)}
                className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
              />
            </div>

            {/* Textarea for Native Ingestion */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between">
                <span>Field Progress Note</span>
                <span className="text-[9px] text-[#FF9F1C] font-mono">Swahili • Arabic • French • Portuguese • English</span>
              </label>
              <textarea
                rows={4}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type or paste field report in Swahili, Arabic, French, Portuguese or English..."
                className="w-full mt-1 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#FF9F1C]/40"
              />
            </div>

            <button
              onClick={() => handleProcess()}
              disabled={isProcessing || !inputText.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#FF9F1C] to-amber-500 hover:from-amber-500 hover:to-[#FF9F1C] text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Matrix AI Processing Telemetry...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Process Cross-Lingual Ingestion</span>
                </>
              )}
            </button>
          </div>

          {/* Structured Telemetry Card Extracted by AI */}
          {ingestionResult && (
            <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
                    <Database className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    {t("ai.matrixExtractedLabel", "Matrix AI Extracted Telemetry")}
                  </h4>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {ingestionResult.detectedLanguageName}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Measured Quantity</span>
                  <span className="text-sm font-bold font-mono text-[#FF9F1C]">
                    {ingestionResult.structuredData.quantity} {ingestionResult.structuredData.unit}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Labour Count</span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                    {ingestionResult.structuredData.labourCount} Operatives
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">HSE Incidents</span>
                  <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    0 Incidents (Passed)
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-400 uppercase">Material Specification</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">{ingestionResult.structuredData.material}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-400 uppercase">Work Breakdown Structure</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{ingestionResult.structuredData.wbsCode}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (7 cols): English Master Record & Synchronized Local Views */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* A. GLOBAL MASTER RECORD (LONDON EXECUTIVE VIEW IN ENGLISH) */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border-2 border-blue-500/30 dark:border-blue-500/20 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    {t("ai.englishMasterLabel", "Global Master Record (Executive View)")}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Standardized English Master Baseline for London / Global Board</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600 text-white flex items-center gap-1">
                <span>🇬🇧</span>
                <span>English Master</span>
              </span>
            </div>

            {ingestionResult ? (
              <div className="space-y-3">
                <div>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                    {ingestionResult.englishMaster.title}
                  </h5>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {ingestionResult.englishMaster.summary}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono space-y-1.5">
                  <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>CONTRACT RECORD:</span>
                    <span className="text-slate-900 dark:text-white font-bold">{ingestionResult.id}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">
                    {ingestionResult.englishMaster.formalRecord}
                  </p>
                  <div className="pt-1 border-t border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{ingestionResult.englishMaster.actionRequired}</span>
                  </div>
                </div>

                {/* Commit Button */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400 font-mono">
                    FIDIC / NEC3 CLAUSE AUDIT TRAIL LOGGED
                  </span>
                  <button
                    onClick={handleCommitRecord}
                    className="px-4 py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    {committedSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Committed to Site Diary!</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>{t("ai.commitToDiary", "Commit to Project Master Diary")}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                Click "Process Cross-Lingual Ingestion" to generate the English master record.
              </div>
            )}
          </div>

          {/* B. SYNCHRONIZED MULTI-LINGUAL VIEWS (ARABIC, FRENCH, PORTUGUESE, SWAHILI) */}
          {ingestionResult && (
            <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    {t("ai.localizedSyncLabel", "Cross-Localized Synchronized Feeds")}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Instant localized projection of the exact same data record
                  </p>
                </div>

                {/* Tabs to switch localized view */}
                <div className="flex flex-wrap gap-1">
                  {(["ar", "fr", "pt", "sw", "en"] as LanguageCode[]).map((code) => {
                    const lInfo = languages.find(l => l.code === code);
                    const isActive = activeTabLanguage === code;
                    return (
                      <button
                        key={code}
                        onClick={() => setActiveTabLanguage(code)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          isActive
                            ? "bg-[#FF9F1C] text-slate-950 shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <span>{lInfo?.flag}</span>
                        <span>{lInfo?.nativeName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Render Selected Localized View */}
              {ingestionResult.localizedViews[activeTabLanguage] && (
                <div 
                  className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5 ${
                    activeTabLanguage === "ar" ? "text-right font-arabic" : "text-left"
                  }`}
                  dir={activeTabLanguage === "ar" ? "rtl" : "ltr"}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {ingestionResult.localizedViews[activeTabLanguage].title}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-[#FF9F1C] font-bold">
                      {activeTabLanguage.toUpperCase()} VIEW
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {ingestionResult.localizedViews[activeTabLanguage].summary}
                  </p>

                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      {activeTabLanguage === "ar" ? "بنود الإجراءات التنفيذية:" : activeTabLanguage === "fr" ? "Actions Requises:" : activeTabLanguage === "pt" ? "Ações Executivas:" : activeTabLanguage === "sw" ? "Hatua Zinazotakiwa:" : "Action Items:"}
                    </span>
                    <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                      {ingestionResult.localizedViews[activeTabLanguage].actionItems.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Raw Native Input Footnote */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 italic">
                    <span>{activeTabLanguage === "ar" ? "النص الأصلي المدخل بالموقع:" : activeTabLanguage === "fr" ? "Texte brut saisi sur le terrain:" : activeTabLanguage === "pt" ? "Texto original introduzido em obra:" : activeTabLanguage === "sw" ? "Maandishi halisi yaliyoingizwa saite:" : "Original Site Ingestion Text:"}</span>
                    <p className="mt-0.5 font-sans not-italic text-slate-500 dark:text-slate-400">
                      "{ingestionResult.sourceText}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
