import React from "react";
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  ArrowRight, 
  ShieldAlert, 
  User, 
  Calendar,
  XCircle,
  FileCheck,
  Check
} from "lucide-react";
import { ProjectAction } from "../../types";
import { StatusBadge } from "./StatusBadge";
import { tokens } from "../../tokens";

export interface ActionCardProps {
  action: ProjectAction;
  onApprove?: (actionId: string) => void;
  onReject?: (actionId: string) => void;
  onComplete?: (actionId: string) => void;
  onViewSource?: (action: ProjectAction) => void;
  compact?: boolean;
  className?: string;
  id?: string;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  action,
  onApprove,
  onReject,
  onComplete,
  onViewSource,
  compact = false,
  className = "",
  id
}) => {
  const isPending = action.status === "PENDING" || action.status === "REQUIRES_APPROVAL";
  const isCompleted = action.status === "COMPLETED";

  const getPriorityBadge = () => {
    switch (action.priority) {
      case "CRITICAL":
        return <StatusBadge label="CRITICAL" variant="critical" size="sm" pulse />;
      case "HIGH":
        return <StatusBadge label="HIGH" variant="warning" size="sm" />;
      case "MEDIUM":
        return <StatusBadge label="MEDIUM" variant="info" size="sm" />;
      default:
        return <StatusBadge label="LOW" variant="neutral" size="sm" />;
    }
  };

  const getSourceIcon = () => {
    switch (action.source_type) {
      case "PO":
        return "💰 Purchase Order";
      case "NOTICE":
        return "📜 Contract Notice";
      case "RFI":
        return "❓ RFI";
      case "NCR":
        return "⚠️ Non-Conformance";
      case "CERTIFICATE":
        return "📑 Certificate";
      case "INTELLIGENCE":
        return "✨ Matrix Intelligence";
      default:
        return "📌 Task";
    }
  };

  return (
    <div
      id={id || `action-card-${action.id}`}
      className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs transition-all hover:shadow-md ${
        isCompleted 
          ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10 opacity-80" 
          : action.priority === "CRITICAL"
          ? "border-red-500/40 hover:border-red-500"
          : "border-slate-200 dark:border-slate-800 hover:border-slate-400"
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        
        {/* Left Info */}
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {getPriorityBadge()}
            
            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
              {getSourceIcon()}
            </span>

            {action.source_id && (
              <span className="font-mono text-[10px] font-bold text-slate-400">
                #{action.source_id}
              </span>
            )}

            {action.is_ai_recommended && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                AI Recommended
              </span>
            )}
          </div>

          <h3 className="text-sm sm:text-base font-black text-[#172033] dark:text-white tracking-tight">
            {action.title}
          </h3>

          {action.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {action.description}
            </p>
          )}

          {/* AI Rationale Box if available */}
          {action.is_ai_recommended && action.ai_rationale && (
            <div className="bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-400 text-[11px] mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                Intelligence Diagnostic Rationale
              </div>
              <p className="text-[11px] leading-relaxed">{action.ai_rationale}</p>
              {action.consequential_impact && (
                <div className="mt-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  Consequential Decision: Human authorization mandatory before ledger lock.
                </div>
              )}
            </div>
          )}

          {/* Metadata footer */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Due: <strong className="text-slate-700 dark:text-slate-200">{action.due_date}</strong></span>
            </div>

            {action.owner_name && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Owner: <strong className="text-slate-700 dark:text-slate-200">{action.owner_name}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0">
          {isPending && onApprove && (
            <button
              onClick={() => onApprove(action.id)}
              className="px-4 py-2 bg-[#0B172A] hover:bg-[#162238] dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Authorize / Approve</span>
            </button>
          )}

          {isPending && onReject && (
            <button
              onClick={() => onReject(action.id)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Reject
            </button>
          )}

          {!isCompleted && !onApprove && onComplete && (
            <button
              onClick={() => onComplete(action.id)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark Done</span>
            </button>
          )}

          {isCompleted && (
            <div className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Completed</span>
            </div>
          )}

          {onViewSource && action.source_id && (
            <button
              onClick={() => onViewSource(action)}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>View Source</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default ActionCard;
