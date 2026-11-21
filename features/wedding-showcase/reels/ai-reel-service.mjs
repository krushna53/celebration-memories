import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const MODEL = "grok-imagine-video-1.5-lite";
const RATES = { "480p": 0.02, "720p": 0.03 };
const reply = (status, data) => Response.json(data, { status, headers: { "cache-control": "no-store" } });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const equal = (left, right) => { const a = Buffer.from(left || ""), b = Buffer.from(right || ""); return a.length === b.length && timingSafeEqual(a, b); };
const cost = (result) => { const ticks = Number(result?.usage?.cost_in_usd_ticks); return Number.isSafeInteger(ticks) && ticks >= 0 ? ticks / 1e10 : null; };
function sign(payload, secret) { const body = Buffer.from(JSON.stringify(payload)).toString("base64url"); return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`; }
function verify(token, secret) { const [body, signature, extra] = String(token).split("."); if (extra || !body || !signature || !equal(signature, createHmac("sha256", secret).update(body).digest("base64url"))) throw new Error("Price confirmation is invalid. Review it again."); return JSON.parse(Buffer.from(body, "base64url").toString()); }
function safePhoto(value) { const matched = String(value || "").match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/); if (!matched) throw new Error("Upload a JPG, PNG or WebP photo."); const bytes = Buffer.from(matched[2], "base64"); if (!bytes.length || bytes.length > 3000000) throw new Error("Use a photo under 3 MB."); return bytes; }

export async function serveAiReel(request, { store, apiKey = "", fetcher = fetch, now = Date.now() }) {
  const url = new URL(request.url), action = url.pathname.split("/").filter(Boolean).at(-1);
  const ready = Boolean(apiKey);
  if (request.method === "GET" && action === "config") return reply(200, { ready, message: ready ? "Review the estimated xAI credits before sending the photo." : "xAI video generation is not configured on this server." });
  if (request.method !== "POST" || !["quote", "generate", "status"].includes(action)) return reply(405, { error: "Unsupported request." });
  if (!ready) return reply(503, { error: "AI generation is not configured on this server yet." });
  if (request.headers.get("origin") && request.headers.get("origin") !== url.origin) return reply(403, { error: "This request must come from this site." });
  const secret = hash(`${apiKey}:ai-reel`);
  try {
    const body = await request.json();
    if (action === "quote") {
      const prompt = String(body.prompt || "").trim(); const resolution = body.resolution === "480p" ? "480p" : "720p";
      if (prompt.length < 30 || prompt.length > 12000) throw new Error("Use an animation prompt between 30 and 12,000 characters.");
      if (!/^[a-f0-9]{64}$/.test(body.photoHash)) throw new Error("Upload the couple photo again, then review the cost.");
      const seconds = [5, 10, 15].includes(Number(body.seconds)) ? Number(body.seconds) : 15;
      const totalUsd = RATES[resolution] * seconds + 0.01;
      const quote = { id: randomUUID(), model: MODEL, prompt, resolution, seconds, photoHash: body.photoHash, totalUsd, expires: now + 600000 };
      return reply(200, { ...quote, token: sign(quote, secret) });
    }
    const quote = verify(body.token, secret);
    if (now > quote.expires) return reply(409, { error: "This price confirmation expired. Review the cost again." });
    const key = `job-${quote.id}`;
    let job = await store.get(key);
    if (action === "generate") {
      if (body.confirmed !== true) return reply(400, { error: "Confirm the displayed estimate before generating." });
      if (job) return reply(200, job);
      const photo = safePhoto(body.image); if (hash(photo) !== quote.photoHash) return reply(409, { error: "The uploaded photo changed. Review the cost again." });
      job = { state: "starting", created: now, estimatedUsd: quote.totalUsd, seconds: quote.seconds, resolution: quote.resolution };
      if (!await store.claim(key, job)) return reply(202, await store.get(key));
      try {
        const upstream = await fetcher("https://api.x.ai/v1/videos/generations", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model: quote.model, prompt: quote.prompt, image: { url: body.image }, duration: quote.seconds, resolution: quote.resolution, aspect_ratio: "9:16" }), signal: AbortSignal.timeout(120000) });
        const result = await upstream.json().catch(() => ({})); const actualCostUsd = cost(result);
        if (!upstream.ok) job = { ...job, state: "failed", actualCostUsd, error: upstream.status === 402 ? "xAI credits have run out. Add credits or raise the xAI usage limit." : "xAI rejected this generation. Check API permissions, model access and billing." };
        else if (typeof result.request_id === "string") job = { ...job, state: "pending", actualCostUsd, requestId: result.request_id };
        else job = { ...job, state: "unknown", actualCostUsd, error: "xAI returned an incomplete response. Check usage before retrying." };
      } catch { job = { ...job, state: "unknown", error: "Connection ended after submission. The request may be billed; check xAI usage before retrying." }; }
      await store.set(key, job); return reply(202, job);
    }
    if (!job) return reply(404, { error: "Generation not found." });
    if (job.state === "pending" && job.requestId) {
      const upstream = await fetcher(`https://api.x.ai/v1/videos/${encodeURIComponent(job.requestId)}`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000) });
      if (!upstream.ok) return reply(503, { error: "Could not check progress. Do not submit another generation." });
      const result = await upstream.json(); const actualCostUsd = cost(result);
      if (result.status === "done" && typeof result.video?.url === "string") {
        const videoUrl = new URL(result.video.url);
        if (videoUrl.protocol !== "https:") throw new Error("xAI returned an unsafe video link.");
        job = { ...job, state: "done", actualCostUsd: actualCostUsd ?? job.actualCostUsd, videoUrl: videoUrl.href };
      }
      else if (result.status === "failed") job = { ...job, state: "failed", actualCostUsd: actualCostUsd ?? job.actualCostUsd, error: "Video generation failed. Check xAI usage for any charge." };
      else if (actualCostUsd !== null) job = { ...job, actualCostUsd };
      await store.set(key, job);
    }
    return reply(200, job);
  } catch (error) { return reply(400, { error: error instanceof SyntaxError ? "Invalid request data." : error.message || "Could not process this request." }); }
}
