import { REGION_CONFIGS } from "../config/countries";

// Extra partner fields remain a per-user company draft until the schema is extended.
// Identity, membership and billing fields are deliberately excluded.
const displayFields = ["trading_name", "country", "organisation_type", "industry", "tax_number",
  "is_vat_registered", "business_licence_number", "contractor_registration_number",
  "engineering_registration_number", "website", "registered_address", "corporate_address",
  "default_currency", "financial_year_start", "timezone", "date_format", "measurement_system",
  "primary_language", "contract_frameworks", "departments", "logo_url", "postal_address", "countryCode", "currency"];
function key(userId: string,companyId: string) { return `pm_company_display:${userId}:${companyId}`; }
export function saveCompanyDisplay(userId: string,companyId: string,details: Record<string,unknown>) {
  if (!userId || !companyId) return;
  const safe = Object.fromEntries(displayFields.filter(field => field in details).map(field=>[field,details[field]]));
  let previous: Record<string,unknown> = {};
  try { previous = JSON.parse(localStorage.getItem(key(userId,companyId)) || "{}"); } catch { /* Replace invalid draft. */ }
  localStorage.setItem(key(userId,companyId),JSON.stringify({...previous,...safe}));
}
export function withCompanyDisplay<T extends {id:string}>(company: T,userId: string): T & Record<string,any> {
  try {
    const raw = JSON.parse(localStorage.getItem(key(userId,company.id)) || "{}");
    const safe = Object.fromEntries(displayFields.filter(field => field in raw).map(field=>[field,raw[field]]));
    const region = Object.values(REGION_CONFIGS).find(item => item.countryName === safe.country);
    return {...safe,countryCode:safe.countryCode || region?.countryCode,currency:safe.currency || safe.default_currency,...company};
  } catch { return company; }
}
