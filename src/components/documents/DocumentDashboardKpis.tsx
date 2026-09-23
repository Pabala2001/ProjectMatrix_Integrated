/**
 * Project Matrix – Compact Executive Document Management KPI Indicators
 */

import React from "react";
import {
  FileText,
  Clock,
  AlertTriangle,
  FileCheck,
  Layers,
  AlertCircle
} from "lucide-react";
import { ProjectDocument } from "../../types/documentManagement";
import { getExpiryStatus } from "./documentHierarchy";

interface DocumentDashboardKpisProps {
  documents: ProjectDocument[];
  activeFilter?: string | null;
  onSelectFilter?: (filterType: string) => void;
}

export const DocumentDashboardKpis: React.FC<DocumentDashboardKpisProps> = ({
  documents,
  activeFilter,
  onSelectFilter
}) => {
  // 1. Total Documents
  const totalCount = documents.length;

  // 2. Awaiting Approval (In Review)
  const awaitingApproval = documents.filter(d => 
    d.approval_status === "Pending Review" || 
    d.approval_status === "Pending Approval" ||
    d.status === "Internal Review" ||
    d.status === "Submitted" ||
    d.status === "PENDING_REVIEW"
  ).length;

  // 3. Expiring Documents (within 60 days or already expired)
  const expiringOrExpired = documents.filter(d => {
    if (!d.expiry_date && !(d as any).expiryDate) return false;
    const expDate = d.expiry_date || (d as any).expiryDate;
    const { status } = getExpiryStatus(expDate);
    return status === "expired" || status === "urgent" || status === "warning";
  }).length;

  // 4. Overdue / Due Correspondence Responses
  const overdueCorrespondence = documents.filter(d => {
    const isCorr = d.folder_name === "Project Correspondence" || (d as any).main_category === "Project Correspondence";
    if (!isCorr) return false;
    const respDueDate = (d as any).response_due_date || (d as any).responseDueDate;
    if (!respDueDate) return false;
    const isResponded = (d as any).response_status === "Responded" || (d as any).response_status === "Closed";
    if (isResponded) return false;
    return new Date(respDueDate).getTime() < Date.now();
  }).length;

  // 5. Drawings / Specifications
  const drawingsCount = documents.filter(d => {
    const isDrawing = d.folder_name === "Specifications" || d.subfolder_name?.includes("Drawing") || (d as any).discipline;
    return isDrawing;
  }).length;

  // 6. Permits / Licenses
  const permitsCount = documents.filter(d => {
    const isPermit = d.folder_name === "Permits & Licenses" || (d as any).main_category === "Permits & Licenses";
    return isPermit;
  }).length;

  const kpis = [
    {
      id: "all",
      label: "Total Documents",
      sublabel: "Controlled",
      value: totalCount,
      icon: FileText,
      color: "text-[#07182E] dark:text-white",
      bg: "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300",
      activeBg: "border-[#07182E] dark:border-blue-500 ring-1 ring-[#07182E]/20",
      accent: "text-slate-400"
    },
    {
      id: "awaiting_approval",
      label: "In Review",
      sublabel: "Action Req.",
      value: awaitingApproval,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
      activeBg: "border-amber-500 ring-1 ring-amber-500/20",
      accent: awaitingApproval > 0 ? "text-amber-600" : "text-slate-400"
    },
    {
      id: "expiring",
      label: "Expiring / Overdue",
      sublabel: "Guarantees & Permits",
      value: expiringOrExpired,
      icon: AlertTriangle,
      color: expiringOrExpired > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300",
      bg: expiringOrExpired > 0 ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400" : "bg-slate-50 dark:bg-slate-800/60 text-slate-500",
      activeBg: "border-rose-500 ring-1 ring-rose-500/20",
      accent: expiringOrExpired > 0 ? "text-rose-600 font-bold" : "text-slate-400"
    },
    {
      id: "correspondence",
      label: "Due Responses",
      sublabel: "Correspondence",
      value: overdueCorrespondence,
      icon: AlertCircle,
      color: overdueCorrespondence > 0 ? "text-red-600 dark:text-red-400" : "text-indigo-600 dark:text-indigo-400",
      bg: overdueCorrespondence > 0 ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400" : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
      activeBg: "border-indigo-500 ring-1 ring-indigo-500/20",
      accent: overdueCorrespondence > 0 ? "text-red-600 font-bold" : "text-slate-400"
    },
    {
      id: "drawings",
      label: "Drawings / Specifications",
      sublabel: "Engineering CAD & Specs",
      value: drawingsCount,
      icon: Layers,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400",
      activeBg: "border-teal-500 ring-1 ring-teal-500/20",
      accent: "text-teal-600"
    },
    {
      id: "permits",
      label: "Permits / Licenses",
      sublabel: "Statutory & Wayleaves",
      value: permitsCount,
      icon: FileCheck,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
      activeBg: "border-emerald-500 ring-1 ring-emerald-500/20",
      accent: "text-emerald-600"
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
      {kpis.map((kpi) => {
        const IconComponent = kpi.icon;
        const isActive = activeFilter === kpi.id;

        return (
          <div
            key={kpi.id}
            onClick={() => onSelectFilter && onSelectFilter(kpi.id)}
            className={`bg-white dark:bg-[#0B172A] px-3 py-2 sm:py-2.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between gap-2 min-w-0 ${
              isActive
                ? `${kpi.activeBg} shadow-xs`
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
            }`}
            title={`Filter by ${kpi.label}`}
          >
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                {kpi.label}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className={`text-base sm:text-lg font-black tracking-tight ${kpi.color}`}>
                  {kpi.value}
                </span>
                <span className={`text-[9px] font-semibold truncate ${kpi.accent}`}>
                  {kpi.sublabel}
                </span>
              </div>
            </div>

            <span className={`p-1.5 rounded-lg shrink-0 ${kpi.bg}`}>
              <IconComponent className="w-3.5 h-3.5" />
            </span>
          </div>
        );
      })}
    </div>
  );
};
