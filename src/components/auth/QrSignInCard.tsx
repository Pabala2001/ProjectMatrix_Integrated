import React from "react";
import { QrCode, ShieldCheck } from "lucide-react";
export function QrSignInCard({className = ""}: {onSuccess?: () => void; className?: string; isCompact?: boolean}) {
  return <div className={`rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center space-y-4 ${className}`}>
    <QrCode className="h-16 w-16 mx-auto text-slate-400" />
    <h3 className="font-bold text-slate-900">Sign in with your phone</h3>
    <p className="text-sm text-slate-600">QR sign-in is not available yet. Use your work email and password to continue.</p>
    <div className="flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4"/>Your account uses Supabase authentication.</div>
  </div>;
}
