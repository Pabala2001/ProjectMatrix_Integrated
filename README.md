# ProjectMatrix — integrated frontend

This repository combines the partner **Project_Matrix** interface and expanded modules with the original **ProjectMatrix** authentication, company onboarding, billing, subscriptions and Paystack client.

This is a development build for GitHub and Google AI Studio testing. Existing connected features use the primary Supabase project. New module persistence is the next integration stage; several partner modules contain sample or browser-saved records. No Supabase changes, payments or deployment were performed while preparing this build.

## Run locally or in an AI Studio development environment

Use Node.js 22 or later. Run commands from the folder containing `package.json`.

```bash
npm ci
cp .env.example .env.local
```

Set these two values in `.env.local` or the environment used to run the app:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PRIMARY_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PRIMARY_PUBLIC_ANON_KEY
```

Use your original ProjectMatrix Supabase project to test existing account and billing behavior. Keep its Edge Function secrets and deployed billing configuration. Do not use a service-role key in the browser.

```bash
npm run dev
```

Open the URL printed by the server; the default port is 3000. Without Supabase configuration the public screens can load, but sign-in, company creation and billing cannot operate. Authentication does not simulate success.

The Express server is required for the partner programme import, weather, engineering RFI and AI endpoints. Optional server keys are described in `.env.example`. `npm run preview` previews static assets only; use the server for complete development testing.

## GitHub and Google AI Studio

1. Extract the ZIP. Put the **contents** of its `ProjectMatrix` folder at the repository root, with `package.json` at the root.
2. Keep the original repository as the source of history and use a new integration branch for review. The ZIP contains source code, not Git history.
3. Load that repository in Google AI Studio using your usual GitHub workflow. Configure the Supabase variables for the preview environment and use `npm run dev` as the development command.
4. Check the Supabase Auth redirect URLs and Paystack callback/origin configuration for the actual preview URL before live authentication or checkout testing. These settings were not changed in this integration.

Only `.env.example` is included. Keep private environment files, generated `data/`, `dist/` and `node_modules/` out of GitHub.

## Build and verify

```bash
npm run lint
npm run test:integration
npm run test:billing
npm run build
npm start
```

`lint` is the TypeScript check. `npm start` serves the production build and its Express API on port 3000 or `PORT`. Build-time `VITE_` variables must be configured before `npm run build`.

## What is included

- Partner landing, sign-in, account creation and company-details screens.
- Primary account → subscription plan → company → trial → personnel → project → assignments sequence.
- Partner workspace shell, navigation, dashboards and expanded functional modules.
- Original Billing pages: Subscriptions, Payment History and Payment Methods.
- Existing live registers retained alongside the new module layouts.
- Granular operational roles connected to verified primary company membership; original billing-role restrictions retained.
- Subscription read-only checks added around operational routes and mutations.
- Setup, source provenance, corrected project tree, backend handover and test notes under `docs/`.

Start with [docs/INTEGRATION.md](docs/INTEGRATION.md), [docs/PROJECT_TREE.md](docs/PROJECT_TREE.md), [docs/BACKEND_NEXT.md](docs/BACKEND_NEXT.md), and [docs/VALIDATION.md](docs/VALIDATION.md).
