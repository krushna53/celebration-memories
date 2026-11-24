/**
 * Minimal Graph API client for the Cloud API. No SDK (Meta's official
 * Node SDK is unmaintained) — just fetch with a timeout, and an error
 * classification that decides whether the outbox retries.
 *
 * Never logs the access token or the Authorization header.
 */

export interface GraphConfig {
  apiVersion: string;
  phoneNumberId: string;
  accessToken: string;
}

export type GraphSendResult =
  | { ok: true; wamid: string }
  | { ok: false; retryable: boolean; code: number | null; title: string };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Error codes worth retrying: throttling and Meta-side hiccups. Everything else (bad template, bad number, auth…) is permanent. */
const RETRYABLE_CODES = new Set([1, 2, 4, 17, 32, 613, 80007, 130429, 131000, 131016, 131056, 133004]);

export function isRetryableGraphError(code: number | null, httpStatus: number): boolean {
  if (code !== null && RETRYABLE_CODES.has(code)) return true;
  if (code === null) return httpStatus === 429 || httpStatus >= 500 || httpStatus === 0;
  return false;
}

/** A short, safe description for the log: Meta's own title/message, never request headers. */
function errorTitle(error: { message?: string; error_user_msg?: string; error_data?: { details?: string } } | undefined, fallback: string): string {
  const text = error?.error_data?.details || error?.error_user_msg || error?.message || fallback;
  return text.slice(0, 300);
}

export const GRAPH_TIMEOUT_MS = 10_000;

export async function graphRequest(
  config: GraphConfig,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
  fetchImpl: FetchLike = fetch,
): Promise<{ httpStatus: number; json: Record<string, unknown> | null; networkError?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`https://graph.facebook.com/${config.apiVersion}/${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { httpStatus: res.status, json };
  } catch (err) {
    // fetch rejects with a DOMException named AbortError on timeout.
    const aborted = typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError";
    return { httpStatus: 0, json: null, networkError: aborted ? "Timed out waiting for Meta." : "Couldn't reach Meta." };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendGraphMessage(config: GraphConfig, body: Record<string, unknown>, fetchImpl: FetchLike = fetch): Promise<GraphSendResult> {
  const { httpStatus, json, networkError } = await graphRequest(config, `${config.phoneNumberId}/messages`, { method: "POST", body }, fetchImpl);
  if (networkError) return { ok: false, retryable: true, code: null, title: networkError };

  const messages = json?.messages as Array<{ id?: string }> | undefined;
  const wamid = messages?.[0]?.id;
  if (httpStatus >= 200 && httpStatus < 300 && wamid) return { ok: true, wamid };

  const error = json?.error as { code?: number; message?: string; error_user_msg?: string; error_data?: { details?: string } } | undefined;
  const code = typeof error?.code === "number" ? error.code : null;
  return { ok: false, retryable: isRetryableGraphError(code, httpStatus), code, title: errorTitle(error, `HTTP ${httpStatus}`) };
}

/** Exponential backoff with jitter for attempt n (1-based): ~1, 2, 4, 8, 16 minutes, capped at an hour. */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(60, 2 ** Math.max(0, attempt - 1)) * 60_000;
  return Math.round(base * (0.8 + random() * 0.4));
}

export const MAX_SEND_ATTEMPTS = 5;
