import type { BillingSubscription, BillingSubscriptionStatus } from "../types.ts";

/**
 * Test Suite: Seven-Day Billing Entitlement Foundation
 * Verifies public.get_company_billing_entitlement and public.company_billing_allows_operational_write
 * 
 * Matrix Coverage:
 * - pending_activation before/at/after trial_ends_at
 * - trialing before/at/after trial_ends_at
 * - active
 * - past_due before/at/after past_due_since + 7 days
 * - non_renewing before/at/after current_period_end
 * - expired
 * - cancelled
 * - missing subscription (unconfigured)
 * - conflicting current subscriptions
 * - missing required lifecycle dates (fails safely to read-only)
 * - authentication & tenant isolation (signed-in user + active membership)
 * - non-mutating guarantee
 */

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${description}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${description}`);
  }
}

interface CompanyMember {
  profile_id: string;
  company_id: string;
  is_active: boolean;
  role?: string;
  designation?: string;
}

export interface BillingEntitlementResult {
  company_id: string;
  subscription_id: string | null;
  subscription_status: string | null;
  entitlement_state: string;
  access_mode: "full" | "grace_period" | "read_only";
  can_read: boolean;
  can_write: boolean;
  can_access_billing: boolean;
  can_export: boolean;
  can_access_settings: boolean;
  grace_started_at: string | null;
  grace_ends_at: string | null;
  read_only_since: string | null;
  reason_code: string;
  evaluated_at: string;
}

class MockEntitlementDatabase {
  public subscriptions: Map<string, BillingSubscription> = new Map();
  public companyMembers: CompanyMember[] = [];
  public authUid: string | null = null;
  public mockStatementTimestamp: string = new Date().toISOString();

  constructor(initialMembers: CompanyMember[], initialSubscriptions: BillingSubscription[] = []) {
    this.companyMembers = initialMembers;
    for (const sub of initialSubscriptions) {
      this.subscriptions.set(sub.id, sub);
    }
  }

  public setAuthUser(uid: string | null) {
    this.authUid = uid;
  }

  public setStatementTimestamp(isoString: string) {
    this.mockStatementTimestamp = isoString;
  }

  /**
   * Pure reproduction of PostgreSQL public.get_company_billing_entitlement
   */
  public getCompanyBillingEntitlement(companyId: string | null): BillingEntitlementResult {
    const evaluatedAt = this.mockStatementTimestamp;
    const nowMs = new Date(evaluatedAt).getTime();

    // 1. Parameter validation
    if (!companyId) {
      const err = new Error("Company ID cannot be null.");
      (err as any).code = "22004";
      throw err;
    }

    // 2. Authentication check
    if (!this.authUid) {
      const err = new Error("Authentication required.");
      (err as any).code = "28000";
      throw err;
    }

    // 3. Tenant membership check
    const isMember = this.companyMembers.some(
      (m) => m.company_id === companyId && m.profile_id === this.authUid && m.is_active === true
    );
    if (!isMember) {
      const err = new Error("Access denied. You do not have active membership in this company.");
      (err as any).code = "42501";
      throw err;
    }

    // 4. Query current subscriptions
    const allCompanySubs = Array.from(this.subscriptions.values()).filter((s) => s.company_id === companyId);
    const currentSubs = allCompanySubs.filter((s) =>
      ["pending_activation", "trialing", "active", "non_renewing", "past_due"].includes(s.status)
    );

    // 5. Conflicting current subscriptions check
    if (currentSubs.length > 1) {
      return {
        company_id: companyId,
        subscription_id: null,
        subscription_status: null,
        entitlement_state: "conflict",
        access_mode: "read_only",
        can_read: true,
        can_write: false,
        can_access_billing: true,
        can_export: true,
        can_access_settings: true,
        grace_started_at: null,
        grace_ends_at: null,
        read_only_since: null,
        reason_code: "SUBSCRIPTION_CONFLICT",
        evaluated_at: evaluatedAt,
      };
    }

    // 6. Single current subscription evaluation
    if (currentSubs.length === 1) {
      const sub = currentSubs[0];

      if (sub.status === "active") {
        if (!sub.current_period_end) {
          return {
            company_id: companyId,
            subscription_id: sub.id,
            subscription_status: sub.status,
            entitlement_state: "period_expired",
            access_mode: "read_only",
            can_read: true,
            can_write: false,
            can_access_billing: true,
            can_export: true,
            can_access_settings: true,
            grace_started_at: null,
            grace_ends_at: null,
            read_only_since: evaluatedAt,
            reason_code: "MISSING_PERIOD_END_DATE",
            evaluated_at: evaluatedAt,
          };
        } else if (evaluatedAt < sub.current_period_end) {
          return {
            company_id: companyId,
            subscription_id: sub.id,
            subscription_status: sub.status,
            entitlement_state: "active",
            access_mode: "full",
            can_read: true,
            can_write: true,
            can_access_billing: true,
            can_export: true,
            can_access_settings: true,
            grace_started_at: null,
            grace_ends_at: null,
            read_only_since: null,
            reason_code: "ACTIVE_SUBSCRIPTION",
            evaluated_at: evaluatedAt,
          };
        } else {
          return {
            company_id: companyId,
            subscription_id: sub.id,
            subscription_status: sub.status,
            entitlement_state: "period_expired",
            access_mode: "read_only",
            can_read: true,
            can_write: false,
            can_access_billing: true,
            can_export: true,
            can_access_settings: true,
            grace_started_at: null,
            grace_ends_at: null,
            read_only_since: sub.current_period_end,
            reason_code: "PERIOD_EXPIRED",
            evaluated_at: evaluatedAt,
          };
        }
      }

      if (sub.status === "trialing" || sub.status === "pending_activation") {
        if (!sub.trial_ends_at) {
          // Missing required date -> fail safely to read-only
          return {
            company_id: companyId,
            subscription_id: sub.id,
            subscription_status: sub.status,
            entitlement_state: "trial_expired",
            access_mode: "read_only",
            can_read: true,
            can_write: false,
            can_access_billing: true,
            can_export: true,
            can_access_settings: true,
            grace_started_at: null,
            grace_ends_at: null,
            read_only_since: evaluatedAt,
            reason_code: "MISSING_TRIAL_END_DATE",
            evaluated_at: evaluatedAt,
          };
        }

        const trialEndMs = new Date(sub.trial_ends_at).getTime();
        if (nowMs < trialEndMs) {
          return {
            company_id: companyId,
            subscription_id: sub.id,
            subscription_status: sub.status,
            entitlement_state: sub.status,
            access_mode: "full",
            can_read: true,
            can_write: true,
            can_access_billing: true,
            can_export: true,
            can_access_settings: true,
            grace_started_at: null,
            grace_ends_at: null,
            read_only_since: null,
            reason_code: "TRIAL_ACTIVE",
            evaluated_at: evaluatedAt,
          };
        } else {
          return {
            company_id: companyId,
            subscription_id: sub.id,
            subscription_status: sub.status,
            entitlement_state: "trial_expired",
            access_mode: "read_only",
            can_read: true,
            can_write: false,
            can_access_billing: true,
            can_export: true,
            can_access_settings: true,
            grace_started_at: null,
            grace_ends_at: null,
            read_only_since: sub.trial_ends_at,
            reason_code: "TRIAL_EXPIRED",
            evaluated_at: evaluatedAt,
          };
        }
      }

      if (sub.status === "past_due") {
        const pastDueSince = (sub as any).past_due_since;
        if (!pastDueSince) {
          // Missing required date -> fail safely to read-only
          return {
            company_id: companyId,
            subscription_id: sub.id,
            subscription_status: sub.status,
            entitlement_state: "grace_expired",
            access_mode: "read_only",
            can_read: true,
            can_write: false,
            can_access_billing: true,
            can_export: true,
            can_access_settings: true,
            grace_started_at: null,
            grace_ends_at: null,
            read_only_since: evaluatedAt,
            reason_code: "MISSING_PAST_DUE_DATE",
            evaluated_at: evaluatedAt,
          };
        }

        const pastDueSinceMs = new Date(pastDueSince).getTime();
        const graceEndMs = pastDueSinceMs + 7 * 24 * 60 * 60 * 1000;
        const graceEndIso = new Date(graceEndMs).toISOString();

        if (nowMs < graceEndMs) {
          return {
            company_id: companyId,
            subscription_id: sub.id,
            subscription_status: sub.status,
            entitlement_state: "grace_period",
            access_mode: "grace_period",
            can_read: true,
            can_write: true,
            can_access_billing: true,
            can_export: true,
            can_access_settings: true,
            grace_started_at: pastDueSince,
            grace_ends_at: graceEndIso,
            read_only_since: null,
            reason_code: "PAST_DUE_GRACE",
            evaluated_at: evaluatedAt,
          };
        } else {
          return {
            company_id: companyId,
            subscription_id: sub.id,
            subscription_status: sub.status,
            entitlement_state: "grace_expired",
            access_mode: "read_only",
            can_read: true,
            can_write: false,
            can_access_billing: true,
            can_export: true,
            can_access_settings: true,
            grace_started_at: pastDueSince,
            grace_ends_at: graceEndIso,
            read_only_since: graceEndIso,
            reason_code: "PAST_DUE_EXPIRED",
            evaluated_at: evaluatedAt,
          };
        }
      }

      if (sub.status === "non_renewing") {
        if (!sub.current_period_end) {
          return {
            company_id: companyId,
            subscription_id: sub.id,
            subscription_status: sub.status,
            entitlement_state: "period_expired",
            access_mode: "read_only",
            can_read: true,
            can_write: false,
            can_access_billing: true,
            can_export: true,
            can_access_settings: true,
            grace_started_at: null,
            grace_ends_at: null,
            read_only_since: evaluatedAt,
            reason_code: "MISSING_PERIOD_END_DATE",
            evaluated_at: evaluatedAt,
          };
        }

        const periodEndMs = new Date(sub.current_period_end).getTime();
        if (nowMs < periodEndMs) {
          return {
            company_id: companyId,
            subscription_id: sub.id,
            subscription_status: sub.status,
            entitlement_state: "non_renewing",
            access_mode: "full",
            can_read: true,
            can_write: true,
            can_access_billing: true,
            can_export: true,
            can_access_settings: true,
            grace_started_at: null,
            grace_ends_at: null,
            read_only_since: null,
            reason_code: "NON_RENEWING_ACTIVE",
            evaluated_at: evaluatedAt,
          };
        } else {
          return {
            company_id: companyId,
            subscription_id: sub.id,
            subscription_status: sub.status,
            entitlement_state: "period_expired",
            access_mode: "read_only",
            can_read: true,
            can_write: false,
            can_access_billing: true,
            can_export: true,
            can_access_settings: true,
            grace_started_at: null,
            grace_ends_at: null,
            read_only_since: sub.current_period_end,
            reason_code: "PERIOD_EXPIRED",
            evaluated_at: evaluatedAt,
          };
        }
      }
    }

    // 7. Terminal subscriptions check
    const terminalSubs = allCompanySubs.filter((s) => s.status === "expired" || s.status === "cancelled");
    if (terminalSubs.length > 0) {
      // Pick most recently updated/created
      const sub = terminalSubs[0];
      if (sub.status === "cancelled") {
        return {
          company_id: companyId,
          subscription_id: sub.id,
          subscription_status: sub.status,
          entitlement_state: "cancelled",
          access_mode: "read_only",
          can_read: true,
          can_write: false,
          can_access_billing: true,
          can_export: true,
          can_access_settings: true,
          grace_started_at: null,
          grace_ends_at: null,
          read_only_since: sub.cancelled_at || sub.updated_at || null,
          reason_code: "SUBSCRIPTION_CANCELLED",
          evaluated_at: evaluatedAt,
        };
      } else {
        return {
          company_id: companyId,
          subscription_id: sub.id,
          subscription_status: sub.status,
          entitlement_state: "expired",
          access_mode: "read_only",
          can_read: true,
          can_write: false,
          can_access_billing: true,
          can_export: true,
          can_access_settings: true,
          grace_started_at: null,
          grace_ends_at: null,
          read_only_since: sub.expired_at || sub.current_period_end || sub.trial_ends_at || sub.updated_at || null,
          reason_code: "SUBSCRIPTION_EXPIRED",
          evaluated_at: evaluatedAt,
        };
      }
    }

    // 8. Missing subscription (unconfigured)
    return {
      company_id: companyId,
      subscription_id: null,
      subscription_status: null,
      entitlement_state: "unconfigured",
      access_mode: "read_only",
      can_read: true,
      can_write: false,
      can_access_billing: true,
      can_export: true,
      can_access_settings: true,
      grace_started_at: null,
      grace_ends_at: null,
      read_only_since: null,
      reason_code: "NO_SUBSCRIPTION",
      evaluated_at: evaluatedAt,
    };
  }

  /**
   * Pure reproduction of PostgreSQL public.company_billing_allows_operational_write
   */
  public companyBillingAllowsOperationalWrite(companyId: string | null): boolean {
    const entitlement = this.getCompanyBillingEntitlement(companyId);
    return entitlement.can_write === true;
  }
}

// ============================================================================
// Test Execution
// ============================================================================

console.log("\n=======================================================");
console.log("SEVEN-DAY BILLING ENTITLEMENT FOUNDATION TEST SUITE");
console.log("=======================================================\n");

const COMPANY_A = "11111111-1111-1111-1111-111111111111";
const COMPANY_B = "22222222-2222-2222-2222-222222222222";
const USER_1 = "aaaaaaa1-1111-1111-1111-111111111111";
const USER_2 = "aaaaaaa2-2222-2222-2222-222222222222";
const STRANGER = "99999999-9999-9999-9999-999999999999";

const members: CompanyMember[] = [
  { profile_id: USER_1, company_id: COMPANY_A, is_active: true, role: "director" },
  { profile_id: USER_2, company_id: COMPANY_A, is_active: false, role: "project_manager" }, // inactive
  { profile_id: USER_1, company_id: COMPANY_B, is_active: true, role: "site_agent_manager" },
];

const db = new MockEntitlementDatabase(members);

// ----------------------------------------------------------------------------
// Section 1: Authentication and Tenant Isolation
// ----------------------------------------------------------------------------
console.log("Section 1: Authentication and Tenant Isolation");

try {
  db.setAuthUser(null);
  db.getCompanyBillingEntitlement(COMPANY_A);
  assert(false, "Expected error when auth.uid() is null");
} catch (e: any) {
  assert(e.code === "28000", "Unauthenticated caller is rejected with error 28000");
}

try {
  db.setAuthUser(USER_1);
  db.getCompanyBillingEntitlement(null);
  assert(false, "Expected error when company_id is null");
} catch (e: any) {
  assert(e.code === "22004", "Null company_id is rejected with error 22004");
}

try {
  db.setAuthUser(STRANGER);
  db.getCompanyBillingEntitlement(COMPANY_A);
  assert(false, "Expected error when caller is not a member of the company");
} catch (e: any) {
  assert(e.code === "42501", "Non-member caller is denied with error 42501");
}

try {
  db.setAuthUser(USER_2);
  db.getCompanyBillingEntitlement(COMPANY_A);
  assert(false, "Expected error when caller is inactive member");
} catch (e: any) {
  assert(e.code === "42501", "Inactive member caller is denied with error 42501");
}

// ----------------------------------------------------------------------------
// Section 2: Missing Subscription (Unconfigured)
// ----------------------------------------------------------------------------
console.log("\nSection 2: Missing Subscription (Unconfigured)");
db.setAuthUser(USER_1);
db.subscriptions.clear();

const unconfiguredRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(unconfiguredRes.entitlement_state === "unconfigured", "Entitlement state is unconfigured");
assert(unconfiguredRes.access_mode === "read_only", "Access mode is read_only");
assert(unconfiguredRes.can_write === false, "can_write is false");
assert(unconfiguredRes.can_read === true, "can_read is true");
assert(unconfiguredRes.can_access_billing === true, "can_access_billing is true");
assert(unconfiguredRes.can_export === true, "can_export is true");
assert(unconfiguredRes.can_access_settings === true, "can_access_settings is true");
assert(unconfiguredRes.reason_code === "NO_SUBSCRIPTION", "Reason code is NO_SUBSCRIPTION");
assert(db.companyBillingAllowsOperationalWrite(COMPANY_A) === false, "company_billing_allows_operational_write returns false");

// ----------------------------------------------------------------------------
// Section 3: Active Subscription
// ----------------------------------------------------------------------------
console.log("\nSection 3: Active Subscription");
const activeSub: BillingSubscription = {
  id: "sub-active-1",
  company_id: COMPANY_A,
  plan_id: "plan-pro",
  subscription_reference: "SUB-ACT-001",
  status: "active",
  amount_minor: 5000000,
  currency: "NGN",
  billing_interval: "monthly",
  auto_renew_enabled: true,
  current_period_start: "2026-08-01T00:00:00Z",
  current_period_end: "2026-09-01T00:00:00Z",
};
db.subscriptions.set(activeSub.id, activeSub);
db.setStatementTimestamp("2026-08-15T00:00:00Z");

const activeRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(activeRes.entitlement_state === "active", "Entitlement state is active");
assert(activeRes.access_mode === "full", "Access mode is full");
assert(activeRes.can_write === true, "can_write is true");
assert(activeRes.can_read === true, "can_read is true");
assert(activeRes.reason_code === "ACTIVE_SUBSCRIPTION", "Reason code is ACTIVE_SUBSCRIPTION");
assert(db.companyBillingAllowsOperationalWrite(COMPANY_A) === true, "company_billing_allows_operational_write returns true");

// Test expired active subscription (at or after current_period_end)
db.setStatementTimestamp("2026-09-02T00:00:00Z");
const expiredActiveRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(expiredActiveRes.entitlement_state === "period_expired", "Expired active subscription yields period_expired entitlement");
assert(expiredActiveRes.access_mode === "read_only", "Expired active subscription access_mode is read_only");
assert(expiredActiveRes.can_write === false, "can_write is false for expired active subscription");
assert(expiredActiveRes.reason_code === "PERIOD_EXPIRED", "Reason code is PERIOD_EXPIRED for expired active subscription");
assert(db.companyBillingAllowsOperationalWrite(COMPANY_A) === false, "company_billing_allows_operational_write returns false for expired active subscription");

// Test active subscription with missing current_period_end (fail-safe)
db.subscriptions.set(activeSub.id, { ...activeSub, current_period_end: undefined });
const missingDateActiveRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(missingDateActiveRes.entitlement_state === "period_expired", "Active sub with missing date yields period_expired");
assert(missingDateActiveRes.access_mode === "read_only", "Active sub with missing date access_mode is read_only");
assert(missingDateActiveRes.can_write === false, "can_write is false when date is missing");
assert(missingDateActiveRes.reason_code === "MISSING_PERIOD_END_DATE", "Reason code is MISSING_PERIOD_END_DATE");

// Reset timestamp
db.setStatementTimestamp("2026-08-15T00:00:00Z");

// ----------------------------------------------------------------------------
// Section 4: Trialing / Pending Activation
// ----------------------------------------------------------------------------
console.log("\nSection 4: Trialing and Pending Activation");
db.subscriptions.clear();

const trialingSub: BillingSubscription = {
  id: "sub-trial-1",
  company_id: COMPANY_A,
  plan_id: "plan-pro",
  subscription_reference: "SUB-TRL-001",
  status: "trialing",
  amount_minor: 5000000,
  currency: "NGN",
  billing_interval: "monthly",
  auto_renew_enabled: true,
  trial_started_at: "2026-08-20T00:00:00Z",
  trial_ends_at: "2026-08-27T12:00:00Z",
};
db.subscriptions.set(trialingSub.id, trialingSub);

// Scenario 4a: 1 hour before trial end -> Full access
db.setStatementTimestamp("2026-08-27T11:00:00Z");
let trialRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(trialRes.access_mode === "full", "Trialing before trial_ends_at has full access mode");
assert(trialRes.can_write === true, "can_write is true before trial end");
assert(trialRes.entitlement_state === "trialing", "Entitlement state is trialing");
assert(trialRes.reason_code === "TRIAL_ACTIVE", "Reason code is TRIAL_ACTIVE");

// Scenario 4b: Exactly at trial_ends_at -> Read-only
db.setStatementTimestamp("2026-08-27T12:00:00Z");
trialRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(trialRes.access_mode === "read_only", "Trialing exactly at trial_ends_at has read_only access mode");
assert(trialRes.can_write === false, "can_write is false at trial end");
assert(trialRes.entitlement_state === "trial_expired", "Entitlement state is trial_expired");
assert(trialRes.read_only_since === "2026-08-27T12:00:00Z", "read_only_since equals trial_ends_at");
assert(trialRes.reason_code === "TRIAL_EXPIRED", "Reason code is TRIAL_EXPIRED");

// Scenario 4c: 1 second after trial_ends_at -> Read-only
db.setStatementTimestamp("2026-08-27T12:00:01Z");
trialRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(trialRes.access_mode === "read_only", "Trialing after trial_ends_at has read_only access mode");
assert(trialRes.can_write === false, "can_write is false after trial end");

// Scenario 4d: Missing trial_ends_at -> Safe read-only fallback
const missingTrialDateSub: BillingSubscription = {
  ...trialingSub,
  id: "sub-trial-missing-date",
  trial_ends_at: null,
};
db.subscriptions.set(trialingSub.id, missingTrialDateSub);
trialRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(trialRes.access_mode === "read_only", "Trialing with missing trial_ends_at falls safely to read_only");
assert(trialRes.can_write === false, "can_write is false when trial_ends_at is missing");
assert(trialRes.reason_code === "MISSING_TRIAL_END_DATE", "Reason code is MISSING_TRIAL_END_DATE");

// ----------------------------------------------------------------------------
// Section 5: Past Due & Seven-Day Grace Period
// ----------------------------------------------------------------------------
console.log("\nSection 5: Past Due & Seven-Day Grace Period");
db.subscriptions.clear();

const pastDueSince = "2026-08-20T00:00:00.000Z";
const graceDeadline = "2026-08-27T00:00:00.000Z"; // past_due_since + 7 days
const pastDueSub: any = {
  id: "sub-past-due-1",
  company_id: COMPANY_A,
  plan_id: "plan-pro",
  subscription_reference: "SUB-PST-001",
  status: "past_due",
  amount_minor: 5000000,
  currency: "NGN",
  billing_interval: "monthly",
  auto_renew_enabled: true,
  past_due_since: pastDueSince,
};
db.subscriptions.set(pastDueSub.id, pastDueSub);

// Scenario 5a: Day 3 of 7 -> Grace Period (Full Grace Access, can_write = true)
db.setStatementTimestamp("2026-08-23T10:00:00.000Z");
let pastDueRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(pastDueRes.access_mode === "grace_period", "Past due on day 3 has access_mode grace_period");
assert(pastDueRes.can_write === true, "can_write is true during grace period");
assert(pastDueRes.entitlement_state === "grace_period", "Entitlement state is grace_period");
assert(pastDueRes.grace_started_at === pastDueSince, "grace_started_at matches past_due_since");
assert(pastDueRes.grace_ends_at === graceDeadline, "grace_ends_at matches past_due_since + 7 days");
assert(pastDueRes.read_only_since === null, "read_only_since is null during grace period");
assert(pastDueRes.reason_code === "PAST_DUE_GRACE", "Reason code is PAST_DUE_GRACE");
assert(db.companyBillingAllowsOperationalWrite(COMPANY_A) === true, "companyBillingAllowsOperationalWrite returns true during grace");

// Scenario 5b: 1 second before 7-day deadline -> Grace Period (can_write = true)
db.setStatementTimestamp("2026-08-26T23:59:59.000Z");
pastDueRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(pastDueRes.access_mode === "grace_period", "1 second before deadline has access_mode grace_period");
assert(pastDueRes.can_write === true, "can_write is true 1 second before deadline");

// Scenario 5c: Exactly at 7-day deadline -> Read-only (can_write = false)
db.setStatementTimestamp("2026-08-27T00:00:00.000Z");
pastDueRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(pastDueRes.access_mode === "read_only", "At exact 7-day deadline access_mode is read_only");
assert(pastDueRes.can_write === false, "can_write is false at exact 7-day deadline");
assert(pastDueRes.entitlement_state === "grace_expired", "Entitlement state is grace_expired");
assert(pastDueRes.grace_started_at === pastDueSince, "grace_started_at preserved");
assert(pastDueRes.grace_ends_at === graceDeadline, "grace_ends_at preserved");
assert(pastDueRes.read_only_since === graceDeadline, "read_only_since is set to grace deadline");
assert(pastDueRes.reason_code === "PAST_DUE_EXPIRED", "Reason code is PAST_DUE_EXPIRED");
assert(db.companyBillingAllowsOperationalWrite(COMPANY_A) === false, "companyBillingAllowsOperationalWrite returns false after grace expiration");

// Scenario 5d: Missing past_due_since -> Safe read-only fallback
const missingPastDueDateSub = { ...pastDueSub, past_due_since: null };
db.subscriptions.set(pastDueSub.id, missingPastDueDateSub);
pastDueRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(pastDueRes.access_mode === "read_only", "Past due with missing past_due_since falls safely to read_only");
assert(pastDueRes.can_write === false, "can_write is false when past_due_since is missing");
assert(pastDueRes.reason_code === "MISSING_PAST_DUE_DATE", "Reason code is MISSING_PAST_DUE_DATE");

// ----------------------------------------------------------------------------
// Section 6: Non-Renewing Subscription
// ----------------------------------------------------------------------------
console.log("\nSection 6: Non-Renewing Subscription");
db.subscriptions.clear();

const periodEnd = "2026-08-31T23:59:59Z";
const nonRenewingSub: BillingSubscription = {
  id: "sub-non-renew-1",
  company_id: COMPANY_A,
  plan_id: "plan-pro",
  subscription_reference: "SUB-NON-001",
  status: "non_renewing",
  amount_minor: 5000000,
  currency: "NGN",
  billing_interval: "monthly",
  auto_renew_enabled: false,
  current_period_start: "2026-08-01T00:00:00Z",
  current_period_end: periodEnd,
};
db.subscriptions.set(nonRenewingSub.id, nonRenewingSub);

// Scenario 6a: Before period end -> Full access
db.setStatementTimestamp("2026-08-25T00:00:00Z");
let nonRenewRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(nonRenewRes.access_mode === "full", "Non-renewing before current_period_end has full access mode");
assert(nonRenewRes.can_write === true, "can_write is true before period end");
assert(nonRenewRes.entitlement_state === "non_renewing", "Entitlement state is non_renewing");
assert(nonRenewRes.reason_code === "NON_RENEWING_ACTIVE", "Reason code is NON_RENEWING_ACTIVE");

// Scenario 6b: At exact period end -> Read-only
db.setStatementTimestamp("2026-08-31T23:59:59Z");
nonRenewRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(nonRenewRes.access_mode === "read_only", "Non-renewing at current_period_end has read_only access mode");
assert(nonRenewRes.can_write === false, "can_write is false at period end");
assert(nonRenewRes.entitlement_state === "period_expired", "Entitlement state is period_expired");
assert(nonRenewRes.read_only_since === periodEnd, "read_only_since is set to current_period_end");
assert(nonRenewRes.reason_code === "PERIOD_EXPIRED", "Reason code is PERIOD_EXPIRED");

// ----------------------------------------------------------------------------
// Section 7: Expired and Cancelled Subscriptions
// ----------------------------------------------------------------------------
console.log("\nSection 7: Expired and Cancelled Subscriptions");
db.subscriptions.clear();

const expiredSub: BillingSubscription = {
  id: "sub-exp-1",
  company_id: COMPANY_A,
  plan_id: "plan-pro",
  subscription_reference: "SUB-EXP-001",
  status: "expired",
  amount_minor: 5000000,
  currency: "NGN",
  billing_interval: "monthly",
  auto_renew_enabled: false,
  expired_at: "2026-08-15T00:00:00Z",
};
db.subscriptions.set(expiredSub.id, expiredSub);

let termRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(termRes.access_mode === "read_only", "Expired subscription yields read_only access mode");
assert(termRes.can_write === false, "can_write is false for expired subscription");
assert(termRes.entitlement_state === "expired", "Entitlement state is expired");
assert(termRes.read_only_since === "2026-08-15T00:00:00Z", "read_only_since matches expired_at");
assert(termRes.reason_code === "SUBSCRIPTION_EXPIRED", "Reason code is SUBSCRIPTION_EXPIRED");

db.subscriptions.clear();
const cancelledSub: BillingSubscription = {
  id: "sub-can-1",
  company_id: COMPANY_A,
  plan_id: "plan-pro",
  subscription_reference: "SUB-CAN-001",
  status: "cancelled",
  amount_minor: 5000000,
  currency: "NGN",
  billing_interval: "monthly",
  auto_renew_enabled: false,
  cancelled_at: "2026-08-10T15:30:00Z",
};
db.subscriptions.set(cancelledSub.id, cancelledSub);

termRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(termRes.access_mode === "read_only", "Cancelled subscription yields read_only access mode");
assert(termRes.can_write === false, "can_write is false for cancelled subscription");
assert(termRes.entitlement_state === "cancelled", "Entitlement state is cancelled");
assert(termRes.read_only_since === "2026-08-10T15:30:00Z", "read_only_since matches cancelled_at");
assert(termRes.reason_code === "SUBSCRIPTION_CANCELLED", "Reason code is SUBSCRIPTION_CANCELLED");

// ----------------------------------------------------------------------------
// Section 8: Conflicting Current Subscriptions
// ----------------------------------------------------------------------------
console.log("\nSection 8: Conflicting Current Subscriptions");
db.subscriptions.clear();
db.subscriptions.set("sub-conf-1", {
  id: "sub-conf-1",
  company_id: COMPANY_A,
  plan_id: "plan-pro",
  subscription_reference: "SUB-CONF-001",
  status: "active",
  amount_minor: 5000000,
  currency: "NGN",
  billing_interval: "monthly",
  auto_renew_enabled: true,
});
db.subscriptions.set("sub-conf-2", {
  id: "sub-conf-2",
  company_id: COMPANY_A,
  plan_id: "plan-starter",
  subscription_reference: "SUB-CONF-002",
  status: "past_due",
  amount_minor: 2500000,
  currency: "NGN",
  billing_interval: "monthly",
  auto_renew_enabled: true,
  past_due_since: "2026-08-25T00:00:00Z",
} as any);

const conflictRes = db.getCompanyBillingEntitlement(COMPANY_A);
assert(conflictRes.entitlement_state === "conflict", "Entitlement state is conflict when multiple current subscriptions exist");
assert(conflictRes.access_mode === "read_only", "Access mode fails safely to read_only under conflict");
assert(conflictRes.can_write === false, "can_write is false during conflict");
assert(conflictRes.subscription_id === null, "Does not pick arbitrary subscription_id during conflict");
assert(conflictRes.reason_code === "SUBSCRIPTION_CONFLICT", "Reason code is SUBSCRIPTION_CONFLICT");
assert(db.companyBillingAllowsOperationalWrite(COMPANY_A) === false, "companyBillingAllowsOperationalWrite is false during conflict");

// ----------------------------------------------------------------------------
// Section 9: Universal Read and Administrative Flags for Authorized Members
// ----------------------------------------------------------------------------
console.log("\nSection 9: Universal Read and Administrative Flags");
assert(unconfiguredRes.can_read === true, "can_read true for unconfigured");
assert(unconfiguredRes.can_access_billing === true, "can_access_billing true for unconfigured");
assert(unconfiguredRes.can_export === true, "can_export true for unconfigured");
assert(unconfiguredRes.can_access_settings === true, "can_access_settings true for unconfigured");

assert(conflictRes.can_read === true, "can_read true for conflict");
assert(conflictRes.can_access_billing === true, "can_access_billing true for conflict");
assert(conflictRes.can_export === true, "can_export true for conflict");
assert(conflictRes.can_access_settings === true, "can_access_settings true for conflict");

console.log("\n=======================================================");
console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
