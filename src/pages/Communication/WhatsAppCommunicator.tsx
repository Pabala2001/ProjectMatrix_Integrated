import { previewStorage } from "../../integration/previewStorage";
import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Smartphone,
  Calendar,
  DollarSign,
  AlertTriangle,
  Users,
  Check,
  Copy,
  ExternalLink,
  Clock,
  ShieldAlert,
  Bell,
  FileSpreadsheet,
  Plus,
  Trash2,
  Filter,
  CheckCheck,
  Settings,
  RefreshCw,
  Share2,
  Zap,
  Info,
  ChevronRight,
  UserCheck,
  Building,
  User,
  CheckCircle2,
  PhoneCall
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useRegionalSettings } from "../../context/RegionalSettingsContext";

interface WhatsAppCommunicatorProps {
  activeProject: any;
  activeCompany: any;
  profile: any;
  onSaveLogToDocs?: (doc: any) => void;
}

export type AlertType = "calendar" | "budget" | "warning" | "payroll";

interface StakeholderContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  category: string;
}

interface DispatchedAlertLog {
  id: string;
  timestamp: string;
  alertType: AlertType;
  recipientName: string;
  recipientPhone: string;
  subject: string;
  message: string;
  status: "Sent" | "Scheduled" | "Delivered";
  senderName: string;
}

const DEFAULT_CONTACTS: StakeholderContact[] = [
  { id: "1", name: "Thabo Mokoena", role: "Project Director", phone: "+27821234567", category: "Management" },
  { id: "2", name: "Sipho Dlamini", role: "Site Engineer", phone: "+27839876543", category: "Technical" },
  { id: "3", name: "Johan van der Merwe", role: "Quantity Surveyor", phone: "+27714567890", category: "Commercial" },
  { id: "4", name: "Nomvula Khumalo", role: "Client Representative", phone: "+27845551234", category: "Client" },
  { id: "5", name: "Bongani Sithole", role: "Foreman / Labour Lead", phone: "+27829998877", category: "Operations" },
  { id: "6", name: "Sarah Jenkins", role: "Finance & Payroll Administrator", phone: "+27812223344", category: "Finance" }
];

const COUNTRY_CODES = [
  { code: "+27", country: "South Africa 🇿🇦" },
  { code: "+1", country: "United States 🇺🇸" },
  { code: "+44", country: "United Kingdom 🇬🇧" },
  { code: "+254", country: "Kenya 🇰🇪" },
  { code: "+263", country: "Zimbabwe 🇿🇼" },
  { code: "+267", country: "Botswana 🇧🇼" },
  { code: "+264", country: "Namibia 🇳🇦" },
  { code: "+234", country: "Nigeria 🇳🇬" },
  { code: "+61", country: "Australia 🇦🇺" },
  { code: "+971", country: "UAE 🇦🇪" }
];

export default function WhatsAppCommunicator({
  activeProject,
  activeCompany,
  profile,
  onSaveLogToDocs
}: WhatsAppCommunicatorProps) {
  const { formatCurrency, currencySymbol } = useRegionalSettings();

  // Active view tabs: "builder" | "outbox" | "rules" | "contacts"
  const [activeTab, setActiveTab] = useState<"builder" | "outbox" | "rules" | "contacts">("builder");

  // Alert Builder State
  const [selectedAlertType, setSelectedAlertType] = useState<AlertType>("calendar");
  const [recipientName, setRecipientName] = useState("Thabo Mokoena");
  const [recipientRole, setRecipientRole] = useState("Project Director");
  const [countryCode, setCountryCode] = useState("+27");
  const [phoneNumber, setPhoneNumber] = useState("821234567");

  // Custom Fields for Alert Payload
  const [alertTitle, setAlertTitle] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<"INFO" | "WARNING" | "CRITICAL">("WARNING");
  const [customNotes, setCustomNotes] = useState("");

  // Category specific variables
  // Calendar
  const [milestoneName, setMilestoneName] = useState("Foundation Pouring Phase 1");
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0]);
  const [progressPercent, setProgressPercent] = useState("75");
  const [scheduleStatus, setScheduleStatus] = useState("On Track");

  // Budget
  const [budgetCategories, setBudgetCategories] = useState("Concrete & Structural Steel");
  const [allocatedBudget, setAllocatedBudget] = useState("1250000");
  const [actualSpend, setActualSpend] = useState("1180000");
  const [budgetVarianceStatus, setBudgetVarianceStatus] = useState("Near Limit (94.4%)");

  // Warning / Risk
  const [warningId, setWarningId] = useState("EWN-2026-004");
  const [riskDescription, setRiskDescription] = useState("Unscheduled rain causing site excavation slope instability at Sector B");
  const [estimatedDelayDays, setEstimatedDelayDays] = useState("3");
  const [costImpact, setCostImpact] = useState("45000");

  // Payroll
  const [payPeriod, setPayPeriod] = useState("Week 32 (Aug 2026)");
  const [totalLabourCount, setTotalLabourCount] = useState("42");
  const [payrollAmount, setPayrollAmount] = useState("186500");
  const [payrollStatus, setPayrollStatus] = useState("Awaiting Authorization");

  // Live Compiled WhatsApp Message
  const [messageBody, setMessageBody] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Contacts List
  const [contacts, setContacts] = useState<StakeholderContact[]>(() => {
    const saved = previewStorage.getItem(`wa_contacts_${activeProject?.id || "default"}`);
    return saved ? JSON.parse(saved) : DEFAULT_CONTACTS;
  });

  // Dispatched Logs History
  const [outboxLogs, setOutboxLogs] = useState<DispatchedAlertLog[]>(() => {
    const saved = previewStorage.getItem(`wa_outbox_${activeProject?.id || "default"}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Automated Trigger Rules
  const [rules, setRules] = useState({
    budgetOverrun: true,
    budgetThreshold: 90,
    payrollFriday: true,
    milestone48h: true,
    earlyWarningInstant: true
  });

  // Save Contacts to local storage
  useEffect(() => {
    if (activeProject?.id) {
      previewStorage.setItem(`wa_contacts_${activeProject.id}`, JSON.stringify(contacts));
    }
  }, [contacts, activeProject?.id]);

  // Save Outbox Logs to local storage
  useEffect(() => {
    if (activeProject?.id) {
      previewStorage.setItem(`wa_outbox_${activeProject.id}`, JSON.stringify(outboxLogs));
    }
  }, [outboxLogs, activeProject?.id]);

  // Load Live Data from active project context
  const loadLiveDataForAlert = () => {
    const projName = activeProject?.project_name || "Active Site Project";
    if (selectedAlertType === "calendar") {
      setAlertTitle(`Milestone Progress Update: ${milestoneName}`);
    } else if (selectedAlertType === "budget") {
      setAlertTitle(`Budget Allocation Alert: ${budgetCategories}`);
    } else if (selectedAlertType === "warning") {
      setAlertTitle(`Contractual Early Warning ${warningId}`);
    } else if (selectedAlertType === "payroll") {
      setAlertTitle(`Labour Payroll Disbursement - ${payPeriod}`);
    }
  };

  // Compile message text automatically whenever parameters change
  useEffect(() => {
    const projectName = activeProject?.project_name || "Matrix Site Project";
    const dateFormatted = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
    const timeFormatted = new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });

    let compiled = "";

    if (selectedAlertType === "calendar") {
      compiled =
`📅 *PROJECT CALENDAR UPDATE*
----------------------------------
📌 *Project:* ${projectName}
👤 *Recipient:* ${recipientName} (${recipientRole})
🗓️ *Date:* ${dateFormatted} at ${timeFormatted}

🔔 *Milestone:* ${milestoneName}
📅 *Target Completion Date:* ${dueDate}
📊 *Current Progress:* ${progressPercent}%
🚦 *Schedule Status:* *${scheduleStatus}*

${alertSeverity === "CRITICAL" ? "🔴 *URGENT:* Schedule delay risk detected! Immediate site acceleration required." : alertSeverity === "WARNING" ? "🟡 *NOTICE:* Close monitoring advised to maintain critical path." : "🟢 *STATUS:* Operations progressing as planned."}

${customNotes ? `📝 *Notes & Instructions:*\n${customNotes}\n` : ""}
📲 *Dispatched via:* Matrix Construction PM Suite`;
    } else if (selectedAlertType === "budget") {
      const budgetNum = Number(allocatedBudget) || 0;
      const spendNum = Number(actualSpend) || 0;
      const varianceVal = spendNum - budgetNum;
      const variancePct = budgetNum > 0 ? ((spendNum / budgetNum) * 100).toFixed(1) : "0.0";

      compiled =
`💰 *BUDGET & VARIANCE ALERT*
----------------------------------
📌 *Project:* ${projectName}
👤 *Recipient:* ${recipientName} (${recipientRole})
🗓️ *Date:* ${dateFormatted} at ${timeFormatted}

🏷️ *Cost Category:* ${budgetCategories}
💵 *Budget Allocation:* ${formatCurrency(budgetNum)}
💸 *Actual Spend to Date:* ${formatCurrency(spendNum)}
📊 *Variance Status:* ${budgetVarianceStatus} (${variancePct}% consumed)
📈 *Net Variance:* ${varianceVal > 0 ? `+${formatCurrency(varianceVal)} (Overrun)` : `${formatCurrency(varianceVal)} (Under)`}

${alertSeverity === "CRITICAL" ? "🔴 *CRITICAL ALERT:* Budget ceiling exceeded/imminent! Approval required for variation order." : alertSeverity === "WARNING" ? "🟡 *WARNING:* Category spend exceeds 90% of allocated budget." : "🟢 *INFORMATIONAL:* Financial status updated."}

${customNotes ? `📝 *Commercial Notes:*\n${customNotes}\n` : ""}
📲 *Dispatched via:* Matrix Financial Control Centre`;
    } else if (selectedAlertType === "warning") {
      compiled =
`⚠️ *EARLY WARNING NOTICE*
----------------------------------
📌 *Project:* ${projectName}
🔢 *Notice Ref:* *${warningId}*
👤 *Recipient:* ${recipientName} (${recipientRole})
🗓️ *Date:* ${dateFormatted} at ${timeFormatted}

🚨 *Issue Description:*
_${riskDescription}_

⏱️ *Estimated Delay:* ${estimatedDelayDays} days
💰 *Estimated Cost Impact:* ${formatCurrency(Number(costImpact) || 0)}
🚦 *Severity:* *${alertSeverity}*

${alertSeverity === "CRITICAL" ? "🔴 *CONTRACTUAL REQUIREMENT:* Risk mitigation meeting requested within 24 hours under NEC/FIDIC terms." : "🟡 *ACTION REQUIRED:* Review mitigation strategy with site manager."}

${customNotes ? `📝 *Mitigation Plan / Actions:*\n${customNotes}\n` : ""}
📲 *Dispatched via:* Matrix Early Warning System`;
    } else if (selectedAlertType === "payroll") {
      compiled =
`💸 *LABOUR PAYROLL ALERT*
----------------------------------
📌 *Project:* ${projectName}
🗓️ *Pay Period:* ${payPeriod}
👤 *Recipient:* ${recipientName} (${recipientRole})
⏰ *Timestamp:* ${dateFormatted} ${timeFormatted}

👷 *Total Active Labourers:* ${totalLabourCount} Workers
💵 *Gross Payroll Amount:* ${formatCurrency(Number(payrollAmount) || 0)}
📊 *Approval Status:* *${payrollStatus}*

${alertSeverity === "CRITICAL" ? "🔴 *ACTION REQUIRED:* Payroll disbursement holds pending authorization! Verify timesheets." : "🟢 *READY:* Payroll validated and ready for payout release."}

${customNotes ? `📝 *Payroll Supervisor Notes:*\n${customNotes}\n` : ""}
📲 *Dispatched via:* Matrix Labour & Payroll Hub`;
    }

    setMessageBody(compiled);
  }, [
    selectedAlertType,
    recipientName,
    recipientRole,
    alertSeverity,
    customNotes,
    milestoneName,
    dueDate,
    progressPercent,
    scheduleStatus,
    budgetCategories,
    allocatedBudget,
    actualSpend,
    budgetVarianceStatus,
    warningId,
    riskDescription,
    estimatedDelayDays,
    costImpact,
    payPeriod,
    totalLabourCount,
    payrollAmount,
    payrollStatus,
    activeProject?.project_name,
    formatCurrency
  ]);

  // Clean raw phone number (remove spaces, leading zeros if country code present)
  const getCleanFullPhoneNumber = () => {
    let cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
    if (cleanNumber.startsWith("0")) {
      cleanNumber = cleanNumber.substring(1);
    }
    const cleanCc = countryCode.replace("+", "");
    return `${cleanCc}${cleanNumber}`;
  };

  // Open WhatsApp Web
  const handleOpenWhatsApp = () => {
    const fullPhone = getCleanFullPhoneNumber();
    const encodedText = encodeURIComponent(messageBody);
    const waUrl = `https://web.whatsapp.com/send?phone=${fullPhone}&text=${encodedText}`;
    
    // Log to Outbox
    logAlertToOutbox("Sent");
    
    window.open(waUrl, "_blank");
  };

  // Copy Message Body
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(messageBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Log Alert to History / Outbox
  const logAlertToOutbox = (statusVal: "Sent" | "Scheduled" | "Delivered" = "Sent") => {
    const newEntry: DispatchedAlertLog = {
      id: "WA-" + Date.now().toString().slice(-6),
      timestamp: new Date().toISOString(),
      alertType: selectedAlertType,
      recipientName,
      recipientPhone: `${countryCode} ${phoneNumber}`,
      subject: alertTitle || `${selectedAlertType.toUpperCase()} Alert`,
      message: messageBody,
      status: statusVal,
      senderName: profile?.full_name || "Project Administrator"
    };

    setOutboxLogs((prev) => [newEntry, ...prev]);
    setSavedSuccessMsg("Alert successfully logged to WhatsApp Outbox & Audit History!");
    setTimeout(() => setSavedSuccessMsg(null), 3500);

    // Call callback to save to Communication Documents table if available
    if (onSaveLogToDocs) {
      onSaveLogToDocs({
        title: `WhatsApp Alert: ${selectedAlertType.toUpperCase()} - ${recipientName}`,
        subject: `WhatsApp Alert (${selectedAlertType})`,
        recipient: `${recipientName} (${countryCode} ${phoneNumber})`,
        sender: profile?.full_name || "Project Manager",
        description: messageBody,
        folder_name: selectedAlertType === "warning" ? "warning" : selectedAlertType === "payroll" ? "other" : "emails",
        status: "Approved"
      });
    }
  };

  // Handle selecting stakeholder from list
  const handleSelectStakeholder = (stk: StakeholderContact) => {
    setRecipientName(stk.name);
    setRecipientRole(stk.role);
    // Parse phone
    if (stk.phone.startsWith("+27")) {
      setCountryCode("+27");
      setPhoneNumber(stk.phone.replace("+27", ""));
    } else {
      setPhoneNumber(stk.phone);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#07182E] via-[#0F2A4A] to-[#1E3A5F] rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -translate-y-20 translate-x-20" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[#FF9F1C]/10 rounded-full blur-2xl pointer-events-none translate-y-10" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">
                WhatsApp Dispatch Control Centre
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              WhatsApp Communicator
            </h1>

            <p className="text-xs md:text-sm text-slate-300 font-semibold max-w-2xl leading-relaxed">
              Instantly broadcast milestone calendar updates, budget variance notices, FIDIC early warnings, and labour payroll alerts directly to project stakeholders via formatted WhatsApp messages.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex flex-wrap items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
            <div className="text-center px-3 border-r border-white/10">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">Total Alerts</span>
              <span className="text-lg font-black text-white">{outboxLogs.length}</span>
            </div>
            <div className="text-center px-3 border-r border-white/10">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-400 block">Delivered</span>
              <span className="text-lg font-black text-emerald-400">
                {outboxLogs.filter((l) => l.status === "Sent" || l.status === "Delivered").length}
              </span>
            </div>
            <div className="text-center px-3">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#FF9F1C] block">Stakeholders</span>
              <span className="text-lg font-black text-[#FF9F1C]">{contacts.length}</span>
            </div>
          </div>
        </div>

        {/* NAVIGATION SUB-TABS */}
        <div className="flex flex-wrap items-center gap-2 mt-8 pt-4 border-t border-white/10">
          <button
            onClick={() => setActiveTab("builder")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "builder"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-white/10 hover:bg-white/20 text-slate-200"
            }`}
          >
            <Send className="w-4 h-4" />
            Alert Dispatcher
          </button>

          <button
            onClick={() => setActiveTab("outbox")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "outbox"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-white/10 hover:bg-white/20 text-slate-200"
            }`}
          >
            <Clock className="w-4 h-4" />
            Outbox & Audit Log ({outboxLogs.length})
          </button>

          <button
            onClick={() => setActiveTab("rules")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "rules"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-white/10 hover:bg-white/20 text-slate-200"
            }`}
          >
            <Zap className="w-4 h-4" />
            Automated Rules
          </button>

          <button
            onClick={() => setActiveTab("contacts")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "contacts"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-white/10 hover:bg-white/20 text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            Project Contacts ({contacts.length})
          </button>
        </div>
      </div>

      {savedSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center gap-3 animate-fade-in shadow-2xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs font-bold">{savedSuccessMsg}</p>
        </div>
      )}

      {/* VIEW 1: ALERT BUILDER & DISPATCHER */}
      {activeTab === "builder" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT COLUMN: PARAMETER CONFIGURATION (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. SELECT ALERT CATEGORY */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Step 1</span>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#07182E] flex items-center gap-1.5">
                  Select Alert Type
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* CALENDAR */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAlertType("calendar");
                    loadLiveDataForAlert();
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-28 ${
                    selectedAlertType === "calendar"
                      ? "bg-blue-50/80 border-blue-500 text-blue-900 shadow-md ring-2 ring-blue-500/20"
                      : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Calendar className={`w-6 h-6 ${selectedAlertType === "calendar" ? "text-blue-600" : "text-slate-400"}`} />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">Calendar</h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Milestones & Schedule</p>
                  </div>
                </button>

                {/* BUDGET */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAlertType("budget");
                    loadLiveDataForAlert();
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-28 ${
                    selectedAlertType === "budget"
                      ? "bg-emerald-50/80 border-emerald-500 text-emerald-900 shadow-md ring-2 ring-emerald-500/20"
                      : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <DollarSign className={`w-6 h-6 ${selectedAlertType === "budget" ? "text-emerald-600" : "text-slate-400"}`} />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">Budget</h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Cost & Variances</p>
                  </div>
                </button>

                {/* WARNING */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAlertType("warning");
                    loadLiveDataForAlert();
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-28 ${
                    selectedAlertType === "warning"
                      ? "bg-rose-50/80 border-rose-500 text-rose-900 shadow-md ring-2 ring-rose-500/20"
                      : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <AlertTriangle className={`w-6 h-6 ${selectedAlertType === "warning" ? "text-rose-600" : "text-slate-400"}`} />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">Early Warning</h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Contract Risks</p>
                  </div>
                </button>

                {/* PAYROLL */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAlertType("payroll");
                    loadLiveDataForAlert();
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-28 ${
                    selectedAlertType === "payroll"
                      ? "bg-amber-50/80 border-amber-500 text-amber-900 shadow-md ring-2 ring-amber-500/20"
                      : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <FileSpreadsheet className={`w-6 h-6 ${selectedAlertType === "payroll" ? "text-amber-600" : "text-slate-400"}`} />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">Payroll</h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Labour Payouts</p>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. RECIPIENT SELECTION */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Step 2</span>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#07182E] flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#FF9F1C]" />
                  Recipient & Contact Details
                </h3>
              </div>

              {/* Quick Select Buttons from Contacts */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Quick Select Stakeholder:
                </label>
                <div className="flex flex-wrap gap-2">
                  {contacts.map((stk) => (
                    <button
                      key={stk.id}
                      type="button"
                      onClick={() => handleSelectStakeholder(stk)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        recipientName === stk.name
                          ? "bg-[#07182E] text-white border-[#07182E] shadow-2xs"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {stk.name} ({stk.role})
                    </button>
                  ))}
                </div>
              </div>

              {/* Name, Role & Phone Number Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Recipient Full Name
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-[#FF9F1C] focus:bg-white"
                    placeholder="e.g. Thabo Mokoena"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Project Role
                  </label>
                  <input
                    type="text"
                    value={recipientRole}
                    onChange={(e) => setRecipientRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-[#FF9F1C] focus:bg-white"
                    placeholder="e.g. Site Engineer"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  WhatsApp Phone Number
                </label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-[#FF9F1C]"
                  >
                    {COUNTRY_CODES.map((cc) => (
                      <option key={cc.code} value={cc.code}>
                        {cc.code} ({cc.country})
                      </option>
                    ))}
                  </select>

                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-[#07182E] focus:outline-none focus:border-[#FF9F1C] focus:bg-white"
                    placeholder="821234567"
                  />
                </div>
              </div>
            </div>

            {/* 3. DYNAMIC ALERT PARAMETERS ACCORDING TO CATEGORY */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Step 3</span>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#07182E] flex items-center gap-1.5">
                  Configure Alert Data ({selectedAlertType.toUpperCase()})
                </h3>
              </div>

              {/* Severity Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Alert Priority / Urgency Level
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setAlertSeverity("INFO")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer border ${
                      alertSeverity === "INFO"
                        ? "bg-blue-100 border-blue-400 text-blue-900 font-extrabold"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    🟢 Informational
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertSeverity("WARNING")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer border ${
                      alertSeverity === "WARNING"
                        ? "bg-amber-100 border-amber-400 text-amber-900 font-extrabold"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    🟡 Warning
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertSeverity("CRITICAL")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer border ${
                      alertSeverity === "CRITICAL"
                        ? "bg-rose-100 border-rose-400 text-rose-900 font-extrabold"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    🔴 Critical / Urgent
                  </button>
                </div>
              </div>

              {/* A. CALENDAR PARAMETERS */}
              {selectedAlertType === "calendar" && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Milestone / WBS Activity Name
                    </label>
                    <input
                      type="text"
                      value={milestoneName}
                      onChange={(e) => setMilestoneName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Target Completion Date
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Completion Progress (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={progressPercent}
                        onChange={(e) => setProgressPercent(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Schedule Status
                      </label>
                      <select
                        value={scheduleStatus}
                        onChange={(e) => setScheduleStatus(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-blue-500"
                      >
                        <option value="On Track">On Track</option>
                        <option value="Delayed (Critical Path)">Delayed (Critical Path)</option>
                        <option value="Ahead of Schedule">Ahead of Schedule</option>
                        <option value="Awaiting Site Inspection">Awaiting Site Inspection</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* B. BUDGET PARAMETERS */}
              {selectedAlertType === "budget" && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Budget / Cost Category
                    </label>
                    <input
                      type="text"
                      value={budgetCategories}
                      onChange={(e) => setBudgetCategories(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Budget Allocation ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        value={allocatedBudget}
                        onChange={(e) => setAllocatedBudget(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Actual Spend to Date ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        value={actualSpend}
                        onChange={(e) => setActualSpend(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Variance Status
                      </label>
                      <select
                        value={budgetVarianceStatus}
                        onChange={(e) => setBudgetVarianceStatus(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Within Budget Target">Within Budget Target</option>
                        <option value="Near Limit (90%+)">Near Limit (90%+)</option>
                        <option value="Budget Ceiling Exceeded">Budget Ceiling Exceeded</option>
                        <option value="Variation Order Pending">Variation Order Pending</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* C. WARNING PARAMETERS */}
              {selectedAlertType === "warning" && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Notice Reference #
                      </label>
                      <input
                        type="text"
                        value={warningId}
                        onChange={(e) => setWarningId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Estimated Delay (Days)
                      </label>
                      <input
                        type="number"
                        value={estimatedDelayDays}
                        onChange={(e) => setEstimatedDelayDays(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Estimated Cost Impact ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        value={costImpact}
                        onChange={(e) => setCostImpact(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Risk / Hazard Description
                    </label>
                    <textarea
                      rows={2}
                      value={riskDescription}
                      onChange={(e) => setRiskDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-[#07182E] focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              )}

              {/* D. PAYROLL PARAMETERS */}
              {selectedAlertType === "payroll" && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Payroll Period / Week
                      </label>
                      <input
                        type="text"
                        value={payPeriod}
                        onChange={(e) => setPayPeriod(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Approval Status
                      </label>
                      <select
                        value={payrollStatus}
                        onChange={(e) => setPayrollStatus(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-amber-500"
                      >
                        <option value="Awaiting Authorization">Awaiting Authorization</option>
                        <option value="Approved & Disbursement Ready">Approved & Disbursement Ready</option>
                        <option value="Timesheet Discrepancy On Hold">Timesheet Discrepancy On Hold</option>
                        <option value="Paid Out Successfully">Paid Out Successfully</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Total Active Workers / Labourers
                      </label>
                      <input
                        type="number"
                        value={totalLabourCount}
                        onChange={(e) => setTotalLabourCount(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Gross Payroll Amount ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        value={payrollAmount}
                        onChange={(e) => setPayrollAmount(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#07182E] focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Custom Notes */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Additional Notes / Directives (Optional)
                </label>
                <textarea
                  rows={2}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-[#07182E] focus:outline-none focus:border-[#FF9F1C]"
                  placeholder="e.g. Please acknowledge receipt and confirm when site action is taken."
                />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: REALISTIC SMARTPHONE WHATSAPP PREVIEW & ACTIONS (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="sticky top-6">
              {/* SMARTPHONE FRAME */}
              <div className="bg-slate-900 rounded-[40px] p-4 shadow-2xl border-4 border-slate-800 relative">
                {/* Speaker Notch */}
                <div className="w-32 h-4 bg-slate-800 mx-auto rounded-b-2xl mb-2 flex items-center justify-center">
                  <div className="w-10 h-1 bg-slate-700 rounded-full" />
                </div>

                {/* WHATSAPP APP INTERFACE */}
                <div className="bg-[#E5DDD5] dark:bg-[#0B141A] rounded-[28px] overflow-hidden flex flex-col h-[520px] shadow-inner relative border border-slate-700">
                  {/* WhatsApp Top Header Bar */}
                  <div className="bg-[#075E54] text-white p-3 flex items-center justify-between shadow-md shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-extrabold flex items-center justify-center text-xs border border-emerald-400">
                        {recipientName ? recipientName.charAt(0) : "W"}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white truncate max-w-[160px]">
                          {recipientName || "Recipient"}
                        </h4>
                        <p className="text-[9px] text-emerald-200">
                          {recipientRole ? `${recipientRole} • online` : "online"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-3.5 h-3.5 text-emerald-100" />
                      <span className="text-[10px] bg-emerald-800 px-2 py-0.5 rounded-full font-mono text-emerald-200">
                        {countryCode} {phoneNumber}
                      </span>
                    </div>
                  </div>

                  {/* WhatsApp Chat Body */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] dark:bg-none">
                    <div className="text-center my-1">
                      <span className="bg-white/80 dark:bg-slate-800 text-[9px] font-bold text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-md shadow-2xs">
                        TODAY • SECURITY ENCRYPTED
                      </span>
                    </div>

                    {/* DISPATCHED CHAT BUBBLE */}
                    <div className="flex justify-end">
                      <div className="bg-[#DCF8C6] dark:bg-[#005C4B] text-slate-900 dark:text-white p-3.5 rounded-2xl rounded-tr-none shadow-md max-w-[90%] text-xs font-sans whitespace-pre-wrap leading-relaxed border border-emerald-200 dark:border-emerald-800 relative group">
                        {messageBody}

                        <div className="flex items-center justify-end gap-1 mt-2 text-[9px] text-slate-500 dark:text-emerald-200 font-mono">
                          <span>{new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</span>
                          <CheckCheck className="w-3.5 h-3.5 text-blue-500 dark:text-emerald-300 inline" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Bottom Input Bar Placeholder */}
                  <div className="bg-[#F0F0F0] dark:bg-[#1F2C34] p-2 flex items-center gap-2 border-t border-slate-300 dark:border-slate-800">
                    <div className="flex-1 bg-white dark:bg-[#2A3942] rounded-full px-3 py-1.5 text-[10px] text-slate-400">
                      Type message...
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenWhatsApp}
                      className="w-8 h-8 rounded-full bg-[#128C7E] text-white flex items-center justify-center shadow-md hover:bg-[#075E54] transition-all cursor-pointer shrink-0"
                      title="Send via WhatsApp"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ACTION DISPATCH BUTTONS */}
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="w-full py-3.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4 fill-current" />
                  Dispatch via WhatsApp Web / App
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-[#07182E] font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-500" />
                        Copy Text
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => logAlertToOutbox("Sent")}
                    className="py-2.5 px-3 bg-[#07182E] hover:bg-[#0F2A4A] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Clock className="w-4 h-4 text-[#FF9F1C]" />
                    Log to Audit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: OUTBOX & AUDIT LOG */}
      {activeTab === "outbox" && (
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#07182E] uppercase tracking-wide flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                WhatsApp Dispatch Audit Log
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Complete historical registry of all project WhatsApp alerts dispatched or recorded.
              </p>
            </div>

            <button
              onClick={() => {
                if (window.confirm("Clear WhatsApp outbox history?")) {
                  setOutboxLogs([]);
                }
              }}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer border border-rose-200 self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Log History
            </button>
          </div>

          {outboxLogs.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
              <Smartphone className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-500">No WhatsApp alerts recorded in the outbox yet.</p>
              <button
                onClick={() => setActiveTab("builder")}
                className="px-4 py-2 bg-[#FF9F1C] text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#FFB020] transition-all cursor-pointer"
              >
                Dispatch First WhatsApp Alert
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {outboxLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          log.alertType === "calendar"
                            ? "bg-blue-100 text-blue-800"
                            : log.alertType === "budget"
                            ? "bg-emerald-100 text-emerald-800"
                            : log.alertType === "warning"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {log.alertType}
                      </span>
                      <span className="text-xs font-extrabold text-[#07182E]">{log.subject}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                      <span>{new Date(log.timestamp).toLocaleString("en-ZA")}</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md text-[10px]">
                        {log.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                    {log.message}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-semibold">
                    <span>
                      Recipient: <strong className="text-[#07182E]">{log.recipientName}</strong> ({log.recipientPhone})
                    </span>
                    <span>Dispatched By: {log.senderName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: AUTOMATED RULES */}
      {activeTab === "rules" && (
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-2xs space-y-6">
          <div>
            <h3 className="text-sm font-extrabold text-[#07182E] uppercase tracking-wide flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600" />
              Automated WhatsApp Alert Triggers
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Configure automatic notification prompts for threshold overruns, weekly payroll, and milestones.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rule 1 */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-[#07182E] uppercase tracking-wide">
                    Budget Threshold Alert
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 font-semibold">
                  Trigger automated WhatsApp draft when category spend exceeds 90% of allocated budget.
                </p>
              </div>
              <input
                type="checkbox"
                checked={rules.budgetOverrun}
                onChange={(e) => setRules((r) => ({ ...r, budgetOverrun: e.target.checked }))}
                className="w-5 h-5 accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Rule 2 */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-[#07182E] uppercase tracking-wide">
                    Friday Payroll Reminder
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 font-semibold">
                  Generate weekly payroll alert every Friday at 15:00 for project director approval.
                </p>
              </div>
              <input
                type="checkbox"
                checked={rules.payrollFriday}
                onChange={(e) => setRules((r) => ({ ...r, payrollFriday: e.target.checked }))}
                className="w-5 h-5 accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Rule 3 */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold text-[#07182E] uppercase tracking-wide">
                    48h Milestone Deadline Reminder
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 font-semibold">
                  Prompt site engineers 48 hours before critical path milestone due dates.
                </p>
              </div>
              <input
                type="checkbox"
                checked={rules.milestone48h}
                onChange={(e) => setRules((r) => ({ ...r, milestone48h: e.target.checked }))}
                className="w-5 h-5 accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Rule 4 */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <h4 className="text-xs font-bold text-[#07182E] uppercase tracking-wide">
                    Instant Early Warning Alert
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 font-semibold">
                  Send immediate alert when a new FIDIC/NEC Early Warning is added to communication ledger.
                </p>
              </div>
              <input
                type="checkbox"
                checked={rules.earlyWarningInstant}
                onChange={(e) => setRules((r) => ({ ...r, earlyWarningInstant: e.target.checked }))}
                className="w-5 h-5 accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: CONTACTS DIRECTORY */}
      {activeTab === "contacts" && (
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#07182E] uppercase tracking-wide flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Project Stakeholders & Contact Directory
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Manage saved team members, sub-contractors, and client contacts for 1-click WhatsApp alerts.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((stk) => (
              <div
                key={stk.id}
                className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between"
              >
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[#07182E]">{stk.name}</h4>
                  <p className="text-[10px] text-slate-500 font-semibold">{stk.role} • {stk.category}</p>
                  <p className="text-xs font-mono text-emerald-700 font-bold">{stk.phone}</p>
                </div>

                <button
                  onClick={() => {
                    handleSelectStakeholder(stk);
                    setActiveTab("builder");
                  }}
                  className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Send className="w-3 h-3" />
                  Alert
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
