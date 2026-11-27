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
const WEDDING_STYLES = [
  "Marathi wedding",
  "Marwadi wedding",
  "Bengali wedding",
  "Gujarati wedding",
  "South Indian wedding",
  "Christian wedding",
  "Sikh wedding",
  "Muslim wedding",
];

const CEREMONIES = [
  "Sagan",
  "Engagement",
  "Cocktail",
  "Mehendi",
  "Haldi",
  "Sangeet",
  "Baraat",
  "Pheras",
  "Reception",
];

function cleanText(value, max = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, max);
}



function buildWeddingPrompt(basePrompt, weddingStyle, scenes) {
  if (!WEDDING_STYLES.includes(weddingStyle)) {
    throw new Error("Choose a valid wedding style.");
  }

  if (!Array.isArray(scenes) || scenes.length < 1 || scenes.length > 9) {
    throw new Error("Select between 1 and 9 wedding ceremonies.");
  }

  const selected = new Set();

  const sceneDescriptions = scenes.map((scene, index) => {
    if (!CEREMONIES.includes(scene.ceremony)) {
      throw new Error("Invalid ceremony selected.");
    }

    if (selected.has(scene.ceremony)) {
      throw new Error("A ceremony cannot be selected twice.");
    }

    selected.add(scene.ceremony);

    return `
SCENE ${index + 1}: ${scene.ceremony}

Visual description:
${cleanText(scene.description) ||
  `Show a beautiful ${scene.ceremony} wedding moment.`}

Location inspiration:
${cleanText(scene.location, 500) ||
  "Use an elegant culturally appropriate wedding setting."}

Bride outfit:
${cleanText(scene.brideOutfit, 300) ||
  "Use culturally appropriate bridal clothing."}

Groom outfit:
${cleanText(scene.groomOutfit, 300) ||
  "Use culturally appropriate groom clothing."}

Create this as a beautiful animated visual moment.
Do not write the ceremony name anywhere in the image.
`;
  });

  const finalPrompt = `
${cleanText(basePrompt, 5000)}

WEDDING STYLE:
${weddingStyle}

OUTPUT:
Create a premium animated Indian wedding film.
Vertical 9:16 format.
Use the uploaded couple photo as the identity reference.
Keep the couple recognisable throughout the video.

VISUAL SCENES:
${sceneDescriptions.join("\n")}

STRICT NO-TEXT RULES:
- Do not render any text anywhere in the video.
- No names, letters, words, numbers, dates or times.
- No ceremony titles, captions, subtitles or invitation lettering.
- No signs, banners, cards, boards or readable writing.
- No logos, watermarks, signatures or typography.
- Do not attempt to write the bride or groom names.
- Do not generate random decorative characters or fake writing.
- Keep the upper and lower portions visually clean for a later invitation overlay.
- Use visual decoration, flowers, lights, fabrics and ornaments instead of lettering.

SCENE RULES:
- Present scenes in the exact selected order.
- Do not introduce unselected ceremonies.
- Follow the supplied outfit and visual descriptions.
- Maintain the couple's identity and appearance consistently.
- Use smooth cinematic animation and graceful transitions.
- No spoken dialogue.
`;

  if (finalPrompt.length > 12000) {
    throw new Error(
      "Your wedding scene details are too long. Please shorten them."
    );
  }

  return finalPrompt.trim();
}


export async function serveAiReel(request, { store, apiKey = "", fetcher = fetch, now = Date.now() }) {
  const url = new URL(request.url), action = url.pathname.split("/").filter(Boolean).at(-1);
  const ready = Boolean(apiKey);
  if (request.method === "GET" && action === "config") return reply(200, { ready, message: ready ? "Review the estimated xAI credits before sending the photo." : "xAI video generation is not configured on this server." });
  if (request.method !== "POST" || !["quote", "generate", "status", "download"].includes(action)) return reply(405, { error: "Unsupported request." });
  if (!ready) return reply(503, { error: "AI generation is not configured on this server yet." });
  if (request.headers.get("origin") && request.headers.get("origin") !== url.origin) return reply(403, { error: "This request must come from this site." });
  const secret = hash(`${apiKey}:ai-reel`);
  try {
    const body = await request.json();
    if (action === "quote") {
     const basePrompt = String(body.prompt || "").trim();

if (basePrompt.length < 30 || basePrompt.length > 12000) {
  throw new Error("Use an animation prompt between 30 and 12,000 characters.");
}

if (!/^[a-f0-9]{64}$/.test(body.photoHash)) {
  throw new Error("Upload the couple photo again, then review the cost.");
}

const seconds = [5, 10, 15].includes(Number(body.seconds))
  ? Number(body.seconds)
  : 15;

const resolution = body.resolution === "480p" ? "480p" : "720p";

const weddingStyle = body.weddingStyle;
const scenes = body.scenes;

const finalPrompt =
  weddingStyle && scenes?.length
    ? buildWeddingPrompt(basePrompt, weddingStyle, scenes)
    : basePrompt;

const totalUsd = RATES[resolution] * seconds + 0.01;

const quote = {
  id: randomUUID(),
  model: MODEL,
  prompt: finalPrompt,
  weddingStyle: weddingStyle || null,
  scenes: scenes || [],
  resolution,
  seconds,
  photoHash: body.photoHash,
  totalUsd,
  expires: now + 600000,
};

return reply(200, {
  ...quote,
  token: sign(quote, secret),
});}
    const quote = verify(body.token, secret);
    if (now > quote.expires) return reply(409, { error: "This price confirmation expired. Review the cost again." });
    const key = `job-${quote.id}`;
    let job = await store.get(key);
    if (action === "download") {
      if (!job?.videoUrl || job.state !== "done") return reply(409, { error: "Your generated video is not ready to download yet." });
      const videoUrl = new URL(job.videoUrl);
      if (videoUrl.protocol !== "https:") return reply(400, { error: "The generated video link is not valid." });
      const upstream = await fetcher(videoUrl, { signal: AbortSignal.timeout(120000) });
      if (!upstream.ok) return reply(502, { error: "The provider video link has expired. Check progress again to refresh it." });
      const bytes = await upstream.arrayBuffer();
      if (!bytes.byteLength) return reply(502, { error: "The provider returned an empty video file." });
      return new Response(bytes, { headers: { "content-type": upstream.headers.get("content-type") || "video/mp4", "cache-control": "no-store", "content-length": String(bytes.byteLength) } });
    }
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
    // Recheck completed jobs too: xAI's delivery URL can expire before the user
    // presses Download, and this refreshes it without starting another paid video.
    if (["pending", "done"].includes(job.state) && job.requestId) {
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
