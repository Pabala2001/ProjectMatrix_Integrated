# Source provenance

This is a source integration, not a Git history merge. Original input archives were left unchanged.

| Source | Archive | SHA-256 |
| --- | --- | --- |
| Primary | `ProjectMatrix-main(1).zip` | `4c361744b97322c71ab6bf40b94516ee3125365cff8a92a7b3bd7242dd44f2df` |
| Partner | `Project_Matrix-main.zip` | `7283b34506a83298cd1975eea590731eaa79681dc0820f4c4e2074f193d7e55b` |

All partner `src/pages/**/*.tsx` paths are present in the integrated source.

The primary Billing pages, billing service, Paystack client and billing UI helpers compare byte-for-byte with the source archive. The billing role contract is retained; `accessControl.ts` adds only compatibility exports for the partner role API.

Backend files were carried forward from the primary archive. A duplicate migration and redundant source copies are preserved under `source-archive` for reference; no database deployment was made.

Historical diagnostics were moved out of the repository root. Fixed Supabase URL/public-key defaults in diagnostic/backfill scripts were removed; those scripts now require explicit environment configuration.
