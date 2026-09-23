import { usePermissions } from "./usePermissions";

/**
 * usePermission alias for direct singular hook imports
 */
export function usePermission(options?: Parameters<typeof usePermissions>[0]) {
  return usePermissions(options);
}

export default usePermission;
