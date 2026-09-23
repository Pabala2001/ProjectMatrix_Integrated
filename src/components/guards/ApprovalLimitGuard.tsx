import React from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { ShieldAlert, ArrowUpRight } from "lucide-react";

export interface ApprovalLimitGuardProps {
  permission: string;
  amount: number;
  currency?: string;
  creatorId?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ApprovalLimitGuard({
  permission,
  amount,
  currency = "USD",
  creatorId,
  fallback,
  children
}: ApprovalLimitGuardProps) {
  const { checkPermission, userRole } = usePermissions();

  const evalResult = checkPermission(permission, { amount, currency, creatorId });

  if (evalResult.granted) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-3 my-2 shadow-sm">
      <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
      <div className="space-y-1">
        <div className="font-bold text-amber-200">Approval Escalation Required</div>
        <div className="text-amber-300/80 leading-relaxed">
          {evalResult.reason}
        </div>
        <div className="text-[10px] text-amber-400/60 font-mono mt-1">
          Amount: {amount.toLocaleString()} {currency} • Segregation of Duties: Enforced
        </div>
      </div>
    </div>
  );
}

export default ApprovalLimitGuard;
