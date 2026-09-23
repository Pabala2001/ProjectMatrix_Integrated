# Backend handover

This package implements the frontend combination. No database migrations, Auth settings, Edge Functions, Paystack settings or remote repository writes were applied.

## Existing project prerequisites

Use the primary ProjectMatrix Supabase environment for testing existing features. Confirm that its deployed functions include `create-company-member`, `finalize-onboarding`, `paystack-checkout`, `paystack-webhook`, `paystack-manage-subscription`, and the advisor functions that you use.

The existing frontend calls `get_billing_overview`, `get_company_billing_entitlement`, `start_billing_trial`, and the existing checkout/subscription RPCs. The supplied archives reference `get_billing_overview` but do not include its SQL definition. The archives alone therefore cannot be certified as a complete clean-database bootstrap. Retrieve the missing deployed schema/function definitions before attempting to recreate the database. Do not apply every bundled migration blindly to the existing project.

Frontend environment keys are public project configuration. Paystack, AI-provider and service-role secrets remain on the server or in Supabase Edge Function secrets. The partner Express endpoints use the signed-in user's token; they do not require a browser service-role key.

## Next implementation sequence

1. Inventory the primary deployed schema and RPC signatures against the bundled SQL; establish a staging copy with test billing configuration.
2. Define tables and storage buckets for the new commercial workspace, engineering controls, resource registers, HSEQ/site records, contracts/risks and HR modules. Keep company and project IDs tied to existing primary entities.
3. Mirror the expanded operational roles in database policies and server-side authorization. Preserve the separate original Billing role contract. Connect custom-role, delegated-limit and approval changes to authorized backend actions.
4. Extend the company profile schema for partner operating settings and departments. Migrate browser display drafts deliberately; do not treat them as verified access or billing information.
5. Replace new module browser stores and the RFI JSON store with shared persistence and attachments. Decide which sample records should be removed. Do not automatically import samples into production.
6. Implement invitation delivery, token validation/expiry and account-to-membership linking. Add QR authentication or MFA only through a real authentication flow.
7. Complete end-to-end staging checks: account confirmation, onboarding retries, company switching, permission restrictions, expired trial, Paystack checkout return, webhook confirmation, renewal preferences and recovery.

## Current limits

- The partner UI includes prototype/sample values and partially implemented modules. The integration preserves those screens with draft notices; it does not establish missing production persistence.
- New company display settings and new operational records may be saved only in the current user's browser.
- Some inherited pages use local caches or error fallbacks. The connected data services preserved from the primary repository remain authoritative for their existing records.
- The server RFI store is a local file. Use Supabase for durable shared data before multi-instance deployment.
- Supabase and Paystack configuration must match the actual development/preview origin. Live checkout was not performed.
- All expanded role combinations and live backend policies still need staging acceptance tests; the included integration tests cover representative permission boundaries.
