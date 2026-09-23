import { createClient } from "@supabase/supabase-js";
import { PAYSTACK_REQUEST_TIMEOUT_MS, getCorsHeaders, isOriginAllowed, isPlainObject, isValidUuid,
  readJsonResponseWithLimit, readRequestBodyWithLimit, validateServerConfig } from "../paystack-checkout/core.ts";

export function isPaystackManagementUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096 || /[\s\x00-\x1f\x7f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.origin === "https://paystack.com" && url.pathname.startsWith("/manage/subscriptions/") &&
      url.pathname.length > "/manage/subscriptions/".length &&
      !url.username && !url.password && !url.hash;
  } catch { return false; }
}

export async function handleManageSubscription(request: Request, dependencies: {
  env?: Record<string, string | undefined>;
  createClient?: typeof createClient;
  fetch?: typeof fetch;
} = {}): Promise<Response> {
  const env = dependencies.env ?? Object.fromEntries([
    "PAYSTACK_ENVIRONMENT", "PAYSTACK_SECRET_KEY", "PAYSTACK_CALLBACK_URL", "PAYSTACK_ALLOWED_ORIGINS",
    "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  ].map(name => [name, Deno.env.get(name)]));
  const configResult = validateServerConfig(env);
  if ("error" in configResult) return Response.json({ ok: false, error: "Subscription management is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const config = configResult.data;
  const headers = { ...getCorsHeaders(request.headers.get("origin"), config.allowedOrigins), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  const reply = (error: string, status: number) => Response.json({ ok: false, error }, { status, headers });
  if (!isOriginAllowed(request.headers.get("origin"), config.allowedOrigins)) return reply("Origin not permitted.", 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed." }, { status: 405, headers: { ...headers, Allow: "POST, OPTIONS" } });
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [^\s]{1,8192}$/i.test(authorization)) return reply("Sign in to manage billing.", 401);
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return reply("Content-Type must be application/json.", 415);
  }
  const raw = await readRequestBodyWithLimit(request);
  if ("error" in raw) return reply(raw.error, raw.status);
  let body: unknown;
  try { body = JSON.parse(raw.data); } catch { return reply("Invalid request.", 400); }
  if (!isPlainObject(body) || Object.keys(body).some(key => key !== "company_id" && key !== "action") || !isValidUuid(body.company_id) ||
      (body.action !== undefined && body.action !== "card")) return reply("Company ID is required.", 400);
  const companyId = body.company_id;
  const clientFactory = dependencies.createClient ?? createClient;
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  try {
    const userClient = clientFactory(config.supabaseUrl, config.supabaseAnonKey, {
      ...options, global: { headers: { Authorization: authorization } },
    });
    const user = await userClient.auth.getUser(authorization.slice(7));
    if (user.error || !user.data.user) return reply("Your session has expired. Sign in again.", 401);
    const access = await userClient.rpc("verify_billing_access", { p_company_id: companyId });
    if (access.error || access.data !== true) return reply("Billing access denied.", 403);
    const service = clientFactory(config.supabaseUrl, config.supabaseServiceRoleKey, options);
    const record = await service.rpc("get_provider_subscription_for_reconciliation", { p_company_id: companyId });
    if (record.error) return reply("The billing record could not be retrieved. Please retry.", 503);
    const row = Array.isArray(record.data) && record.data.length === 1 ? record.data[0] : null;
    if (!isPlainObject(row) || row.company_id !== companyId || row.provider !== "paystack" ||
        row.environment !== config.paystackEnvironment || row.is_current !== true || row.disabled_at !== null ||
        typeof row.provider_subscription_code !== "string" || !/^SUB_[A-Za-z0-9]+$/.test(row.provider_subscription_code)) {
      return reply("There is no current recurring subscription to manage in this payment environment.", 409);
    }
    // Verify current provider state before opening management. Recover a missed
    // cancellation through a dedicated service-only reconciliation RPC.
    const snapshotStartedAt = new Date().toISOString();
    const snapshotResponse = await (dependencies.fetch ?? fetch)(`https://api.paystack.co/subscription/${row.provider_subscription_code}`, {
      method: "GET", redirect: "error",
      headers: { Authorization: `Bearer ${config.paystackSecretKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(PAYSTACK_REQUEST_TIMEOUT_MS),
    });
    const snapshotResult = await readJsonResponseWithLimit(snapshotResponse);
    if (!snapshotResponse.ok || "error" in snapshotResult || !isPlainObject(snapshotResult.data) ||
        snapshotResult.data.status !== true || !isPlainObject(snapshotResult.data.data)) {
      return reply("Paystack subscription status could not be verified. Please retry.", 502);
    }
    const snapshot = snapshotResult.data.data;
    const snapshotId = typeof snapshot.id === "number" && Number.isSafeInteger(snapshot.id) && snapshot.id > 0
      ? String(snapshot.id) : typeof snapshot.id === "string" && /^[1-9][0-9]*$/.test(snapshot.id) ? snapshot.id : null;
    if (snapshot.domain !== config.paystackEnvironment || snapshot.subscription_code !== row.provider_subscription_code ||
        !snapshotId || snapshotId !== row.provider_subscription_id || !isPlainObject(snapshot.customer) ||
        snapshot.customer.customer_code !== row.provider_customer_code) {
      return reply("Paystack subscription identity did not match the billing record.", 502);
    }
    if (body.action === "card") {
      // Read-only current card lookup. Never rewrite a historical payment method
      // or reconcile subscription status while displaying card details.
      if (!["active", "attention", "non-renewing"].includes(String(snapshot.status))) {
        return reply("This subscription no longer has a current renewal card to display.", 409);
      }
      const card = snapshot.authorization;
      if (card === null || (isPlainObject(card) && typeof card.channel === "string" && card.channel !== "card")) {
        return Response.json({ ok: true, data: { company_id: companyId, card: null } }, { headers });
      }
      if (!isPlainObject(card) || card.channel !== "card" || !isValidUuid(row.id) ||
          typeof card.last4 !== "string" || !/^[0-9]{4}$/.test(card.last4) ||
          typeof card.card_type !== "string" || !/^[a-zA-Z][a-zA-Z -]{0,39}$/.test(card.card_type.trim()) ||
          !/^(0?[1-9]|1[0-2])$/.test(String(card.exp_month)) || !/^[0-9]{4}$/.test(String(card.exp_year)) ||
          Number(card.exp_year) < 2000 || Number(card.exp_year) > 2199) {
        return reply("Paystack returned incomplete card details. Please refresh or check the card on Paystack.", 502);
      }
      return Response.json({ ok: true, data: { company_id: companyId, card: {
        id: row.id, brand: card.card_type.trim().toLowerCase(), last4: card.last4,
        expiry_month: Number(card.exp_month), expiry_year: Number(card.exp_year),
        environment: config.paystackEnvironment,
      } } }, { headers });
    }
    if (snapshot.status === "non-renewing") {
      const nextPayment = snapshot.next_payment_date;
      if (nextPayment != null && (typeof nextPayment !== "string" || nextPayment.trim() !== nextPayment || !Number.isFinite(Date.parse(nextPayment)))) {
        return reply("Paystack returned an invalid subscription date.", 502);
      }
      const reconciled = await service.rpc("reconcile_paystack_non_renewing", {
        p_company_id: companyId, p_provider_record_id: row.id,
        p_environment: config.paystackEnvironment,
        p_provider_subscription_code: row.provider_subscription_code,
        p_provider_subscription_id: snapshotId,
        p_provider_customer_code: snapshot.customer.customer_code,
        p_snapshot_started_at: snapshotStartedAt,
        p_next_payment_at: nextPayment == null ? null : new Date(nextPayment as string).toISOString(),
      });
      if (reconciled.error || !isPlainObject(reconciled.data) || reconciled.data.ok !== true || reconciled.data.auto_renew_enabled !== false) {
        return reply("Cancellation status could not be saved. Refresh and retry subscription management.", 503);
      }
    } else if (snapshot.status !== "active" && snapshot.status !== "attention") {
      return reply("This provider subscription is no longer available for management.", 409);
    }
    const response = await (dependencies.fetch ?? fetch)(`https://api.paystack.co/subscription/${row.provider_subscription_code}/manage/link`, {
      method: "GET", redirect: "error",
      headers: { Authorization: `Bearer ${config.paystackSecretKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(PAYSTACK_REQUEST_TIMEOUT_MS),
    });
    const result = await readJsonResponseWithLimit(response);
    if (!response.ok || "error" in result || !isPlainObject(result.data) || result.data.status !== true ||
        !isPlainObject(result.data.data) || !isPaystackManagementUrl(result.data.data.link)) {
      return reply("Paystack could not open subscription management. Please retry.", 502);
    }
    return Response.json({ ok: true, data: { url: result.data.data.link } }, { headers });
  } catch { return reply("Subscription management is temporarily unavailable. Please retry.", 503); }
}

if (typeof Deno !== "undefined" && import.meta.main) Deno.serve(request => handleManageSubscription(request));
