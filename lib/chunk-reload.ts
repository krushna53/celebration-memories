/**
 * Recovering from a page script that failed to download — e.g. right
 * after a Netlify deploy, when the CDN briefly answers a new
 * /_next/static chunk with a 503, or a tab still open from the previous
 * deploy asks for a chunk that no longer exists. Either way the browser
 * shows Next.js's bare "Application error" screen; a fresh load fixes it.
 *
 * Reloads at most once per RELOAD_WINDOW_MS (remembered in
 * sessionStorage) so a chunk that is genuinely broken can't trap the
 * visitor in a reload loop — the second failure falls through to the
 * normal error screen instead.
 */

const STORAGE_KEY = "chunk-reload-at";
const RELOAD_WINDOW_MS = 30_000;

/** True for webpack/Turbopack/native-import "couldn't download a chunk" failures. */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "ChunkLoadError") return true;
  if (typeof message !== "string") return false;
  return /Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    message,
  );
}

/** Reloads the page unless this tab already did so in the last RELOAD_WINDOW_MS. Returns whether it reloaded. */
export function reloadOnceForChunkError(): boolean {
  try {
    const last = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Storage blocked (private mode etc.) — without a loop guard, don't risk it.
    return false;
  }
  window.location.reload();
  return true;
}
