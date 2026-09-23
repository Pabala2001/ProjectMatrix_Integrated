import React from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { Lock, Building } from "lucide-react";

export interface ProjectAccessGuardProps {
  projectId: string;
  projectName?: string;
  fallback?: React.ReactNode;
  showFallbackScreen?: boolean;
  children: React.ReactNode;
}

export function ProjectAccessGuard({
  projectId,
  projectName,
  fallback,
  showFallbackScreen = true,
  children
}: ProjectAccessGuardProps) {
  const { canAccessProject, userRole, requestAccess } = usePermissions();

  const isAllowed = canAccessProject(projectId);

  if (isAllowed) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  if (!showFallbackScreen) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-900/50 border border-slate-800 rounded-2xl text-center max-w-md mx-auto my-12 shadow-xl">
      <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
        <Building className="w-6 h-6" />
      </div>

      <h3 className="text-lg font-bold text-white tracking-tight">Project Assignment Required</h3>
      <p className="text-xs text-slate-400 mt-2 max-w-sm">
        Your user account ({userRole}) is not assigned to project <strong>{projectName || projectId}</strong>.
        Please contact your Project Manager or Company Administrator to be added to the project delivery team.
      </p>

      <div className="mt-4 text-[11px] font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">
        Project ID: <span className="text-amber-400 font-semibold">{projectId}</span>
      </div>
    </div>
  );
}

export default ProjectAccessGuard;
