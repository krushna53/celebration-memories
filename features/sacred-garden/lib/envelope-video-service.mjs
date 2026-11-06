// The couple's envelope film: our own film, with only the text on the wax seal changed.
// Grok's video edit could not do this (in four tries it kept "R&Z" and changed the seal's colour), but its image
// edit re-letters a still seal well. So: the browser cuts a close-up of the seal from our film's first frame,
// Grok's image edit (POST /v1/images/edits) runs the owner's prompt on it, and the browser then changes only the
// letters inside the seal in every frame of our film (lib/seal-letters.js) and uploads the finished MP4 here.
// The film is saved on our server, so the create preview and the published website play it, and every set of
// letters is paid for once: a later request for the same letters gets the saved film.
// Safety: the server signs each request, the paid POST is never retried automatically, and the API key never
// leaves the server. Endpoints (under /api/envelope-video/): GET config | film/<id>, POST quote | seal | film.
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const FILM_LETTERS = "R&Z"; // what our film's seal shows
const MODEL = "grok-imagine-image-2.0";
const MAX_FILM_BYTES = 5_500_000; // Netlify functions accept about 6 MB per request
// $0.04 per image for grok-imagine-image-2.0; an edit bills the input and the output image (about $0.07 seen).
export const estimateEnvelopeCents = () => 8;

/** Letters for the seal, e.g. "A & M": up to 9 letters, digits, "&", "." or spaces. */
export function sealLetters(value) {
  const text = String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!/^[\p{L}\p{N}&. ]{1,9}$/u.test(text)) throw new Error("Use up to 9 letters for the seal, for example A & M.");
  return text;
}

/** The owner's wording for Grok's edit: the film's current letters and the couple's initials are filled in. */
export function envelopePrompt(letters) {
  return `Completely remove the monogram text "${FILM_LETTERS}" from the red wax seal and replace it with elegant golden cursive script text "${letters}". `
    + "Keep the exact same font style, color, glow, and placement. Do not leave any trace of the old letters. "
    + "Preserve the wax seal shape, color, golden light rays, cream envelope, and all embossed floral patterns exactly as they are.";
}

const reply = (status, data) => Response.json(data, { status, headers: { "cache-control": "no-store" } });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const equal = (a, b) => { const x = Buffer.from(a || ""), y = Buffer.from(b || ""); return x.length === y.length && timingSafeEqual(x, y); };
const sign = (payload, secret) => { const body = Buffer.from(JSON.stringify(payload)).toString("base64url"); return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`; };
function verify(token, secret, now) {
  if (typeof token !== "string" || token.length > 8000) throw new Error("Invalid request. Try again.");
  const [body, signature, extra] = token.split(".");
  if (extra || !signature || !equal(signature, createHmac("sha256", secret).update(body).digest("base64url"))) throw new Error("Invalid request. Try again.");
  const data = JSON.parse(Buffer.from(body, "base64url").toString());
  if (!/^[a-f0-9-]{36}$/.test(data.id) || !Number.isFinite(data.expires) || now > data.expires + 86400000) throw new Error("This request has expired. Try again.");
  return data;
}
const providerCostUsd = (result) => { const ticks = Number(result?.usage?.cost_in_usd_ticks); return result?.usage?.cost_in_usd_ticks != null && Number.isSafeInteger(ticks) && ticks >= 0 ? ticks / 1e10 : null; };
const lettersKey = (letters) => `letters-v5-${hash(letters)}`; // v5: our film with only the seal's letters changed
const filmPath = (id) => `/api/envelope-video/film/${id}`;

/** the seal close-up sent by the browser: a JPEG or PNG data URL under 3 MB */
function closeUp(data) {
  const match = typeof data === "string" && data.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new Error("The seal picture is missing.");
  const bytes = Buffer.from(match[2], "base64");
  const ok = match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!ok || bytes.length > 3000000) throw new Error("The seal picture is not a valid image under 3 MB.");
  return data;
}

/**
 * store: { get, set, claim } for JSON jobs — claim must be atomic (writes only if the key is new).
 * films: { get(id) → bytes | null, set(id, bytes) } for the finished films.
 */
export async function serveEnvelopeVideo(request, { store, films, apiKey = "", accessCode = "", allowLocalAccess = false, openAccess = false, fetcher = fetch, now = Date.now() }) {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/\/$/, "").split("/");
  const action = parts.at(-1);

  // a finished film: public, so guests of a published website can play it
  if (["GET", "HEAD"].includes(request.method) && parts.at(-2) === "film") {
    const bytes = /^[a-f0-9-]{36}$/.test(action) ? await films.get(action) : null;
    if (!bytes) return reply(404, { error: "Film not found." });
    const all = new Uint8Array(bytes), headers = { "content-type": "video/mp4", "accept-ranges": "bytes", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" };
    // byte ranges, so browsers can seek (Safari on iPhone plays video only from servers that allow this)
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, all.length - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), all.length - 1) : all.length - 1;
      if (start > end || start >= all.length) return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${all.length}` } });
      return new Response(request.method === "HEAD" ? null : all.subarray(start, end + 1), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${all.length}`, "content-length": String(end - start + 1) } });
    }
    return new Response(request.method === "HEAD" ? null : all, { headers: { ...headers, "content-length": String(all.length) } });
  }

  // openAccess: anyone may make a film (no owner code); otherwise only on your own machine, or with the code
  const localAccess = openAccess || (allowLocalAccess && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  const ready = Boolean(apiKey && (localAccess || accessCode.length >= 16));
  if (request.method === "GET" && action === "config") {
    return reply(200, { ready, accessRequired: !localAccess, estimatedCents: estimateEnvelopeCents(), message: ready ? "Grok can put your letters on the envelope film." : !apiKey ? "The xAI API key is missing on the server." : "Add a private generation access code of at least 16 characters on the server." });
  }
  if (request.method !== "POST" || !["quote", "seal", "film"].includes(action)) return reply(405, { error: "Unsupported request." });
  if (!ready) return reply(503, { error: "Grok is not configured on this server yet." });
  const origin = request.headers.get("origin");
  if ((origin && origin !== url.origin) || (localAccess && origin !== url.origin)) return reply(403, { error: "This request must come from the invitation site." });
  if (!localAccess && !equal(request.headers.get("x-ai-access-code"), accessCode)) return reply(403, { error: "Enter the generation access code provided by the site owner." });
  const secret = hash(`envelope-seal:${apiKey}:${accessCode}`);
  try {
    // film: the finished MP4 made in the browser, for a seal Grok has finished
    if (action === "film") {
      const q = verify(url.searchParams.get("token"), secret, now);
      const key = `seal-${q.id}`;
      const job = await store.get(key);
      if (job?.state !== "done") return reply(409, { error: "Grok has not finished this seal yet." });
      if (job.film) return reply(200, { state: "done", letters: job.letters, film: job.film });
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.length > MAX_FILM_BYTES) return reply(413, { error: "The envelope film is too large to save." });
      if (bytes.length < 12 || String.fromCharCode(...bytes.subarray(4, 8)) !== "ftyp") return reply(400, { error: "The envelope film is not an MP4 video." });
      await films.set(q.id, bytes);
      const done = { ...job, film: filmPath(q.id) };
      await store.set(key, done);
      await store.set(lettersKey(job.letters), { film: done.film });
      return reply(201, { state: "done", letters: job.letters, film: done.film });
    }

    const text = await request.text();
    if (text.length > 4200000) throw new Error("Request is too large.");
    const body = JSON.parse(text || "{}");

    if (action === "quote") {
      const letters = sealLetters(body.letters);
      const saved = await store.get(lettersKey(letters));
      if (saved?.film) return reply(200, { state: "done", letters, film: saved.film });
      const quote = { id: randomUUID(), letters, prompt: envelopePrompt(letters), model: MODEL, totalCents: estimateEnvelopeCents(), expires: now + 600000 };
      return reply(200, { ...quote, token: sign(quote, secret) });
    }

    // seal: one paid image edit, never repeated for the same request
    const q = verify(body.token, secret, now);
    if (body.confirmed !== true) return reply(400, { error: "Confirm before Grok writes the letters." });
    const key = `seal-${q.id}`;
    const existing = await store.get(key);
    if (existing) return reply(200, existing);
    if (now > q.expires) return reply(409, { error: "This request expired. Try again." });
    const image = closeUp(body.image);
    let job = { state: "starting", letters: q.letters, estimatedCents: q.totalCents, created: now };
    if (!await store.claim(key, job)) return reply(202, await store.get(key) || job);
    // Never retry this POST automatically: an interrupted response may still be billed.
    try {
      const upstream = await fetcher("https://api.x.ai/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, prompt: q.prompt, image: { url: image, type: "image_url" }, response_format: "b64_json" }),
        signal: AbortSignal.timeout(120000),
      });
      const result = await upstream.json().catch(() => ({}));
      const cost = providerCostUsd(result);
      if (cost !== null) job = { ...job, actualCostUsd: cost };
      const out = result?.data?.[0];
      if (!upstream.ok) job = { ...job, state: "failed", error: upstream.status === 402 || upstream.status === 429 ? "xAI credits or usage limit reached. Check xAI billing before trying again." : "xAI rejected the request. Check API permissions, model access and billing. It was not retried." };
      else if (typeof out?.b64_json === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(out.b64_json)) job = { ...job, state: "done", image: `data:${/^image\/(png|jpeg|webp)$/.test(out.mime_type) ? out.mime_type : "image/jpeg"};base64,${out.b64_json}` };
      else job = { ...job, state: "unknown", error: "xAI's reply had no picture. Check xAI usage before trying again." };
    } catch {
      job = { ...job, state: "unknown", error: "The connection was interrupted after sending. It may be billed; check xAI usage. It will not be retried." };
    }
    await store.set(key, job);
    return reply(job.state === "done" ? 200 : 202, job);
  } catch (error) {
    return reply(400, { error: error instanceof SyntaxError ? "Invalid request data." : error.message || "Could not process this request." });
  }
}
