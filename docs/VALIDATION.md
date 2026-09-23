# Validation record

Prepared 23 September 2026.

## Completed in the integration workspace

- Dependency installation and an updated npm lockfile.
- TypeScript compilation through `npm run lint`.
- Production frontend and Express build through `npm run build`.
- Integration tests through `npm run test:integration` (14 passing cases): verified membership, original Billing role rules, subscription restrictions, company/project isolation, route permissions, display-draft boundaries and real preview-service writes.
- Focused primary billing regression suites through `npm run test:billing`: billing access, entitlement refresh, frontend billing service, Paystack checkout handler, and expired-subscription recovery in PGlite. These use local mocks/an in-process database, not live payment calls.
- Production Express startup through `npm start` succeeded. No live API calls were made during this startup check.
- Comparison against the original archive confirmed unchanged Billing page files, billing service, Paystack client and billing UI helpers.

The build reports a large frontend bundle warning. Route-level code splitting is a useful later performance improvement; this warning does not prevent the build.

## Not verified

Automated browser preview was blocked by automatic approval review because its usage limit prevented review from completing. No alternative browser path was used. Visual layout, responsive behavior, live browser interactions, live Supabase access and Paystack callbacks remain unverified. A successful build does not prove those behaviors.

The broader collection of inherited backend tests is retained, but only the focused suites listed above were run for this integration. This package is a frontend integration candidate for testing, not a production certification.

## First manual acceptance pass

Use a staging/test environment for changes and payments.

1. Open landing, sign-in and sign-up on desktop and a narrow screen.
2. Create and confirm an account as required by your Supabase Auth settings. Confirm the next screen is the original plan selection.
3. Complete partner company details. Check that the trial starts via the original RPC before continuing to personnel/project setup. Refresh during a retry to check the same company resumes.
4. Sign in as an existing company member. Confirm the partner menu, company/project selectors and existing records load.
5. Open every visible domain and its tabs. Add/edit a draft in the intended workspace, then switch companies/projects and verify it is isolated.
6. Check an administrator, project manager, finance user and ordinary employee. Confirm operational permissions and separate Billing restrictions.
7. Test expired/read-only entitlement: reading and permitted billing recovery should remain available while record changes are blocked.
8. In Paystack test mode, verify checkout return, webhook confirmation, payment history, auto-renew choices and recovery before considering live billing.
9. Confirm new-module draft notices and disabled QR/invitation redemption accurately identify backend work still required.
