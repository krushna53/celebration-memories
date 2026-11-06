// Published wedding websites: the create form saved under a link the couple picks (/wedding/<slug>).
// POST /api/website { slug, form, key? } saves it; GET /api/website/<slug> returns { form }.
// The first save of a slug returns a private edit key; saving that slug again needs the same key,
// so nobody else can take over or overwrite a couple's link. Only a hash of the key is stored.
// Both the local dev server and Netlify use this handler.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const RESERVED = ["sample-photo", "sample-video"]; // ready-made sample websites (lib/invitation-form.js)
const MAX_BYTES = 5_500_000; // Netlify functions accept about 6 MB per request
export const validSlug = (slug) => typeof slug === "string" && /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/.test(slug);
const reply = (status, body) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

/** store: { get(slug) → string | null, set(slug, string) } */
export async function serveWebsite(request, store) {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/api/website") {
    if (request.headers.get("origin") && request.headers.get("origin") !== url.origin) return reply(403, { error: "Invalid origin" });
    const text = await request.text();
    if (Buffer.byteLength(text) > MAX_BYTES) return reply(413, { error: "Your photos or music are too large to publish. Use smaller photos, or a music link instead of an upload." });
    let body;
    try { body = JSON.parse(text); } catch { return reply(400, { error: "Invalid website data." }); }
    const { slug, form, key } = body || {};
    if (!validSlug(slug)) return reply(400, { error: "Use 3–60 small letters, numbers or dashes for the link, for example kunal-aanchal." });
    if (RESERVED.includes(slug)) return reply(409, { error: "This link is already taken. Pick another one." });
    if (!form || typeof form !== "object" || Array.isArray(form) || typeof form.groom !== "string") return reply(400, { error: "Invalid website data." });
    const raw = await store.get(slug);
    const existing = raw ? JSON.parse(raw) : null;
    if (existing && !(typeof key === "string" && same(hash(key), existing.keyHash))) return reply(409, { error: "This link is already taken. Pick another one." });
    const editKey = existing ? key : randomBytes(18).toString("base64url");
    await store.set(slug, JSON.stringify({ form, keyHash: hash(editKey), updated: new Date().toISOString() }));
    return reply(existing ? 200 : 201, { slug, url: `${url.origin}/wedding/${slug}`, key: editKey });
  }
  if (!["GET", "HEAD"].includes(request.method)) return reply(405, { error: "Method not allowed" });
  const slug = url.pathname.split("/")[3];
  if (!validSlug(slug)) return reply(404, { error: "Website not found" });
  const raw = await store.get(slug);
  if (!raw) return reply(404, { error: "Website not found" });
  return reply(200, { form: JSON.parse(raw).form });
}
