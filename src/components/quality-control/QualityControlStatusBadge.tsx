import React from "react";
import { CheckCircle2, XCircle, FileEdit, ClipboardCheck } from "lucide-react";
import { FormStatus } from "../../types/qualityControl";

interface QualityControlStatusBadgeProps {
  status: FormStatus;
}

export default function QualityControlStatusBadge({ status }: QualityControlStatusBadgeProps) {
  let styles = "";
  let label = status;
  let icon = null;

  switch (status) {
    case "Draft":
      styles = "bg-slate-100 text-slate-700 border-slate-200";
      icon = <FileEdit className="w-3.5 h-3.5 text-slate-500" />;
      break;
    case "Completed":
      styles = "bg-blue-50 text-blue-700 border-blue-100";
      icon = <ClipboardCheck className="w-3.5 h-3.5 text-blue-500" />;
      break;
    case "Approved":
      styles = "bg-emerald-50 text-emerald-700 border-emerald-100";
      icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      break;
    case "Rejected":
      styles = "bg-rose-50 text-rose-700 border-rose-100";
      icon = <XCircle className="w-3.5 h-3.5 text-rose-500" />;
      break;
  }

  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border w-fit shadow-xs uppercase tracking-wider ${styles}`}>
      {icon}
      {label}
    </span>
  );
}
