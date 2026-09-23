/**
 * Reusable tenant context guard to validate company and project alignment
 * before performing database operations.
 */
export function validateTenantContext(
  selectedCompany: any,
  selectedProject: any,
  authenticatedUser: any
): void {
  if (!authenticatedUser) {
    throw new Error("Unauthorized: No authenticated user session exists.");
  }

  if (!selectedCompany) {
    throw new Error("No active company is selected. Please select a company first.");
  }

  if (!selectedProject) {
    throw new Error("No active project is selected. Please select a valid project.");
  }

  if (selectedProject.company_id !== selectedCompany.id) {
    throw new Error("The selected project does not belong to your active company. Please select a valid project.");
  }
}
