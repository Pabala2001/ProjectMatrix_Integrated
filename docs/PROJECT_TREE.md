# Corrected project tree

The ZIP has one `ProjectMatrix/` application folder. Use its contents as the GitHub repository root.

| Path | Purpose |
| --- | --- |
| `package.json`, `package-lock.json` | One application dependency graph and supported commands |
| `index.html`, `vite.config.ts`, `tsconfig.json` | Frontend entry and build configuration |
| `metadata.json` | AI Studio project metadata |
| `.env.example` | Environment template without real credentials |
| `README.md` | Setup and testing entry point |
| `src/main.tsx` | React root and providers |
| `src/App.tsx` | Primary workspace, onboarding, billing refresh and combined routing |
| `src/components/auth/` | Partner public/account/company screens connected to primary auth |
| `src/components/layout/` | Partner navigation shell and primary entitlement banners |
| `src/components/` | Shared partner and retained primary interface components |
| `src/contexts/AuthContext.tsx` | Real Supabase session and verified workspace bridge |
| `src/context/`, `src/contexts/` | Existing regional/language/auth providers; both source directories retained where imported |
| `src/config/` | Navigation, partner roles/permissions, primary billing rules and inherited tests |
| `src/lib/`, `src/data/` | Shared clients and bundled module data |
| `src/hooks/` | Shared hooks, including the integrated permission hook |
| `src/integration/` | Integration-specific access, storage, display and verification modules |
| `src/pages/` | Combined application pages listed below |
| `src/services/` | Existing connected services and new module services/adapters |
| `src/types.ts`, `src/types/` | Combined shared and module types |
| `src/utils/` | Shared helpers and retained billing helpers |
| `public/`, `assets/` | Application assets |
| `server.ts`, `server/` | Express API and partner parsers/advisor/weather/RFI adapters |
| `supabase/migrations/` | Primary executable migration archive (53 SQL files) |
| `supabase/functions/` | Primary Edge Functions and shared authorization rules |
| `scripts/` | Supported production start and retained operational tooling |
| `docs/` | Integration design, backend handover, validation and source provenance |
| `docs/source-archive/` | Redundant migration copies, duplicate migration, source snapshots and historical diagnostics |

## Page domains

| Domain | Main page directories |
| --- | --- |
| Executive and projects | `Command`, `Dashboard`, `Actions`, `Portfolio`, `ProjectMap`, `Programme` |
| Engineering and site | `Engineering`, `Site`, `SiteDiaries`, `Surveying`, `Reports`, `Documents` |
| Commercial and resources | `Commercial`, `Accounts`, `Procurement`, `Resources`, `Logistics`, `Finance`, `BoQ` |
| Governance and workforce | `HSEQ`, `Quality`, `Governance`, `Administration`, `HumanResources`, `LabourPayroll`, `Communication`, `Security`, `InformationTechnology` |
| Intelligence | `Intelligence`, `ProjectAdvisor` (including Advisor V2) |
| Original billing | `Billing` |
| Preferences | `Settings` |

The exact packaged paths are listed in `FILE_LIST.txt`. The page domains use the existing source-directory names.

## Integration files

- `workspacePermission.ts`: checks the authenticated member and subscription before evaluating operational permissions; keeps Billing separate.
- `routePolicy.ts`: direct-route and navigation permission mapping, including specialist tabs.
- `ApplicationAccessBoundary.tsx`: installs workspace access, remounts on scope changes and displays access/draft notices.
- `operationalAccess.ts`: common mutation checks used by operational pages/services.
- `previewStorage.ts`: per-user/company browser records.
- `companyDisplay.ts`: allowlisted partner display settings that cannot override billing or identity.
- `authenticatedFetch.ts`: passes real session and selected workspace to the partner API.
- `integration.test.ts`: regression checks for these integration boundaries.

Generated folders (`node_modules/`, `dist/`, `data/`) are excluded. Install/build/run commands recreate them as needed.
