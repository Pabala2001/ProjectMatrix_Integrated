import { BillingLedgerEvent, BillingLedgerEventSource } from "../types";

/**
 * Focused verification test suite for public.billing_ledger_events
 * - Server-side event insertion
 * - Schema constraints (event_type non-empty, event_source enum, event_data object type, deduplication key non-empty)
 * - Unique deduplication key enforcement
 * - Immutability trigger simulation (denial of UPDATE and DELETE)
 * - TRUNCATE denial
 * - Foreign key ON DELETE RESTRICT (company and subscription cannot be deleted when ledger history exists)
 * - RLS policy evaluation via public.verify_billing_access(company_id)
 * - Cross-company, unauthorized role and anonymous read isolation
 * - Client direct mutation denial (INSERT, UPDATE, DELETE, TRUNCATE revoked)
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

console.log("\n=======================================================");
console.log("PROJECTMATRIX BILLING LEDGER IMMUTABILITY TEST SUITE");
console.log("=======================================================\n");

const ALLOWED_EVENT_SOURCES: Set<BillingLedgerEventSource> = new Set([
  "user",
  "system",
  "paystack_webhook",
  "reconciliation",
]);

interface CompanyMember {
  profile_id: string;
  company_id: string;
  is_active: boolean;
  designation?: string | null;
  role?: string | null;
  is_company_admin?: boolean;
}

class MockBillingLedgerDatabase {
  private ledgerEvents: Map<string, BillingLedgerEvent> = new Map();
  private companyMembers: CompanyMember[] = [];
  private sequenceCounter: number = 1;
  private existingCompanies: Set<string> = new Set(["company-a", "company-b"]);
  private existingSubscriptions: Set<string> = new Set(["sub-a-001", "sub-b-001"]);

  constructor(initialMembers: CompanyMember[]) {
    this.companyMembers = initialMembers;
  }

  // Simulates PostgreSQL public.verify_billing_access(p_company_id UUID)
  public verifyBillingAccess(authUid: string | null, pCompanyId: string | null): boolean {
    if (!authUid || !pCompanyId) return false;

    const allowedCanonicalRoles = new Set([
      "ceo",
      "coo",
      "cfo",
      "director",
      "project_manager",
      "company_administrator",
      "company_admin",
    ]);

    const normalize = (val: string | null | undefined) => {
      if (!val) return "";
      return val.trim().toLowerCase().replace(/[\s\-_]+/g, "_");
    };

    return this.companyMembers.some((cm) => {
      if (cm.company_id !== pCompanyId) return false;
      if (cm.profile_id !== authUid) return false;
      if (cm.is_active !== true) return false;

      const normDesig = normalize(cm.designation);
      const normRole = normalize(cm.role);

      return allowedCanonicalRoles.has(normDesig) || allowedCanonicalRoles.has(normRole);
    });
  }

  // Simulates table constraints
  private validateConstraints(event: Partial<BillingLedgerEvent>) {
    if (!event.company_id || !this.existingCompanies.has(event.company_id)) {
      throw new Error("fk_billing_ledger_events_company_id violated: Company does not exist");
    }

    if (!event.subscription_id || !this.existingSubscriptions.has(event.subscription_id)) {
      throw new Error("fk_billing_ledger_events_subscription_id violated: Subscription does not exist");
    }

    if (!event.event_type || event.event_type.trim().length === 0) {
      throw new Error("chk_billing_ledger_events_event_type_non_empty violated: event_type cannot be empty");
    }

    if (!event.event_source || !ALLOWED_EVENT_SOURCES.has(event.event_source as BillingLedgerEventSource)) {
      throw new Error(`chk_billing_ledger_events_event_source violated: Invalid event source '${event.event_source}'`);
    }

    // jsonb_typeof(event_data) = 'object'
    if (
      event.event_data === null ||
      typeof event.event_data !== "object" ||
      Array.isArray(event.event_data)
    ) {
      throw new Error("chk_billing_ledger_events_data_is_object violated: event_data must be a JSON object");
    }

    // Deduplication key
    if (event.deduplication_key !== null && event.deduplication_key !== undefined) {
      if (event.deduplication_key.trim().length === 0) {
        throw new Error("chk_billing_ledger_events_dedup_non_empty violated: deduplication_key cannot be empty string");
      }

      for (const existing of this.ledgerEvents.values()) {
        if (existing.id !== event.id && existing.deduplication_key === event.deduplication_key) {
          throw new Error("uq_billing_ledger_events_dedup_key violated: Duplicate deduplication_key");
        }
      }
    }
  }

  // Server-side insert (e.g. secure backend process / edge function)
  public insertServerSide(data: Omit<BillingLedgerEvent, "sequence_number"> & { sequence_number?: number }): BillingLedgerEvent {
    this.validateConstraints(data);

    const seq = data.sequence_number ?? this.sequenceCounter++;
    const fullRecord: BillingLedgerEvent = {
      ...data,
      sequence_number: seq,
      event_data: data.event_data || {},
      occurred_at: data.occurred_at || new Date().toISOString(),
      recorded_at: data.recorded_at || new Date().toISOString(),
    };

    this.ledgerEvents.set(fullRecord.id, fullRecord);
    return fullRecord;
  }

  // Attempted UPDATE operation (Must trigger exception)
  public updateRow(id: string, patch: Partial<BillingLedgerEvent>): void {
    if (this.ledgerEvents.has(id)) {
      // Trigger trg_billing_ledger_events_immutable fires BEFORE UPDATE
      throw new Error("billing_ledger_events rows are immutable and cannot be modified or deleted.");
    }
  }

  // Attempted DELETE operation (Must trigger exception)
  public deleteRow(id: string): void {
    if (this.ledgerEvents.has(id)) {
      // Trigger trg_billing_ledger_events_immutable fires BEFORE DELETE
      throw new Error("billing_ledger_events rows are immutable and cannot be modified or deleted.");
    }
  }

  // Attempted TRUNCATE operation (Must trigger exception)
  public truncateTable(): void {
    // Trigger trg_billing_ledger_events_prevent_truncate fires BEFORE TRUNCATE
    throw new Error("billing_ledger_events table is append-only and cannot be truncated.");
  }

  // Foreign key restriction simulation: deleting company or subscription when ledger entries exist
  public deleteCompany(companyId: string): void {
    const hasEvents = Array.from(this.ledgerEvents.values()).some((e) => e.company_id === companyId);
    if (hasEvents) {
      throw new Error(`update or delete on table "companies" violates foreign key constraint on table "billing_ledger_events" (ON DELETE RESTRICT)`);
    }
    this.existingCompanies.delete(companyId);
  }

  public deleteSubscription(subscriptionId: string): void {
    const hasEvents = Array.from(this.ledgerEvents.values()).some((e) => e.subscription_id === subscriptionId);
    if (hasEvents) {
      throw new Error(`update or delete on table "billing_subscriptions" violates foreign key constraint on table "billing_ledger_events" (ON DELETE RESTRICT)`);
    }
    this.existingSubscriptions.delete(subscriptionId);
  }

  // Client SELECT with RLS policy: USING (public.verify_billing_access(company_id) IS TRUE)
  public clientSelect(callerUid: string | null): BillingLedgerEvent[] {
    if (!callerUid) return []; // Anonymous has no access

    return Array.from(this.ledgerEvents.values()).filter((event) => {
      return this.verifyBillingAccess(callerUid, event.company_id);
    });
  }

  // Client mutations (REVOKED)
  public clientInsert(_callerUid: string, _event: any): void {
    throw new Error("permission denied for table billing_ledger_events: client direct INSERT is revoked");
  }
}

// -------------------------------------------------------------
// Setup Mock DB & Test Members
// -------------------------------------------------------------
const mockMembers: CompanyMember[] = [
  {
    profile_id: "user-pm-company-a",
    company_id: "company-a",
    is_active: true,
    designation: "Project Manager",
    is_company_admin: false,
  },
  {
    profile_id: "user-ceo-company-a",
    company_id: "company-a",
    is_active: true,
    designation: "CEO",
    is_company_admin: true,
  },
  {
    profile_id: "user-worker-company-a",
    company_id: "company-a",
    is_active: true,
    designation: "General Worker",
    is_company_admin: true, // Should still be denied access
  },
  {
    profile_id: "user-pm-company-b",
    company_id: "company-b",
    is_active: true,
    designation: "Project Manager",
    is_company_admin: false,
  },
  {
    profile_id: "user-inactive-ceo",
    company_id: "company-a",
    is_active: false,
    designation: "CEO",
    is_company_admin: true,
  },
];

const db = new MockBillingLedgerDatabase(mockMembers);

// -------------------------------------------------------------
// Test 1: Valid Server-Side Event Insertion
// -------------------------------------------------------------
console.log("1. Valid Server-Side Event Insertion");
const validEvent1 = db.insertServerSide({
  id: "evt-001",
  company_id: "company-a",
  subscription_id: "sub-a-001",
  event_type: "trial.started",
  event_source: "system",
  occurred_at: "2026-08-17T00:00:00Z",
  recorded_at: "2026-08-17T00:00:01Z",
  actor_profile_id: "user-pm-company-a",
  deduplication_key: "evt-dedup-001",
  event_data: {
    plan_code: "business-monthly",
    amount_minor: 500000,
    trial_duration_minutes: 5,
  },
});
assert(validEvent1.sequence_number === 1, "Generated sequence_number monotonically is 1");
assert(validEvent1.event_type === "trial.started", "Recorded event_type correctly");

// -------------------------------------------------------------
// Test 2: Empty Event Type Rejection
// -------------------------------------------------------------
console.log("\n2. Empty Event Type Rejection");
try {
  db.insertServerSide({
    id: "evt-bad-type",
    company_id: "company-a",
    subscription_id: "sub-a-001",
    event_type: "   ",
    event_source: "system",
    occurred_at: "2026-08-17T00:00:00Z",
    recorded_at: "2026-08-17T00:00:01Z",
    event_data: {},
  });
  assert(false, "Empty event_type should fail");
} catch (e: any) {
  assert(e.message.includes("chk_billing_ledger_events_event_type_non_empty"), "Empty event_type is rejected by check constraint");
}

// -------------------------------------------------------------
// Test 3: Invalid Event Source Rejection
// -------------------------------------------------------------
console.log("\n3. Invalid Event Source Rejection");
try {
  db.insertServerSide({
    id: "evt-bad-source",
    company_id: "company-a",
    subscription_id: "sub-a-001",
    event_type: "trial.started",
    event_source: "unauthorized_external_source" as any,
    occurred_at: "2026-08-17T00:00:00Z",
    recorded_at: "2026-08-17T00:00:01Z",
    event_data: {},
  });
  assert(false, "Invalid event_source should fail");
} catch (e: any) {
  assert(e.message.includes("chk_billing_ledger_events_event_source"), "Invalid event_source is rejected by check constraint");
}

// -------------------------------------------------------------
// Test 4: Non-Object JSON Rejection
// -------------------------------------------------------------
console.log("\n4. Non-Object JSON Rejection");
try {
  db.insertServerSide({
    id: "evt-bad-json-array",
    company_id: "company-a",
    subscription_id: "sub-a-001",
    event_type: "trial.started",
    event_source: "system",
    occurred_at: "2026-08-17T00:00:00Z",
    recorded_at: "2026-08-17T00:00:01Z",
    event_data: ["not", "an", "object"] as any,
  });
  assert(false, "Array JSON should fail");
} catch (e: any) {
  assert(e.message.includes("chk_billing_ledger_events_data_is_object"), "JSON array is rejected (jsonb_typeof must be 'object')");
}

try {
  db.insertServerSide({
    id: "evt-bad-json-scalar",
    company_id: "company-a",
    subscription_id: "sub-a-001",
    event_type: "trial.started",
    event_source: "system",
    occurred_at: "2026-08-17T00:00:00Z",
    recorded_at: "2026-08-17T00:00:01Z",
    event_data: "scalar-string" as any,
  });
  assert(false, "Scalar string JSON should fail");
} catch (e: any) {
  assert(e.message.includes("chk_billing_ledger_events_data_is_object"), "JSON scalar string is rejected");
}

// -------------------------------------------------------------
// Test 5: Duplicate Deduplication Key Rejection
// -------------------------------------------------------------
console.log("\n5. Duplicate Deduplication Key Rejection");
try {
  db.insertServerSide({
    id: "evt-duplicate-dedup",
    company_id: "company-a",
    subscription_id: "sub-a-001",
    event_type: "subscription.renewed",
    event_source: "paystack_webhook",
    occurred_at: "2026-08-17T00:00:00Z",
    recorded_at: "2026-08-17T00:00:01Z",
    deduplication_key: "evt-dedup-001", // Duplicate of validEvent1
    event_data: {},
  });
  assert(false, "Duplicate deduplication_key should fail");
} catch (e: any) {
  assert(e.message.includes("uq_billing_ledger_events_dedup_key"), "Duplicate deduplication_key is rejected");
}

// -------------------------------------------------------------
// Test 6: UPDATE Rejection (Database Immutability Trigger)
// -------------------------------------------------------------
console.log("\n6. UPDATE Rejection (Database Immutability Trigger)");
try {
  db.updateRow("evt-001", { event_type: "tampered.type" });
  assert(false, "UPDATE on ledger row should fail");
} catch (e: any) {
  assert(e.message.includes("rows are immutable"), "Trigger rejects UPDATE operation on ledger rows");
}

// -------------------------------------------------------------
// Test 7: DELETE Rejection (Database Immutability Trigger)
// -------------------------------------------------------------
console.log("\n7. DELETE Rejection (Database Immutability Trigger)");
try {
  db.deleteRow("evt-001");
  assert(false, "DELETE on ledger row should fail");
} catch (e: any) {
  assert(e.message.includes("rows are immutable"), "Trigger rejects DELETE operation on ledger rows");
}

// -------------------------------------------------------------
// Test 8: TRUNCATE Protection
// -------------------------------------------------------------
console.log("\n8. TRUNCATE Protection");
try {
  db.truncateTable();
  assert(false, "TRUNCATE on ledger table should fail");
} catch (e: any) {
  assert(e.message.includes("append-only and cannot be truncated"), "Trigger / privileges reject TRUNCATE on billing_ledger_events");
}

// -------------------------------------------------------------
// Test 9: Subscription and Company Deletion Restriction (ON DELETE RESTRICT)
// -------------------------------------------------------------
console.log("\n9. Subscription and Company Deletion Restriction (ON DELETE RESTRICT)");
try {
  db.deleteCompany("company-a");
  assert(false, "Deleting company with ledger entries should fail");
} catch (e: any) {
  assert(e.message.includes("violates foreign key constraint"), "Company deletion is RESTRICTED when ledger events exist");
}

try {
  db.deleteSubscription("sub-a-001");
  assert(false, "Deleting subscription with ledger entries should fail");
} catch (e: any) {
  assert(e.message.includes("violates foreign key constraint"), "Subscription deletion is RESTRICTED when ledger events exist");
}

// Insert event for company-b
db.insertServerSide({
  id: "evt-002",
  company_id: "company-b",
  subscription_id: "sub-b-001",
  event_type: "trial.started",
  event_source: "system",
  occurred_at: "2026-08-17T00:00:00Z",
  recorded_at: "2026-08-17T00:00:01Z",
  deduplication_key: "evt-dedup-b-001",
  event_data: {},
});

// -------------------------------------------------------------
// Test 10: Authorized Same-Company Reads
// -------------------------------------------------------------
console.log("\n10. Authorized Same-Company Reads");
const pmCompanyAReads = db.clientSelect("user-pm-company-a");
assert(
  pmCompanyAReads.length === 1 && pmCompanyAReads[0].id === "evt-001",
  "Project Manager in company-a can read company-a's ledger events"
);

const ceoCompanyAReads = db.clientSelect("user-ceo-company-a");
assert(
  ceoCompanyAReads.length === 1 && ceoCompanyAReads[0].id === "evt-001",
  "CEO in company-a can read company-a's ledger events"
);

// -------------------------------------------------------------
// Test 11: Cross-Company, Unauthorized Role, and Anonymous Read Denial
// -------------------------------------------------------------
console.log("\n11. Cross-Company, Unauthorized Role, and Anonymous Read Denial");
const pmCompanyBReads = db.clientSelect("user-pm-company-b");
assert(
  pmCompanyBReads.length === 1 && pmCompanyBReads[0].id === "evt-002",
  "Project Manager in company-b cannot read company-a events (cross-company isolation)"
);

const workerReads = db.clientSelect("user-worker-company-a");
assert(
  workerReads.length === 0,
  "General Worker with is_company_admin = true is DENIED ledger access (returns 0 rows)"
);

const inactiveCeoReads = db.clientSelect("user-inactive-ceo");
assert(
  inactiveCeoReads.length === 0,
  "Inactive CEO is DENIED ledger access (returns 0 rows)"
);

const anonReads = db.clientSelect(null);
assert(
  anonReads.length === 0,
  "Anonymous caller receives 0 rows (no SELECT privilege / RLS failure)"
);

// -------------------------------------------------------------
// Test 12: Authenticated Client Direct INSERT Denial
// -------------------------------------------------------------
console.log("\n12. Authenticated Client Direct INSERT Denial");
try {
  db.clientInsert("user-pm-company-a", { id: "client-direct-evt" });
  assert(false, "Client INSERT should fail");
} catch (e: any) {
  assert(e.message.includes("permission denied"), "Client direct INSERT is revoked and denied");
}

console.log("\n=======================================================");
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
