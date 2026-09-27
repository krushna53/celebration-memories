import "server-only";

/**
 * Server side of "Import from Google Photos" (Google Photos Picker API).
 * The browser gets a short-lived, picker-only OAuth access token from
 * Google Identity Services and sends it with each request; these helpers
 * forward it to Google. Nothing is stored — the token lives only for
 * the request.
 *
 * Why a server hop at all: Google requires the bearer token on every
 * media download and doesn't document browser (CORS) access, so the
 * route handlers in app/api/google-photos/ proxy the calls instead.
 */

const PICKER = "https://photospicker.googleapis.com/v1";

export class GooglePhotosError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

/** Pulls the Google access token from `Authorization: Bearer …`. */
export function googleToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token.length > 4096) throw new GooglePhotosError("Missing Google sign-in.", 401);
  return token;
}

/** Only our own pages may use these routes — they're a proxy, so refuse cross-site callers. */
export function assertSameOrigin(request: Request): void {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") throw new GooglePhotosError("Not allowed.", 403);
}

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PICKER}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const status = res.status === 401 || res.status === 403 ? 401 : 502;
    throw new GooglePhotosError(
      status === 401 ? "Google sign-in expired — please connect Google Photos again." : `Google Photos error (${res.status}). ${body.slice(0, 200)}`,
      status,
    );
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface PickerSession {
  id: string;
  pickerUri: string;
  mediaItemsSet?: boolean;
  pollingConfig?: { pollInterval?: string; timeoutIn?: string };
}

export function createSession(token: string, maxItems: number) {
  return call<PickerSession>(token, "/sessions", {
    method: "POST",
    body: JSON.stringify({ pickingConfig: { maxItemCount: String(maxItems) } }),
  });
}

export function getSession(token: string, id: string) {
  return call<PickerSession>(token, `/sessions/${encodeURIComponent(id)}`);
}

export function deleteSession(token: string, id: string) {
  return call<void>(token, `/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export interface PickedItem {
  id: string;
  type: "PHOTO" | "VIDEO" | string;
  mediaFile: { baseUrl: string; mimeType: string; filename?: string };
}

export async function listPickedItems(token: string, sessionId: string): Promise<PickedItem[]> {
  const items: PickedItem[] = [];
  let pageToken = "";
  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({ sessionId, pageSize: "100", ...(pageToken ? { pageToken } : {}) });
    const res = await call<{ mediaItems?: PickedItem[]; nextPageToken?: string }>(token, `/mediaItems?${qs}`);
    items.push(...(res.mediaItems ?? []));
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }
  return items;
}

/** A picked photo's baseUrl must be on Google's image host — anything else is refused, so this can't proxy arbitrary URLs. */
export function isGoogleMediaUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}
