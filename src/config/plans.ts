/**
 * Centralized Shared Subscription Plan Configuration & Preview Helpers
 * 
 * Defines marketing descriptions and benefit metadata for the Business Subscription Plan.
 * Commercial fields (amount, currency, interval, trial_duration_minutes) are loaded at runtime
 * from public.billing_plans via getActiveBillingPlan().
 */

export interface PlanBenefit {
  title: string;
  description: string;
}

export interface SharedPlanConfig {
  code: "business-monthly";
  id: string; // compatibility alias
  name: string;
  badge: string;
  rateLabel: string;
  cancelAnytime: boolean;
  monthlyAutoRenewalSupported: boolean;
  billingTerms: string;
  renewalNotice: string;
  description: string;
  benefits: PlanBenefit[];
}

export const SHARED_BUSINESS_PLAN: SharedPlanConfig = {
  code: "business-monthly",
  id: "business-monthly",
  name: "Business Subscription Plan",
  badge: "Step 1 of 5",
  rateLabel: "BUSINESS PACKAGE RATE",
  cancelAnytime: true,
  monthlyAutoRenewalSupported: true,
  billingTerms: "Billed monthly • Cancel anytime",
  renewalNotice: "Renews monthly on the scheduled billing date unless auto-renewal is disabled",
  description: "Run your construction business from one connected workspace, from company oversight and procurement to site reporting, documents and project delivery.",
  benefits: [
    {
      title: "Unlimited Projects",
      description: "Manage multiple active and completed projects without per-project charges."
    },
    {
      title: "Unlimited Team Members",
      description: "Add company personnel and project participants without per-user license fees."
    },
    {
      title: "AI Project Advisor Included",
      description: "Ask questions about project information and generate contextual document drafts."
    },
    {
      title: "Command Centre",
      description: "Monitor company operations, project progress, priorities, risks and required actions."
    },
    {
      title: "Role-Based Access Control",
      description: "Control which companies, projects and modules each team member can access."
    },
    {
      title: "Centralised Project Records",
      description: "Keep documents, communications and operational records organised in one system."
    }
  ]
};

// Aliases for backwards compatibility
export const ONBOARDING_BUSINESS_PLAN = SHARED_BUSINESS_PLAN;
export type OnboardingPlanBenefit = PlanBenefit;
export type OnboardingPlanConfig = SharedPlanConfig;

// ==============================================================================
// Pending Onboarding Selection Store (Session Storage)
// ==============================================================================

const STORAGE_KEY_PENDING = "pm_pending_onboarding_plan";

/**
 * Format a Date or ISO string into "DD MMM YYYY" (e.g. "14 Aug 2026")
 */
export function formatDateDisplay(input: Date | string | number): string {
  try {
    const d = typeof input === "string" || typeof input === "number" ? new Date(input) : input;
    if (isNaN(d.getTime())) return "14 Aug 2026";
    const day = d.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return "14 Aug 2026";
  }
}

/**
 * Sets the pending plan code selected in Step 1 of onboarding.
 */
export function setPendingOnboardingSelection(planCode: string = "business-monthly"): void {
  try {
    const payload = {
      planCode,
      selectedAt: new Date().toISOString()
    };
    sessionStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(payload));
  } catch (err) {
    console.warn("Could not set pending onboarding selection:", err);
  }
}

/**
 * Gets the pending onboarding selection from Step 1.
 */
export function getPendingOnboardingSelection(): { planCode: string; selectedAt: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_PENDING);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clears the pending onboarding selection.
 */
export function clearPendingOnboardingSelection(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY_PENDING);
  } catch {
    // ignore
  }
}

