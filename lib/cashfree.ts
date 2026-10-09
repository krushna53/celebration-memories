import "server-only";
import { cashfreeSettings } from "@/services/cashfree-settings";
import { createHmac, timingSafeEqual } from "node:crypto";

export type CashfreeEnvironment = "sandbox" | "production";
export interface CashfreeOrder {
  order_id: string;
  order_status: string;
  order_amount: number;
  order_currency: string;
  payment_session_id: string;
}

function cashfreeConfig() {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  const environment = process.env.CASHFREE_ENVIRONMENT || "sandbox";
  if (!appId || !secretKey) throw new Error("Cashfree is not configured. Add its App ID and Secret Key on the server.");
  if (environment !== "sandbox" && environment !== "production") throw new Error("Invalid Cashfree environment.");
  return { appId, secretKey, baseUrl: environment === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg" };
}

async function orderRequest(path: string, input?: object, idempotencyKey?: string): Promise<CashfreeOrder> {
  const { appId, secretKey, environment } = await cashfreeSettings();
  if (!appId || !secretKey) throw new Error("Cashfree is not configured.");
  if (!["sandbox", "production"].includes(environment)) throw new Error("Invalid Cashfree environment.");
  const baseUrl = environment === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
  const response = await fetch(`${baseUrl}${path}`, {
    method: input ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": "2026-01-01",
      "x-client-id": appId,
      "x-client-secret": secretKey,
      ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
    },
    body: input ? JSON.stringify(input) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Cashfree request failed (${response.status}). Please check the merchant API logs.`);
  const order = await response.json() as CashfreeOrder;
  if (!order.order_id || !order.order_status || !Number.isFinite(order.order_amount) || !order.order_currency) {
    throw new Error("Cashfree returned an invalid order.");
  }
  return order;
}

/** Call only after authorizing the purchaser and calculating price from server records.
 * Persist orderId and idempotencyKey before the first request; reuse both on retries.
 */
export async function createCashfreeOrder(input: {
  orderId: string; idempotencyKey: string; amount: number; currency: string;
  customerId: string; customerPhone: string; customerEmail?: string; returnUrl: string;
}): Promise<CashfreeOrder> {
  if (!/^[A-Za-z0-9_-]{3,45}$/.test(input.orderId)) throw new Error("Invalid Cashfree order ID.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.idempotencyKey)) throw new Error("A stable UUID idempotency key is required.");
  if (!Number.isFinite(input.amount) || input.amount < 1 || Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 0.000001) throw new Error("Invalid payment amount.");
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error("Invalid payment currency.");
  if (!/^\+?[0-9]{10,15}$/.test(input.customerPhone)) throw new Error("A valid customer phone number is required.");
  const returnUrl = new URL(input.returnUrl);
  const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://everymoment.in");
  if (returnUrl.origin !== siteUrl.origin) throw new Error("Invalid payment return URL.");
  const order = await orderRequest("/orders", {
    order_id: input.orderId, order_amount: input.amount, order_currency: input.currency,
    customer_details: { customer_id: input.customerId, customer_phone: input.customerPhone, customer_email: input.customerEmail },
    order_meta: { return_url: returnUrl.toString() },
  }, input.idempotencyKey);
  if (!order.payment_session_id || order.order_id !== input.orderId) throw new Error("Cashfree did not return the expected checkout session.");
  return order;
}

export async function getCashfreeOrder(orderId: string): Promise<CashfreeOrder> {
  if (!/^[A-Za-z0-9_-]{3,45}$/.test(orderId)) throw new Error("Invalid Cashfree order ID.");
  return orderRequest(`/orders/${encodeURIComponent(orderId)}`);
}

/** A redirect or client callback alone never proves payment. */
export function isCashfreeOrderPaid(order: CashfreeOrder, expected: { orderId: string; amount: number; currency: string }): boolean {
  return order.order_id === expected.orderId && order.order_status === "PAID" && order.order_currency === expected.currency &&
    Number.isFinite(order.order_amount) && Math.round(order.order_amount * 100) === Math.round(expected.amount * 100);
}

/** Verify the original body before parsing JSON. The consuming webhook must also
 * deduplicate payment IDs and apply paid-state changes transactionally.
 */
export function verifyCashfreeWebhook(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  const { secretKey } = cashfreeConfig();
  const expected = createHmac("sha256", secretKey).update(timestamp + rawBody).digest("base64");
  const received = Buffer.from(signature);
  const calculated = Buffer.from(expected);
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}
