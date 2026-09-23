import React from "react";
import { usePermissions } from "../../hooks/usePermissions";

export interface RoleGuardProps {
  roles: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGuard({ roles, fallback, children }: RoleGuardProps) {
  const { hasAnyRole } = usePermissions();

  if (hasAnyRole(roles)) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return null;
}

export default RoleGuard;
