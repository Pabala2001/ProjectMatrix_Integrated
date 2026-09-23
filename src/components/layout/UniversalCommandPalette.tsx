import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  FileText,
  Truck,
  Users,
  Building2,
  FileSpreadsheet,
  AlertTriangle,
  HelpCircle,
  Command,
  ArrowRight,
  X,
  Sparkles,
  ClipboardList,
  DollarSign,
  FolderOpen,
  Calculator,
  Calendar
} from "lucide-react";

interface UniversalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject?: any;
  activeCompany?: any;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Commands" | "Certificates & Financials" | "Site Records & Materials" | "Personnel & Subcontractors" | "RFIs & Notices" | "Equipment & Plant" | "Drawings & Documents";
  icon: React.ElementType;
  path: string;
  badge?: string;
  badgeColor?: string;
}

export default function UniversalCommandPalette({
  isOpen,
  onClose,
  activeProject,
  activeCompany
}: UniversalCommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard shortcut escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Master list of quick commands and searchable index items
  const allItems: CommandItem[] = [
    // Quick Commands
    {
      id: "cmd-rfi",
      title: "+ New RFI",
      subtitle: "Draft a Request for Information document",
      category: "Commands",
      icon: Plus,
      path: "/communication?folder=rfi&action=new",
      badge: "Action",
      badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20"
    },
    {
      id: "cmd-diary",
      title: "+ Site Diary",
      subtitle: "Log daily weather, labour, plant & site operations",
      category: "Commands",
      icon: ClipboardList,
      path: "/site-diaries?action=new",
      badge: "Action",
      badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
    },
    {
      id: "cmd-po",
      title: "+ Purchase Request",
      subtitle: "Raise material requisition or supplier order",
      category: "Commands",
      icon: Truck,
      path: "/procurement?action=new",
      badge: "Action",
      badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20"
    },
    {
      id: "cmd-ncr",
      title: "+ Non-Conformance Report (NCR)",
      subtitle: "Log structural quality defect or non-compliance",
      category: "Commands",
      icon: AlertTriangle,
      path: "/quality-control?action=new",
      badge: "Action",
      badgeColor: "bg-red-500/10 text-red-600 border-red-500/20"
    },
    {
      id: "cmd-cert",
      title: "+ Payment Certificate",
      subtitle: "Generate interim payment valuation or IPC",
      category: "Commands",
      icon: DollarSign,
      path: "/accounts?action=new-cert",
      badge: "Action",
      badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20"
    },
    {
      id: "cmd-advisor",
      title: "Ask Project Advisor",
      subtitle: "Multi-engine intelligence for programme delays & cost forecasts",
      category: "Commands",
      icon: Sparkles,
      path: "/project-advisor",
      badge: "AI Assistant",
      badgeColor: "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-[#FF9F1C] border-amber-500/30"
    },
    {
      id: "cmd-programme",
      title: "Programme of Works",
      subtitle: "Construction schedules, critical path sequence, & baseline variance",
      category: "Commands",
      icon: Calendar,
      path: "/programme",
      badge: "Technical",
      badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20"
    },
    {
      id: "cmd-boq",
      title: "Bill of Quantities (BoQ)",
      subtitle: "Four-tier unit rate build-up & real-time financial loss detection",
      category: "Commands",
      icon: Calculator,
      path: "/boq",
      badge: "Technical",
      badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20"
    },

    // Financials & Payment Certificates
    {
      id: "fin-cert04",
      title: "Payment Certificate 04",
      subtitle: "Valuation #04 • R14,250,000 Certified • Approved",
      category: "Certificates & Financials",
      icon: DollarSign,
      path: "/accounts?cert=04",
      badge: "Certified",
      badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
    },
    {
      id: "fin-cert05",
      title: "Payment Certificate 05",
      subtitle: "Valuation #05 • R18,400,000 • Pending Client Approval",
      category: "Certificates & Financials",
      icon: DollarSign,
      path: "/accounts?cert=05",
      badge: "Overdue",
      badgeColor: "bg-red-500/10 text-red-600 border-red-500/20"
    },

    // Site Records & Materials
    {
      id: "rec-concrete",
      title: "Tunduma Concrete Pouring Log",
      subtitle: "CH 0+400 to 0+850 • Grade 30/20 Concrete Pour",
      category: "Site Records & Materials",
      icon: ClipboardList,
      path: "/site-diaries?tag=concrete",
      badge: "Site Log",
      badgeColor: "bg-slate-500/10 text-slate-600 border-slate-500/20"
    },
    {
      id: "rec-cement",
      title: "Cement Stock PO-00491",
      subtitle: "PPC 42.5N • 500 Bags • Critical Level Alert",
      category: "Site Records & Materials",
      icon: Truck,
      path: "/procurement?po=PO-00491",
      badge: "Stock Alert",
      badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20"
    },
    {
      id: "rec-diary-aug11",
      title: "Site Diary - 11 August 2026",
      subtitle: "Earthworks Shift 1 • 42 Personnel Onsite • Weather: Clear",
      category: "Site Records & Materials",
      icon: ClipboardList,
      path: "/site-diaries?date=2026-08-11",
      badge: "Daily Log",
      badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20"
    },

    // Personnel & Subcontractors
    {
      id: "per-mokoena",
      title: "John Mokoena",
      subtitle: "Senior Site Agent • BuildCorp Concrete Works Division",
      category: "Personnel & Subcontractors",
      icon: Users,
      path: "/payroll?search=Mokoena",
      badge: "Subcontractor Lead",
      badgeColor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
    },
    {
      id: "per-nkosi",
      title: "Sipho Nkosi",
      subtitle: "General Earthworks Foreman • Direct Payroll",
      category: "Personnel & Subcontractors",
      icon: Users,
      path: "/payroll?search=Nkosi",
      badge: "Site Supervisor",
      badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
    },

    // RFIs & Notices
    {
      id: "rfi-034",
      title: "RFI 034 - Foundation Reinforcement Clarification",
      subtitle: "Culvert Section C2 • Outstanding 12 Days",
      category: "RFIs & Notices",
      icon: FileText,
      path: "/communication?folder=rfi&doc=RFI-034",
      badge: "Overdue RFI",
      badgeColor: "bg-red-500/10 text-red-600 border-red-500/20"
    },
    {
      id: "notice-ewn01",
      title: "Early Warning Notice EWN-014",
      subtitle: "NEC3 Clause 16 • Cement Supply Shortage Risk",
      category: "RFIs & Notices",
      icon: AlertTriangle,
      path: "/communication?folder=early_warnings&doc=EWN-014",
      badge: "Contract Notice",
      badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20"
    },

    // Equipment & Plant
    {
      id: "eq-cat320",
      title: "Excavator CAT320",
      subtitle: "Plant ID: EX-004 • Active at CH 0+600 • 84% Availability",
      category: "Equipment & Plant",
      icon: Truck,
      path: "/inventory?item=CAT320",
      badge: "Plant Asset",
      badgeColor: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
    },

    // Drawings & Documents
    {
      id: "drg-4512",
      title: "Drawing 4512 Rev C",
      subtitle: "Box Culvert Structural Details • Section C2",
      category: "Drawings & Documents",
      icon: FolderOpen,
      path: "/communication?folder=drawings&doc=4512",
      badge: "Approved Drawing",
      badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20"
    },
    {
      id: "drg-c2",
      title: "Drawing C2-DRG-014 Rev 3",
      subtitle: "Bridge Alignment & Abutment Reinforcement",
      category: "Drawings & Documents",
      icon: FolderOpen,
      path: "/communication?folder=drawings&doc=C2-DRG-014",
      badge: "Revision 3",
      badgeColor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
    }
  ];

  // Filter items based on query
  const filteredItems = allItems.filter(item => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const handleSelect = (item: CommandItem) => {
    onClose();
    navigate(item.path);
  };

  const handleKeyDownInput = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Top Search Header */}
        <div className="p-4 border-b border-slate-100 dark:border-[#1E3A5F] flex items-center gap-3 bg-slate-50/50 dark:bg-[#0B2545]/50">
          <Search className="w-5 h-5 text-[#FF9F1C] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDownInput}
            placeholder="Search ProjectMatrix... (e.g. Certificate 04, Tunduma, John Mokoena, RFI 034, CAT320)"
            className="w-full bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none text-sm font-medium"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Command & Search Results */}
        <div className="overflow-y-auto p-2 space-y-2 flex-1">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No matching records found</p>
              <p className="text-[11px] text-slate-500">Try searching for payment certificates, RFIs, drawings, personnel, or commands like "+ New RFI"</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const IconComp = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all border ${
                    isSelected
                      ? "bg-[#07182E] dark:bg-[#102846] text-white border-[#FF9F1C]/40 shadow-sm"
                      : "bg-transparent text-slate-800 dark:text-slate-200 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isSelected
                        ? "bg-[#FF9F1C]/20 text-[#FF9F1C]"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold truncate ${isSelected ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className={`text-[11px] truncate ${isSelected ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-semibold uppercase ${isSelected ? "text-[#FF9F1C]" : "text-slate-400"}`}>
                      {item.category}
                    </span>
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? "text-[#FF9F1C]" : "text-slate-300 dark:text-slate-600"}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="p-3 border-t border-slate-100 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#07182E] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">↵</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">ESC</kbd> Close</span>
          </div>
          <span className="text-[#FF9F1C] font-bold">ProjectMatrix Universal Command</span>
        </div>
      </div>
    </div>
  );
}
