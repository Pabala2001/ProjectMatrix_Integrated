import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Upload,
  Image as ImageIcon,
  Loader2,
  FileText,
  Users,
  Layers,
  HardHat,
  Calendar,
  AlertTriangle,
  Leaf,
  ShieldAlert,
  CheckCircle2,
  TrendingUp
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  ReportFormData,
  TeamMember,
  TechnicalActivity,
  WeeklyAchievement,
  MilestoneItem,
  PerformanceItem,
  RiskDelayItem,
  PlantItem,
  FuelRecord,
  PersonnelPresent
} from "./types";

interface ReportFormStepperProps {
  formData: ReportFormData;
  setFormData?: React.Dispatch<React.SetStateAction<ReportFormData | null>>;
  onChange?: (data: ReportFormData) => void;
  onSave: (status: "Draft" | "Final") => Promise<void> | void;
  onCancel: () => void;
  isSaving?: boolean;
  companyId: string;
  projectId: string;
  reportId: string;
}

export default function ReportFormStepper({
  formData,
  setFormData,
  onChange,
  onSave,
  onCancel,
  isSaving = false,
  companyId,
  projectId,
  reportId
}: ReportFormStepperProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [uploadingIndexes, setUploadingIndexes] = useState<Record<number, boolean>>({});

  // Helper to trigger form data state updates
  const updateFormData = (updated: ReportFormData) => {
    assertOperationalAction("edit", "pages/Reports/ReportFormStepper.tsx");
    if (onChange) {
      onChange(updated);
    }
    if (setFormData) {
      setFormData(updated);
    }
  };

  // Fetch signed URLs for site_pictures stored in private storage bucket
  useEffect(() => {
    const loadSignedUrls = async () => {
      const newSignedUrls = { ...signedUrls };
      let changed = false;

      for (const pic of formData.site_pictures || []) {
        if (
          pic.image &&
          !pic.image.startsWith("data:") &&
          !pic.image.startsWith("blob:") &&
          !pic.image.startsWith("http") &&
          !signedUrls[pic.id || pic.image]
        ) {
          try {
            const { data } = await supabase.storage
              .from("report-images")
              .createSignedUrl(pic.image, 3600);
            if (data?.signedUrl) {
              newSignedUrls[pic.id || pic.image] = data.signedUrl;
              changed = true;
            }
          } catch (err) {
            console.error("Error creating signed URL:", err);
          }
        }
      }

      if (changed) {
        setSignedUrls(newSignedUrls);
      }
    };

    loadSignedUrls();
  }, [formData.site_pictures]);

  // Dynamic step definitions based on frequency & category
  const getSteps = () => {
    const freq = formData.frequency;
    const cat = formData.category;

    const list: { key: string; title: string; desc: string }[] = [
      { key: "cover", title: "1. Cover Details", desc: "Basic project, contractor, client, and document metadata" },
      { key: "doc_control", title: "2. Document Control", desc: "Revision number, dates, authors, and approvers" },
      { key: "intro_team", title: "3. Intro & Team", desc: "Executive summary and project team members" },
      { key: "scope_prog", title: "4. Scope & Progress", desc: "Scope of work items and programme progress summary" },
    ];

    if (freq === "Daily") {
      list.push({ key: "daily_activities", title: "5. Daily Activities", desc: "Construction operations performed today" });
    } else if (freq === "Weekly") {
      list.push({ key: "weekly_achievements", title: "5. Weekly Achievements", desc: "Physical achievements and planned vs actual progress" });
    } else {
      list.push({ key: "monthly_progress", title: "5. Monthly Progress & SPI", desc: "Monthly execution summary, milestones, and SPI performance" });
    }

    list.push({ key: "resources", title: "6. Site Resources", desc: "Plant, equipment, fuel utilization, and personnel present" });

    if (freq === "Monthly") {
      list.push({ key: "risks_delays", title: "7. Risks & Delays", desc: "Project risks, impacts, and mitigation measures" });
    }

    if (cat === "Environmental") {
      list.push({ key: "environmental", title: "Environmental Spec", desc: "Environmental compliance, waste, and monitoring metrics" });
    } else if (cat === "Occupational Health and Safety") {
      list.push({ key: "ohs", title: "OHS & Safety Spec", desc: "Safe man hours, incident logs, PPE compliance, and toolbox talks" });
    }

    list.push({ key: "site_pictures", title: "Site Pictures", desc: "Site photo evidence with captions and notes" });

    const nextPlanLabel = freq === "Daily" ? "Tomorrow's Plan & Delays" : freq === "Weekly" ? "Next Week Plan & Delays" : "Next Month Outlook & Delays";
    list.push({ key: "next_plan", title: nextPlanLabel, desc: "Scheduled activities and project challenges or constraints" });

    // Format numbered labels cleanly
    return list.map((item, idx) => ({
      ...item,
      title: `${idx + 1}. ${item.title.replace(/^\d+\.\s*/, "")}`
    }));
  };

  const steps = getSteps();

  // Field change helpers
  const handleFieldChange = (section: string, field: string, value: any) => {
    if (section === "root") {
      updateFormData({ ...formData, [field]: value });
    } else {
      updateFormData({
        ...formData,
        [section]: {
          ...(formData[section as keyof ReportFormData] as object),
          [field]: value
        }
      });
    }
  };

  // Generic helpers for repeatable lists and tables
  const addTableRow = (section: keyof ReportFormData, defaultRow: any) => {
    const list = [...((formData[section] as any[]) || [])];
    list.push({ id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, ...defaultRow });
    updateFormData({ ...formData, [section]: list });
  };

  const removeTableRow = (section: keyof ReportFormData, index: number) => {
    const list = [...((formData[section] as any[]) || [])];
    list.splice(index, 1);
    updateFormData({ ...formData, [section]: list });
  };

  const updateTableRow = (section: keyof ReportFormData, index: number, field: string, value: any) => {
    const list = [...((formData[section] as any[]) || [])];
    list[index] = { ...list[index], [field]: value };
    updateFormData({ ...formData, [section]: list });
  };

  const addNestedList = (field: "current_items" | "completed_items", defaultText = "") => {
    assertOperationalAction("create", "pages/Reports/ReportFormStepper.tsx");
    const subList = [...(formData.programme_progress?.[field] || [])];
    subList.push({ id: `${field}-${Date.now()}`, text: defaultText });
    updateFormData({
      ...formData,
      programme_progress: {
        ...formData.programme_progress,
        [field]: subList
      }
    });
  };

  const removeNestedList = (field: "current_items" | "completed_items", index: number) => {
    assertOperationalAction("delete", "pages/Reports/ReportFormStepper.tsx");
    const subList = [...(formData.programme_progress?.[field] || [])];
    subList.splice(index, 1);
    updateFormData({
      ...formData,
      programme_progress: {
        ...formData.programme_progress,
        [field]: subList
      }
    });
  };

  const updateNestedList = (field: "current_items" | "completed_items", index: number, text: string) => {
    assertOperationalAction("edit", "pages/Reports/ReportFormStepper.tsx");
    const subList = [...(formData.programme_progress?.[field] || [])];
    subList[index] = { ...subList[index], text };
    updateFormData({
      ...formData,
      programme_progress: {
        ...formData.programme_progress,
        [field]: subList
      }
    });
  };

  // Helper for single image file to Base64
  const handleImageFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    onComplete: (base64: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onComplete(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingIndexes(prev => ({ ...prev, [index]: true }));

    try {
      const pic = formData.site_pictures[index];

      // Remove existing image from bucket if present
      if (pic.image && !pic.image.startsWith("data:") && !pic.image.startsWith("blob:") && !pic.image.startsWith("http")) {
        await supabase.storage.from("report-images").remove([pic.image]);
        await supabase.from("report_images").delete().eq("image_path", pic.image);
      }

      const sanitizedFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const storagePath = `${companyId}/${projectId}/${reportId}/${sanitizedFilename}`;

      const { error: uploadError } = await supabase.storage
        .from("report-images")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true
        });

      if (uploadError) throw uploadError;

      let { error: dbError } = await supabase
        .from("report_images")
        .insert({
          report_id: reportId,
          company_id: companyId,
          project_id: projectId,
          image_path: storagePath,
          caption: pic.caption || file.name
        });

      if (dbError && dbError.message?.includes("report_id")) {
        await supabase
          .from("report_images")
          .insert({
            technical_report_id: reportId,
            company_id: companyId,
            project_id: projectId,
            image_path: storagePath,
            caption: pic.caption || file.name
          });
      }

      const updatedPics = [...formData.site_pictures];
      updatedPics[index] = {
        ...pic,
        image: storagePath,
        caption: pic.caption || file.name
      };

      updateFormData({ ...formData, site_pictures: updatedPics });
    } catch (err) {
      console.error("Error uploading image:", err);
    } finally {
      setUploadingIndexes(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleClearImage = async (index: number) => {
    const pic = formData.site_pictures[index];
    if (pic.image && !pic.image.startsWith("data:") && !pic.image.startsWith("blob:") && !pic.image.startsWith("http")) {
      try {
        await supabase.storage.from("report-images").remove([pic.image]);
        await supabase.from("report_images").delete().eq("image_path", pic.image);
      } catch (err) {
        console.error("Error deleting image file:", err);
      }
    }

    const updatedPics = [...formData.site_pictures];
    updatedPics[index] = { ...pic, image: "" };
    updateFormData({ ...formData, site_pictures: updatedPics });
  };

  const handleRemovePictureEntry = async (index: number) => {
    assertOperationalAction("delete", "pages/Reports/ReportFormStepper.tsx");
    const pic = formData.site_pictures[index];
    if (pic?.image && !pic.image.startsWith("data:") && !pic.image.startsWith("blob:") && !pic.image.startsWith("http")) {
      try {
        await supabase.storage.from("report-images").remove([pic.image]);
        await supabase.from("report_images").delete().eq("image_path", pic.image);
      } catch (err) {
        console.error("Error removing picture file:", err);
      }
    }
    removeTableRow("site_pictures", index);
  };

  const currentStepKey = steps[activeStep]?.key || "cover";

  return (
    <div className="flex flex-col lg:flex-row gap-6 bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden min-h-[75vh]">
      
      {/* Dark Navy Sidebar Navigation */}
      <div className="w-full lg:w-64 bg-[#07182E] p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-1">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Report Sections
          </div>
          <nav className="space-y-1 max-h-[55vh] overflow-y-auto pr-1">
            {steps.map((step, idx) => (
              <button
                key={step.key}
                type="button"
                onClick={() => setActiveStep(idx)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeStep === idx 
                    ? "bg-[#FF9F1C] text-white shadow-md shadow-[#FF9F1C]/20" 
                    : "text-slate-300 hover:bg-[#102846] hover:text-white"
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                  activeStep === idx ? "bg-white text-[#FF9F1C]" : "bg-slate-700 text-slate-300"
                }`}>
                  {idx + 1}
                </span>
                <span className="truncate">{step.title.replace(/^\d+\.\s*/, "")}</span>
              </button>
            ))}
          </nav>
        </div>
        
        <div className="p-3 border-t border-slate-800 mt-6 hidden lg:block">
          <div className="text-[10px] font-medium text-slate-400">
            Completed: <strong className="text-white">{Math.round(((activeStep + 1) / steps.length) * 100)}%</strong>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div 
              className="bg-[#FF9F1C] h-full transition-all duration-300"
              style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Form Workspace */}
      <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto max-h-[82vh]">
        <div className="space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-extrabold text-[#07182E] dark:text-white tracking-tight">
              {steps[activeStep]?.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {steps[activeStep]?.desc}
            </p>
          </div>

          {/* STEP 1: COVER DETAILS */}
          {currentStepKey === "cover" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Project Name</label>
                <input
                  type="text"
                  value={formData.project_name}
                  onChange={(e) => handleFieldChange("root", "project_name", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Client Representative / Name</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleFieldChange("root", "client_name", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Contractor Name</label>
                <input
                  type="text"
                  value={formData.contractor_name}
                  onChange={(e) => handleFieldChange("root", "contractor_name", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Contract Number</label>
                <input
                  type="text"
                  value={formData.contract_number}
                  onChange={(e) => handleFieldChange("root", "contract_number", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Report Title</label>
                <input
                  type="text"
                  value={formData.report_title}
                  onChange={(e) => handleFieldChange("root", "report_title", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Report Number</label>
                <input
                  type="text"
                  value={formData.report_number}
                  onChange={(e) => handleFieldChange("root", "report_number", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {formData.frequency === "Daily" && (
                <div>
                  <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Reporting Date</label>
                  <input
                    type="date"
                    value={formData.report_date}
                    onChange={(e) => handleFieldChange("root", "report_date", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              {formData.frequency === "Weekly" && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Period Start Date</label>
                    <input
                      type="date"
                      value={formData.period_start_date || ""}
                      onChange={(e) => handleFieldChange("root", "period_start_date", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Period End Date</label>
                    <input
                      type="date"
                      value={formData.period_end_date || ""}
                      onChange={(e) => handleFieldChange("root", "period_end_date", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Issue / Submission Date</label>
                    <input
                      type="date"
                      value={formData.report_date}
                      onChange={(e) => handleFieldChange("root", "report_date", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </>
              )}

              {formData.frequency === "Monthly" && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Report Month</label>
                    <select
                      value={formData.report_month || "July"}
                      onChange={(e) => handleFieldChange("root", "report_month", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Report Year</label>
                    <input
                      type="number"
                      value={formData.report_year || 2026}
                      onChange={(e) => handleFieldChange("root", "report_year", parseInt(e.target.value) || 2026)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Period Start Date</label>
                    <input
                      type="date"
                      value={formData.period_start_date || ""}
                      onChange={(e) => handleFieldChange("root", "period_start_date", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Period End Date</label>
                    <input
                      type="date"
                      value={formData.period_end_date || ""}
                      onChange={(e) => handleFieldChange("root", "period_end_date", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </>
              )}

              {/* Cover Logos Section */}
              <div className="col-span-1 sm:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-2">Company / Contractor Logo</span>
                  {formData.company_logo ? (
                    <div className="relative group">
                      <img src={formData.company_logo} alt="Company logo preview" className="h-14 max-w-[180px] object-contain rounded border bg-white p-1" />
                      <button
                        type="button"
                        onClick={() => handleFieldChange("root", "company_logo", "")}
                        className="absolute -top-2 -right-2 bg-rose-500 hover:bg-rose-600 text-white p-1 rounded-full cursor-pointer shadow"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-[#FF9F1C] rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors bg-white dark:bg-slate-800 w-full">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-[11px] font-bold text-[#FF9F1C]">Upload Company Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageFileChange(e, (base64) => handleFieldChange("root", "company_logo", base64))}
                      />
                    </label>
                  )}
                </div>

                <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-2">Client Logo</span>
                  {formData.client_logo ? (
                    <div className="relative group">
                      <img src={formData.client_logo} alt="Client logo preview" className="h-14 max-w-[180px] object-contain rounded border bg-white p-1" />
                      <button
                        type="button"
                        onClick={() => handleFieldChange("root", "client_logo", "")}
                        className="absolute -top-2 -right-2 bg-rose-500 hover:bg-rose-600 text-white p-1 rounded-full cursor-pointer shadow"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-[#FF9F1C] rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors bg-white dark:bg-slate-800 w-full">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-[11px] font-bold text-[#FF9F1C]">Upload Client Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageFileChange(e, (base64) => handleFieldChange("root", "client_logo", base64))}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DOCUMENT CONTROL */}
          {currentStepKey === "doc_control" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Revision Number</label>
                <input
                  type="text"
                  value={formData.doc_control?.revision_number || "00"}
                  onChange={(e) => handleFieldChange("doc_control", "revision_number", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Revision Date</label>
                <input
                  type="date"
                  value={formData.doc_control?.revision_date || ""}
                  onChange={(e) => handleFieldChange("doc_control", "revision_date", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="col-span-1 sm:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Prepared By</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Print Name</label>
                    <input
                      type="text"
                      value={formData.doc_control?.prepared_print_name || ""}
                      onChange={(e) => handleFieldChange("doc_control", "prepared_print_name", e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Designation / Title</label>
                    <input
                      type="text"
                      value={formData.doc_control?.prepared_title || ""}
                      onChange={(e) => handleFieldChange("doc_control", "prepared_title", e.target.value)}
                      placeholder="e.g. Resident Engineer"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Prepared Date</label>
                    <input
                      type="date"
                      value={formData.doc_control?.prepared_date || ""}
                      onChange={(e) => handleFieldChange("doc_control", "prepared_date", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="mt-2.5">
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">Signature Image</label>
                  {formData.doc_control?.prepared_by_signature ? (
                    <div className="relative group inline-block">
                      <img src={formData.doc_control.prepared_by_signature} alt="Prepared By Signature" className="h-10 max-w-[200px] object-contain border rounded bg-white p-0.5" />
                      <button
                        type="button"
                        onClick={() => handleFieldChange("doc_control", "prepared_by_signature", "")}
                        className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white p-0.5 rounded-full cursor-pointer"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer text-[10px] font-bold text-[#FF9F1C] hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors inline-flex">
                      <Upload className="w-3.5 h-3.5" /> Upload Signature
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageFileChange(e, (b) => handleFieldChange("doc_control", "prepared_by_signature", b))}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="col-span-1 sm:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Reviewed By</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Print Name</label>
                    <input
                      type="text"
                      value={formData.doc_control?.reviewed_print_name || ""}
                      onChange={(e) => handleFieldChange("doc_control", "reviewed_print_name", e.target.value)}
                      placeholder="e.g. Jane Smith"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Designation / Title</label>
                    <input
                      type="text"
                      value={formData.doc_control?.reviewed_title || ""}
                      onChange={(e) => handleFieldChange("doc_control", "reviewed_title", e.target.value)}
                      placeholder="e.g. Project Manager"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Reviewed Date</label>
                    <input
                      type="date"
                      value={formData.doc_control?.reviewed_date || ""}
                      onChange={(e) => handleFieldChange("doc_control", "reviewed_date", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="mt-2.5">
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">Signature Image</label>
                  {formData.doc_control?.reviewed_by_signature ? (
                    <div className="relative group inline-block">
                      <img src={formData.doc_control.reviewed_by_signature} alt="Reviewed By Signature" className="h-10 max-w-[200px] object-contain border rounded bg-white p-0.5" />
                      <button
                        type="button"
                        onClick={() => handleFieldChange("doc_control", "reviewed_by_signature", "")}
                        className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white p-0.5 rounded-full cursor-pointer"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer text-[10px] font-bold text-[#FF9F1C] hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors inline-flex">
                      <Upload className="w-3.5 h-3.5" /> Upload Signature
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageFileChange(e, (b) => handleFieldChange("doc_control", "reviewed_by_signature", b))}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="col-span-1 sm:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Approved By (Organization / Representative)</label>
                <input
                  type="text"
                  value={formData.doc_control?.approved_by || ""}
                  onChange={(e) => handleFieldChange("doc_control", "approved_by", e.target.value)}
                  placeholder="e.g. Client Representative"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* STEP 3: INTRO & TEAM */}
          {currentStepKey === "intro_team" && (
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider mb-1">Executive Summary / Introduction</label>
                <textarea
                  rows={4}
                  value={formData.introduction || ""}
                  onChange={(e) => handleFieldChange("root", "introduction", e.target.value)}
                  placeholder="Provide an overview summary of report context, scope, and objectives..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider">Project Team Members</span>
                  <button
                    type="button"
                    onClick={() => addTableRow("project_team", { role: "Site Supervisor", organization: formData.contractor_name, designation: "Supervisor", name: "" })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#07182E] hover:bg-[#102846] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Team Member
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2.5">Role</th>
                        <th className="p-2.5">Organization</th>
                        <th className="p-2.5">Designation</th>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(formData.project_team || []).map((member, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="p-2">
                            <input
                              type="text"
                              value={member.role}
                              onChange={(e) => updateTableRow("project_team", idx, "role", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={member.organization}
                              onChange={(e) => updateTableRow("project_team", idx, "organization", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={member.designation}
                              onChange={(e) => updateTableRow("project_team", idx, "designation", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={member.name}
                              onChange={(e) => updateTableRow("project_team", idx, "name", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeTableRow("project_team", idx)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SCOPE & PROGRAMME PROGRESS */}
          {currentStepKey === "scope_prog" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider">Scope of Work Deliverables</span>
                  <button
                    type="button"
                    onClick={() => addTableRow("scope_of_work", { text: "" })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#07182E] hover:bg-[#102846] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Scope Item
                  </button>
                </div>

                <div className="space-y-2">
                  {(formData.scope_of_work || []).map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-[10px] font-mono text-slate-400 font-bold w-6">{idx + 1}.</span>
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => updateTableRow("scope_of_work", idx, "text", e.target.value)}
                        placeholder="Describe key scope objective..."
                        className="flex-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeTableRow("scope_of_work", idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded border border-slate-100 dark:border-slate-800 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
                <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider block">Programme Progress Summary</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Overall Completion %</label>
                    <input
                      type="text"
                      value={formData.programme_progress?.overall_percentage || "0%"}
                      onChange={(e) => handleFieldChange("programme_progress", "overall_percentage", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Programme Status Notes</label>
                    <input
                      type="text"
                      value={formData.programme_progress?.summary_notes || ""}
                      onChange={(e) => handleFieldChange("programme_progress", "summary_notes", e.target.value)}
                      placeholder="e.g. On schedule relative to baselined master programme"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Current & Completed Tasks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Current Active Tasks</span>
                      <button
                        type="button"
                        onClick={() => addNestedList("current_items")}
                        className="text-[9px] text-[#FF9F1C] font-bold hover:underline cursor-pointer"
                      >
                        + Add Task
                      </button>
                    </div>
                    {(formData.programme_progress?.current_items || []).map((item, idx) => (
                      <div key={idx} className="flex gap-1.5 items-center">
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => updateNestedList("current_items", idx, e.target.value)}
                          className="flex-1 px-2.5 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => removeNestedList("current_items", idx)}
                          className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Completed Work Tasks</span>
                      <button
                        type="button"
                        onClick={() => addNestedList("completed_items")}
                        className="text-[9px] text-[#FF9F1C] font-bold hover:underline cursor-pointer"
                      >
                        + Add Task
                      </button>
                    </div>
                    {(formData.programme_progress?.completed_items || []).map((item, idx) => (
                      <div key={idx} className="flex gap-1.5 items-center">
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => updateNestedList("completed_items", idx, e.target.value)}
                          className="flex-1 px-2.5 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => removeNestedList("completed_items", idx)}
                          className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 (DAILY): DAILY ACTIVITIES */}
          {currentStepKey === "daily_activities" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider">Daily Construction Operations</span>
                <button
                  type="button"
                  onClick={() => addTableRow("technical_activities", { description: "", quantity: "1", unit: "Lot", status: "Ongoing", challenges: "None" })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#07182E] hover:bg-[#102846] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Daily Activity
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-2.5">Activity Description</th>
                      <th className="p-2.5 w-20">Qty</th>
                      <th className="p-2.5 w-20">Unit</th>
                      <th className="p-2.5 w-28">Status</th>
                      <th className="p-2.5">Challenges</th>
                      <th className="p-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(formData.technical_activities || []).map((act, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-2">
                          <input
                            type="text"
                            value={act.description}
                            onChange={(e) => updateTableRow("technical_activities", idx, "description", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={act.quantity}
                            onChange={(e) => updateTableRow("technical_activities", idx, "quantity", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={act.unit || ""}
                            onChange={(e) => updateTableRow("technical_activities", idx, "unit", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={act.status || "Ongoing"}
                            onChange={(e) => updateTableRow("technical_activities", idx, "status", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          >
                            <option value="Completed">Completed</option>
                            <option value="Ongoing">Ongoing</option>
                            <option value="Delayed">Delayed</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={act.challenges || ""}
                            onChange={(e) => updateTableRow("technical_activities", idx, "challenges", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeTableRow("technical_activities", idx)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 5 (WEEKLY): WEEKLY ACHIEVEMENTS & PERFORMANCE */}
          {currentStepKey === "weekly_achievements" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider">Weekly Physical Achievements</span>
                  <button
                    type="button"
                    onClick={() => addTableRow("weekly_achievements", { task_description: "", location_section: "", planned_qty: "0", actual_qty: "0", unit: "m3", completion_pct: "0%", variance_notes: "" })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#07182E] hover:bg-[#102846] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Achievement
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2.5">Task Description</th>
                        <th className="p-2.5">Location</th>
                        <th className="p-2.5 w-16">Plan</th>
                        <th className="p-2.5 w-16">Actual</th>
                        <th className="p-2.5 w-16">Unit</th>
                        <th className="p-2.5 w-16">%</th>
                        <th className="p-2.5">Variance Notes</th>
                        <th className="p-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(formData.weekly_achievements || []).map((ach, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={ach.task_description}
                              onChange={(e) => updateTableRow("weekly_achievements", idx, "task_description", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={ach.location_section}
                              onChange={(e) => updateTableRow("weekly_achievements", idx, "location_section", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={ach.planned_qty}
                              onChange={(e) => updateTableRow("weekly_achievements", idx, "planned_qty", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={ach.actual_qty}
                              onChange={(e) => updateTableRow("weekly_achievements", idx, "actual_qty", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={ach.unit}
                              onChange={(e) => updateTableRow("weekly_achievements", idx, "unit", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={ach.completion_pct}
                              onChange={(e) => updateTableRow("weekly_achievements", idx, "completion_pct", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={ach.variance_notes}
                              onChange={(e) => updateTableRow("weekly_achievements", idx, "variance_notes", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeTableRow("weekly_achievements", idx)}
                              className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Planned vs Actual Metrics */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider block">Planned vs Actual Progress Summary</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Weekly Planned %</label>
                    <input
                      type="text"
                      value={formData.planned_vs_actual?.planned_pct || "0%"}
                      onChange={(e) => handleFieldChange("planned_vs_actual", "planned_pct", e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Weekly Actual %</label>
                    <input
                      type="text"
                      value={formData.planned_vs_actual?.actual_pct || "0%"}
                      onChange={(e) => handleFieldChange("planned_vs_actual", "actual_pct", e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Variance %</label>
                    <input
                      type="text"
                      value={formData.planned_vs_actual?.variance_pct || "0%"}
                      onChange={(e) => handleFieldChange("planned_vs_actual", "variance_pct", e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Cum. Planned %</label>
                    <input
                      type="text"
                      value={formData.planned_vs_actual?.cumulative_planned_pct || "0%"}
                      onChange={(e) => handleFieldChange("planned_vs_actual", "cumulative_planned_pct", e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Cum. Actual %</label>
                    <input
                      type="text"
                      value={formData.planned_vs_actual?.cumulative_actual_pct || "0%"}
                      onChange={(e) => handleFieldChange("planned_vs_actual", "cumulative_actual_pct", e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 (MONTHLY): MONTHLY PROGRESS & SPI */}
          {currentStepKey === "monthly_progress" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider block">Monthly Progress & SPI Performance Indicators</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Monthly Planned %</label>
                    <input
                      type="text"
                      value={formData.monthly_progress_summary?.monthly_planned_pct || "0%"}
                      onChange={(e) => handleFieldChange("monthly_progress_summary", "monthly_planned_pct", e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Monthly Actual %</label>
                    <input
                      type="text"
                      value={formData.monthly_progress_summary?.monthly_actual_pct || "0%"}
                      onChange={(e) => handleFieldChange("monthly_progress_summary", "monthly_actual_pct", e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">SPI Index</label>
                    <input
                      type="text"
                      value={formData.monthly_progress_summary?.spi_index || "1.00"}
                      onChange={(e) => handleFieldChange("monthly_progress_summary", "spi_index", e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Cum. Planned %</label>
                    <input
                      type="text"
                      value={formData.monthly_progress_summary?.cumulative_planned_pct || "0%"}
                      onChange={(e) => handleFieldChange("monthly_progress_summary", "cumulative_planned_pct", e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Cum. Actual %</label>
                    <input
                      type="text"
                      value={formData.monthly_progress_summary?.cumulative_actual_pct || "0%"}
                      onChange={(e) => handleFieldChange("monthly_progress_summary", "cumulative_actual_pct", e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Overall Status</label>
                    <select
                      value={formData.monthly_progress_summary?.progress_status || "On Track"}
                      onChange={(e) => handleFieldChange("monthly_progress_summary", "progress_status", e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="On Track">On Track</option>
                      <option value="Ahead of Schedule">Ahead of Schedule</option>
                      <option value="Behind Schedule">Behind Schedule</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Monthly Milestones Table */}
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider">Key Monthly Deliverable Milestones</span>
                  <button
                    type="button"
                    onClick={() => addTableRow("monthly_milestones", { milestone_name: "", target_date: "", status: "Ongoing", completion_pct: "0%" })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#07182E] hover:bg-[#102846] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Milestone
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2.5">Milestone Name</th>
                        <th className="p-2.5 w-32">Target Date</th>
                        <th className="p-2.5 w-28">Status</th>
                        <th className="p-2.5 w-20">% Complete</th>
                        <th className="p-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(formData.monthly_milestones || []).map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={m.milestone_name}
                              onChange={(e) => updateTableRow("monthly_milestones", idx, "milestone_name", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="date"
                              value={m.target_date}
                              onChange={(e) => updateTableRow("monthly_milestones", idx, "target_date", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <select
                              value={m.status}
                              onChange={(e) => updateTableRow("monthly_milestones", idx, "status", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            >
                              <option value="Achieved">Achieved</option>
                              <option value="Ongoing">Ongoing</option>
                              <option value="Delayed">Delayed</option>
                            </select>
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={m.completion_pct}
                              onChange={(e) => updateTableRow("monthly_milestones", idx, "completion_pct", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeTableRow("monthly_milestones", idx)}
                              className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: SITE RESOURCES */}
          {currentStepKey === "resources" && (
            <div className="space-y-6">
              {formData.frequency === "Monthly" && (
                <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider block">Monthly Total Resource Metrics</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Total Man Hours</label>
                      <input
                        type="text"
                        value={formData.monthly_resource_summary?.total_man_hours || "0"}
                        onChange={(e) => handleFieldChange("monthly_resource_summary", "total_man_hours", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Peak Personnel</label>
                      <input
                        type="text"
                        value={formData.monthly_resource_summary?.peak_personnel || "0"}
                        onChange={(e) => handleFieldChange("monthly_resource_summary", "peak_personnel", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Total Fuel Consumed</label>
                      <input
                        type="text"
                        value={formData.monthly_resource_summary?.total_fuel_consumed || "0 Litres"}
                        onChange={(e) => handleFieldChange("monthly_resource_summary", "total_fuel_consumed", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Key Plant Deployed</label>
                      <input
                        type="text"
                        value={formData.monthly_resource_summary?.key_plant_deployed || ""}
                        onChange={(e) => handleFieldChange("monthly_resource_summary", "key_plant_deployed", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Plant On Site */}
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider">Plant & Heavy Equipment On-Site</span>
                  <button
                    type="button"
                    onClick={() => addTableRow("plant_on_site", { item: "", quantity: "1", notes: "Operational" })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#07182E] hover:bg-[#102846] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Plant
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2.5">Plant / Equipment Item</th>
                        <th className="p-2.5 w-24">Quantity</th>
                        <th className="p-2.5">Status / Notes</th>
                        <th className="p-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(formData.plant_on_site || []).map((plant, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="p-2">
                            <input
                              type="text"
                              value={plant.item}
                              onChange={(e) => updateTableRow("plant_on_site", idx, "item", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={plant.quantity}
                              onChange={(e) => updateTableRow("plant_on_site", idx, "quantity", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={plant.notes}
                              onChange={(e) => updateTableRow("plant_on_site", idx, "notes", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeTableRow("plant_on_site", idx)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fuel Used Table */}
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider">Fuel Utilization Log</span>
                  <button
                    type="button"
                    onClick={() => addTableRow("fuel_used", { plant_no: "", plant_type: "", driver: "", fuel_used: "0", start_hours: "0", stop_hours: "0", total_hours: "0", owner: formData.contractor_name })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#07182E] hover:bg-[#102846] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Fuel Record
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2">Plant No</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Driver</th>
                        <th className="p-2 w-20">Fuel (L)</th>
                        <th className="p-2 w-16">Start Hr</th>
                        <th className="p-2 w-16">Stop Hr</th>
                        <th className="p-2 w-16">Total Hr</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(formData.fuel_used || []).map((fuel, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={fuel.plant_no}
                              onChange={(e) => updateTableRow("fuel_used", idx, "plant_no", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={fuel.plant_type}
                              onChange={(e) => updateTableRow("fuel_used", idx, "plant_type", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={fuel.driver}
                              onChange={(e) => updateTableRow("fuel_used", idx, "driver", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={fuel.fuel_used}
                              onChange={(e) => updateTableRow("fuel_used", idx, "fuel_used", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={fuel.start_hours}
                              onChange={(e) => updateTableRow("fuel_used", idx, "start_hours", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={fuel.stop_hours}
                              onChange={(e) => updateTableRow("fuel_used", idx, "stop_hours", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={fuel.total_hours}
                              onChange={(e) => updateTableRow("fuel_used", idx, "total_hours", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeTableRow("fuel_used", idx)}
                              className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Personnel On Site */}
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider">Personnel Present On-Site</span>
                  <button
                    type="button"
                    onClick={() => addTableRow("personnel_on_site", { personnel: "", quantity: "1" })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#07182E] hover:bg-[#102846] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Personnel
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2.5">Personnel Role / Category</th>
                        <th className="p-2.5 w-32">Quantity</th>
                        <th className="p-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(formData.personnel_on_site || []).map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="p-2">
                            <input
                              type="text"
                              value={p.personnel}
                              onChange={(e) => updateTableRow("personnel_on_site", idx, "personnel", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={p.quantity}
                              onChange={(e) => updateTableRow("personnel_on_site", idx, "quantity", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeTableRow("personnel_on_site", idx)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 7 (MONTHLY): RISKS & DELAYS */}
          {currentStepKey === "risks_delays" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider">Major Project Risks & Delays</span>
                <button
                  type="button"
                  onClick={() => addTableRow("major_risks_and_delays", { risk_description: "", impact_level: "Medium", mitigation_action: "", owner: "Site Manager" })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#07182E] hover:bg-[#102846] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Risk/Delay
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-2.5">Risk Description</th>
                      <th className="p-2.5 w-28">Impact</th>
                      <th className="p-2.5">Mitigation Action</th>
                      <th className="p-2.5 w-32">Owner</th>
                      <th className="p-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(formData.major_risks_and_delays || []).map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={r.risk_description}
                            onChange={(e) => updateTableRow("major_risks_and_delays", idx, "risk_description", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="p-1.5">
                          <select
                            value={r.impact_level}
                            onChange={(e) => updateTableRow("major_risks_and_delays", idx, "impact_level", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={r.mitigation_action}
                            onChange={(e) => updateTableRow("major_risks_and_delays", idx, "mitigation_action", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={r.owner}
                            onChange={(e) => updateTableRow("major_risks_and_delays", idx, "owner", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeTableRow("major_risks_and_delays", idx)}
                            className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP: ENVIRONMENTAL METRICS */}
          {currentStepKey === "environmental" && (
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider block">Environmental Compliance & Monitoring Metrics</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Waste Disposed (kg)</label>
                  <input
                    type="text"
                    value={formData.environmental_metrics?.waste_disposed_kg || "0"}
                    onChange={(e) => handleFieldChange("environmental_metrics", "waste_disposed_kg", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Water Consumption (Litres)</label>
                  <input
                    type="text"
                    value={formData.environmental_metrics?.water_consumption_litres || "0"}
                    onChange={(e) => handleFieldChange("environmental_metrics", "water_consumption_litres", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Spill Incidents Count</label>
                  <input
                    type="text"
                    value={formData.environmental_metrics?.spill_incidents_count || "0"}
                    onChange={(e) => handleFieldChange("environmental_metrics", "spill_incidents_count", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Air Quality Status</label>
                  <input
                    type="text"
                    value={formData.environmental_metrics?.air_quality_status || "Compliant"}
                    onChange={(e) => handleFieldChange("environmental_metrics", "air_quality_status", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Noise Level Status</label>
                  <input
                    type="text"
                    value={formData.environmental_metrics?.noise_level_status || "Compliant"}
                    onChange={(e) => handleFieldChange("environmental_metrics", "noise_level_status", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Environmental Inspection Notes</label>
                  <textarea
                    rows={3}
                    value={formData.environmental_metrics?.environmental_notes || ""}
                    onChange={(e) => handleFieldChange("environmental_metrics", "environmental_notes", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP: OHS METRICS */}
          {currentStepKey === "ohs" && (
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider block">Occupational Health & Safety Compliance Metrics</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Safe Man Hours Worked</label>
                  <input
                    type="text"
                    value={formData.ohs_metrics?.safe_man_hours || "0"}
                    onChange={(e) => handleFieldChange("ohs_metrics", "safe_man_hours", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Near Misses Count</label>
                  <input
                    type="text"
                    value={formData.ohs_metrics?.near_misses_count || "0"}
                    onChange={(e) => handleFieldChange("ohs_metrics", "near_misses_count", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">First Aid Incidents</label>
                  <input
                    type="text"
                    value={formData.ohs_metrics?.first_aid_incidents || "0"}
                    onChange={(e) => handleFieldChange("ohs_metrics", "first_aid_incidents", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lost Time Injuries (LTI)</label>
                  <input
                    type="text"
                    value={formData.ohs_metrics?.lost_time_injuries || "0"}
                    onChange={(e) => handleFieldChange("ohs_metrics", "lost_time_injuries", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Toolbox Talk Topic</label>
                  <input
                    type="text"
                    value={formData.ohs_metrics?.toolbox_talk_topic || ""}
                    onChange={(e) => handleFieldChange("ohs_metrics", "toolbox_talk_topic", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">PPE Compliance (%)</label>
                  <input
                    type="text"
                    value={formData.ohs_metrics?.ppe_compliance_pct || "100%"}
                    onChange={(e) => handleFieldChange("ohs_metrics", "ppe_compliance_pct", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">OHS Compliance Notes</label>
                  <textarea
                    rows={3}
                    value={formData.ohs_metrics?.ohs_notes || ""}
                    onChange={(e) => handleFieldChange("ohs_metrics", "ohs_notes", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP: SITE PICTURES */}
          {currentStepKey === "site_pictures" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider block">Site Photos & Visual Evidence</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Upload photos directly into the report with captions and notes.</span>
                </div>
                <button
                  type="button"
                  onClick={() => addTableRow("site_pictures", { image: "", caption: "", notes: "" })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF9F1C] hover:bg-[#FFB020] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Picture Entry
                </button>
              </div>

              {(formData.site_pictures || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/30 text-slate-400">
                  <ImageIcon className="w-8 h-8 stroke-1 mb-2 text-slate-300 dark:text-slate-600 animate-pulse" />
                  <span className="text-xs font-bold">No picture entries added</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Click "Add Picture Entry" above to upload site images and specify captions.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(formData.site_pictures || []).map((pic, idx) => {
                    const imageUrl = signedUrls[pic.id || pic.image] || (pic.image?.startsWith("data:") || pic.image?.startsWith("blob:") || pic.image?.startsWith("http") ? pic.image : "");
                    const isUploading = uploadingIndexes[idx];

                    return (
                      <div key={pic.id || idx} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-4 shadow-xs relative group flex flex-col justify-between space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-1.5">
                            <span className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400">
                              <ImageIcon className="w-4 h-4" />
                            </span>
                            <span className="text-xs font-bold text-[#07182E] dark:text-slate-200">Photo Entry #{idx + 1}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePictureEntry(idx)}
                            className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded border border-slate-100 dark:border-slate-800 cursor-pointer transition-colors"
                            title="Delete Picture Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Image Display Box */}
                        <div className="relative aspect-video w-full rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col items-center justify-center">
                          {isUploading ? (
                            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex flex-col items-center justify-center z-10 gap-1">
                              <Loader2 className="w-5 h-5 animate-spin text-[#FF9F1C]" />
                              <span className="text-[8px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider">Uploading...</span>
                            </div>
                          ) : null}

                          {imageUrl ? (
                            <div className="relative w-full h-full group/img">
                              <img
                                src={imageUrl}
                                alt={pic.caption || "Site picture"}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <label
                                  htmlFor={`replace-file-input-${idx}`}
                                  className="px-2 py-1 bg-[#07182E] hover:bg-[#102846] text-white text-[9px] font-bold rounded-md cursor-pointer shadow transition-all flex items-center gap-1"
                                >
                                  <Upload className="w-3 h-3" /> Replace
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleClearImage(idx)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-bold rounded-md cursor-pointer shadow transition-all flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" /> Clear Image
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label
                              htmlFor={`file-input-${idx}`}
                              className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-slate-150 dark:hover:bg-slate-700/50 transition-colors p-4 text-center"
                            >
                              <Upload className="w-5 h-5 text-slate-400 mb-1" />
                              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Upload Site Picture</span>
                              <span className="text-[8px] text-slate-400 mt-0.5">Click to browse your files</span>
                            </label>
                          )}

                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, idx)}
                            className="hidden"
                            id={`file-input-${idx}`}
                          />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, idx)}
                            className="hidden"
                            id={`replace-file-input-${idx}`}
                          />
                        </div>

                        <div className="space-y-2">
                          <div>
                            <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Image Caption</label>
                            <input
                              type="text"
                              value={pic.caption}
                              onChange={(e) => updateTableRow("site_pictures", idx, "caption", e.target.value)}
                              placeholder="e.g., Concrete placement joint details"
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium outline-none focus:border-[#FF9F1C] text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Image Notes</label>
                            <input
                              type="text"
                              value={pic.notes || ""}
                              onChange={(e) => updateTableRow("site_pictures", idx, "notes", e.target.value)}
                              placeholder="e.g., Structural joint inspection passed"
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium outline-none focus:border-[#FF9F1C] text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP: NEXT PLAN & CHALLENGES */}
          {currentStepKey === "next_plan" && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider">
                    {formData.frequency === "Daily" ? "Tomorrow's Scheduled Activities" : formData.frequency === "Weekly" ? "Next Week Planned Activities" : "Next Month Outlook Activities"}
                  </span>
                  <button
                    type="button"
                    onClick={() => addTableRow("next_work_plan", { text: "" })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#07182E] hover:bg-[#102846] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Target Activity
                  </button>
                </div>

                <div className="space-y-2">
                  {(formData.next_work_plan || []).map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-[10px] font-mono text-slate-400 font-bold w-6">{idx + 1}.</span>
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => updateTableRow("next_work_plan", idx, "text", e.target.value)}
                        placeholder="Describe target scheduled activity..."
                        className="flex-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeTableRow("next_work_plan", idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded border border-slate-100 dark:border-slate-800 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-[#07182E] dark:text-slate-200 uppercase tracking-wider">Project Challenges, Constraints & Slowdowns</span>
                  <button
                    type="button"
                    onClick={() => addTableRow("challenges", { text: "" })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#07182E] hover:bg-[#102846] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Challenge
                  </button>
                </div>

                <div className="space-y-2">
                  {(formData.challenges || []).map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-[10px] font-mono text-slate-400 font-bold w-6">{idx + 1}.</span>
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => updateTableRow("challenges", idx, "text", e.target.value)}
                        placeholder="Describe constraint, slowdown or challenge..."
                        className="flex-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeTableRow("challenges", idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded border border-slate-100 dark:border-slate-800 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stepper Navigation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6 mt-8 gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={activeStep === 0}
              onClick={() => setActiveStep(prev => prev - 1)}
              className="inline-flex items-center gap-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              type="button"
              disabled={activeStep === steps.length - 1}
              onClick={() => setActiveStep(prev => prev + 1)}
              className="inline-flex items-center gap-1 px-4 py-2 bg-[#07182E] hover:bg-[#102846] text-white text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 sm:flex-initial px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onSave("Draft")}
              className="flex-1 sm:flex-initial px-4 py-2 bg-[#102846] hover:bg-[#183962] text-white text-xs font-bold rounded-xl shadow cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save as Draft
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onSave("Final")}
              className="flex-1 sm:flex-initial px-4 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white text-xs font-bold rounded-xl shadow shadow-[#FF9F1C]/20 cursor-pointer transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Sign & Lock (Final)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
