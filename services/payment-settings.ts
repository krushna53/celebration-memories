import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface RazorpaySettings {
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
  planSubscription: string | null;
  amountOneTime: number | null;
  currency: string;
}

export interface StripeSettings {
  secretKey: string | null;
  webhookSecret: string | null;
  priceOneTime: string | null;
  priceSubscription: string | null;
}

export interface CCAvenueSettings {
  merchantId: string | null;
  accessCode: string | null;
  workingKey: string | null;
  amountOneTime: number | null;
  currency: string;
  /** No subscriptions — CCAvenue's recurring-payment product is a separate, more involved API not wired up here (see lib/ccavenue.ts). */
  testMode: boolean;
}

interface SettingsRow {
  razorpay_key_id: string | null;
  razorpay_key_secret: string | null;
  razorpay_webhook_secret: string | null;
  razorpay_plan_subscription: string | null;
  razorpay_amount_one_time: number | null;
  razorpay_currency: string;
  stripe_secret_key: string | null;
  stripe_webhook_secret: string | null;
  stripe_price_one_time: string | null;
  stripe_price_subscription: string | null;
  ccavenue_merchant_id: string | null;
  ccavenue_access_code: string | null;
  ccavenue_working_key: string | null;
  ccavenue_amount_one_time: number | null;
  ccavenue_currency: string;
  ccavenue_test_mode: boolean;
}

/**
 * Single source of truth for both payment processors' credentials and
 * price/plan identifiers. The `payment_provider_settings` table (a
 * singleton row, same shape as billing_settings) is checked first;
 * whichever field is null there falls back to the matching environment
 * variable, so existing env-var-only deployments keep working
 * unchanged and the owner can override any one field at a time from
 * /admin/billing (features/admin/billing/api-keys-form.tsx) without
 * needing to touch Netlify or redeploy. See lib/stripe.ts and
 * lib/razorpay.ts for where these get turned into actual SDK clients.
 */
async function getRow(): Promise<SettingsRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("payment_provider_settings")
    .select(
      "razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret, razorpay_plan_subscription, razorpay_amount_one_time, razorpay_currency, stripe_secret_key, stripe_webhook_secret, stripe_price_one_time, stripe_price_subscription, ccavenue_merchant_id, ccavenue_access_code, ccavenue_working_key, ccavenue_amount_one_time, ccavenue_currency, ccavenue_test_mode",
    )
    .eq("id", true)
    .maybeSingle<SettingsRow>();

  if (error) {
    console.error("getRow (payment_provider_settings) failed:", error.message);
    return null;
  }
  return data;
}

export async function getRazorpaySettings(): Promise<RazorpaySettings> {
  const row = await getRow();
  return {
    keyId: row?.razorpay_key_id || process.env.RAZORPAY_KEY_ID || null,
    keySecret: row?.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET || null,
    webhookSecret: row?.razorpay_webhook_secret || process.env.RAZORPAY_WEBHOOK_SECRET || null,
    planSubscription: row?.razorpay_plan_subscription || process.env.RAZORPAY_PLAN_SUBSCRIPTION || null,
    amountOneTime:
      row?.razorpay_amount_one_time ??
      (process.env.RAZORPAY_AMOUNT_ONE_TIME ? Number(process.env.RAZORPAY_AMOUNT_ONE_TIME) : null),
    currency: row?.razorpay_currency || process.env.RAZORPAY_CURRENCY || "INR",
  };
}

export async function getStripeSettings(): Promise<StripeSettings> {
  const row = await getRow();
  return {
    secretKey: row?.stripe_secret_key || process.env.STRIPE_SECRET_KEY || null,
    webhookSecret: row?.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || null,
    priceOneTime: row?.stripe_price_one_time || process.env.STRIPE_PRICE_ONE_TIME || null,
    priceSubscription: row?.stripe_price_subscription || process.env.STRIPE_PRICE_SUBSCRIPTION || null,
  };
}

/** No environment-variable fallback for CCAvenue (it's a new addition, no pre-existing env-var deployments to preserve) — the database row is the only source. */
export async function getCCAvenueSettings(): Promise<CCAvenueSettings> {
  const row = await getRow();
  return {
    merchantId: row?.ccavenue_merchant_id ?? null,
    accessCode: row?.ccavenue_access_code ?? null,
    workingKey: row?.ccavenue_working_key ?? null,
    amountOneTime: row?.ccavenue_amount_one_time ?? null,
    currency: row?.ccavenue_currency || "INR",
    testMode: row?.ccavenue_test_mode ?? true,
  };
}

export interface PaymentSettingsFieldSummary {
  /** Non-secret values are shown in full; secret ones only as a masked preview. */
  value: string | null;
  /** True if set via the database (owner override) vs. falling back to an env var, vs. not set at all. */
  source: "database" | "env" | "none";
}

export interface PaymentSettingsSummary {
  razorpayKeyId: PaymentSettingsFieldSummary;
  razorpayKeySecret: PaymentSettingsFieldSummary;
  razorpayWebhookSecret: PaymentSettingsFieldSummary;
  razorpayPlanSubscription: PaymentSettingsFieldSummary;
  razorpayAmountOneTime: PaymentSettingsFieldSummary;
  razorpayCurrency: PaymentSettingsFieldSummary;
  stripeSecretKey: PaymentSettingsFieldSummary;
  stripeWebhookSecret: PaymentSettingsFieldSummary;
  stripePriceOneTime: PaymentSettingsFieldSummary;
  stripePriceSubscription: PaymentSettingsFieldSummary;
  ccavenueMerchantId: PaymentSettingsFieldSummary;
  ccavenueAccessCode: PaymentSettingsFieldSummary;
  ccavenueWorkingKey: PaymentSettingsFieldSummary;
  ccavenueAmountOneTime: PaymentSettingsFieldSummary;
  ccavenueCurrency: PaymentSettingsFieldSummary;
  ccavenueTestMode: boolean;
}

function maskSecret(value: string): string {
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

function fieldSummary(
  dbValue: string | number | null | undefined,
  envValue: string | undefined,
  secret: boolean,
): PaymentSettingsFieldSummary {
  if (dbValue !== null && dbValue !== undefined && dbValue !== "") {
    const str = String(dbValue);
    return { value: secret ? maskSecret(str) : str, source: "database" };
  }
  if (envValue) {
    return { value: secret ? maskSecret(envValue) : envValue, source: "env" };
  }
  return { value: null, source: "none" };
}

/** For the /admin/billing "API Keys" section — never returns a usable secret value, only masked previews + which source (DB override vs. env var vs. unset) is currently active. */
export async function getPaymentSettingsSummary(): Promise<PaymentSettingsSummary> {
  const row = await getRow();
  return {
    razorpayKeyId: fieldSummary(row?.razorpay_key_id, process.env.RAZORPAY_KEY_ID, false),
    razorpayKeySecret: fieldSummary(row?.razorpay_key_secret, process.env.RAZORPAY_KEY_SECRET, true),
    razorpayWebhookSecret: fieldSummary(row?.razorpay_webhook_secret, process.env.RAZORPAY_WEBHOOK_SECRET, true),
    razorpayPlanSubscription: fieldSummary(row?.razorpay_plan_subscription, process.env.RAZORPAY_PLAN_SUBSCRIPTION, false),
    razorpayAmountOneTime: fieldSummary(row?.razorpay_amount_one_time, process.env.RAZORPAY_AMOUNT_ONE_TIME, false),
    razorpayCurrency: fieldSummary(row?.razorpay_currency, process.env.RAZORPAY_CURRENCY, false),
    stripeSecretKey: fieldSummary(row?.stripe_secret_key, process.env.STRIPE_SECRET_KEY, true),
    stripeWebhookSecret: fieldSummary(row?.stripe_webhook_secret, process.env.STRIPE_WEBHOOK_SECRET, true),
    stripePriceOneTime: fieldSummary(row?.stripe_price_one_time, process.env.STRIPE_PRICE_ONE_TIME, false),
    stripePriceSubscription: fieldSummary(row?.stripe_price_subscription, process.env.STRIPE_PRICE_SUBSCRIPTION, false),
    ccavenueMerchantId: fieldSummary(row?.ccavenue_merchant_id, undefined, false),
    // Access Code isn't actually secret — it's submitted as a plain,
    // visible form field alongside the encrypted payload when the
    // browser POSTs to CCAvenue, so it's shown in full like the
    // Merchant ID rather than masked.
    ccavenueAccessCode: fieldSummary(row?.ccavenue_access_code, undefined, false),
    ccavenueWorkingKey: fieldSummary(row?.ccavenue_working_key, undefined, true),
    ccavenueAmountOneTime: fieldSummary(row?.ccavenue_amount_one_time, undefined, false),
    ccavenueCurrency: fieldSummary(row?.ccavenue_currency, undefined, false),
    ccavenueTestMode: row?.ccavenue_test_mode ?? true,
  };
}

export interface RazorpaySettingsInput {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  planSubscription?: string;
  amountOneTime?: number;
  currency?: string;
}

/** Owner-only (checked by the caller — features/admin/billing/actions.ts). Only fields present in `input` are changed; omit a field to leave it as-is. */
export async function updateRazorpaySettings(input: RazorpaySettingsInput): Promise<void> {
  const patch: Record<string, string | number> = {};
  if (input.keyId !== undefined) patch.razorpay_key_id = input.keyId;
  if (input.keySecret !== undefined) patch.razorpay_key_secret = input.keySecret;
  if (input.webhookSecret !== undefined) patch.razorpay_webhook_secret = input.webhookSecret;
  if (input.planSubscription !== undefined) patch.razorpay_plan_subscription = input.planSubscription;
  if (input.amountOneTime !== undefined) patch.razorpay_amount_one_time = input.amountOneTime;
  if (input.currency !== undefined) patch.razorpay_currency = input.currency;
  if (Object.keys(patch).length === 0) return;

  patch.updated_at = new Date().toISOString();
  const { error } = await supabaseAdmin().from("payment_provider_settings").update(patch).eq("id", true);
  if (error) throw new Error(`Failed to update Razorpay settings: ${error.message}`);
}

export interface StripeSettingsInput {
  secretKey?: string;
  webhookSecret?: string;
  priceOneTime?: string;
  priceSubscription?: string;
}

/** Owner-only (checked by the caller). Only fields present in `input` are changed; omit a field to leave it as-is. */
export async function updateStripeSettings(input: StripeSettingsInput): Promise<void> {
  const patch: Record<string, string> = {};
  if (input.secretKey !== undefined) patch.stripe_secret_key = input.secretKey;
  if (input.webhookSecret !== undefined) patch.stripe_webhook_secret = input.webhookSecret;
  if (input.priceOneTime !== undefined) patch.stripe_price_one_time = input.priceOneTime;
  if (input.priceSubscription !== undefined) patch.stripe_price_subscription = input.priceSubscription;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabaseAdmin()
    .from("payment_provider_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw new Error(`Failed to update Stripe settings: ${error.message}`);
}

export interface CCAvenueSettingsInput {
  merchantId?: string;
  accessCode?: string;
  workingKey?: string;
  amountOneTime?: number;
  currency?: string;
  testMode?: boolean;
}

/** Owner-only (checked by the caller). Only fields present in `input` are changed; omit a field to leave it as-is. */
export async function updateCCAvenueSettings(input: CCAvenueSettingsInput): Promise<void> {
  const patch: Record<string, string | number | boolean> = {};
  if (input.merchantId !== undefined) patch.ccavenue_merchant_id = input.merchantId;
  if (input.accessCode !== undefined) patch.ccavenue_access_code = input.accessCode;
  if (input.workingKey !== undefined) patch.ccavenue_working_key = input.workingKey;
  if (input.amountOneTime !== undefined) patch.ccavenue_amount_one_time = input.amountOneTime;
  if (input.currency !== undefined) patch.ccavenue_currency = input.currency;
  if (input.testMode !== undefined) patch.ccavenue_test_mode = input.testMode;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabaseAdmin()
    .from("payment_provider_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw new Error(`Failed to update CCAvenue settings: ${error.message}`);
}
