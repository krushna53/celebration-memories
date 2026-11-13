import crypto from "node:crypto";

export const runtime = "nodejs";

const XAI_URL = "https://api.x.ai/v1/videos/generations";
const jobs = new Map();
const MAX_IMAGE_CHARS = 4_500_000;

function price(seconds, resolution) {
  const rate = resolution === "480p" ? 0.02 : 0.03;
  return Number((Number(seconds) * rate + 0.01).toFixed(2));
}
function clean(value, max = 600) { return String(value || "").replace(/[<>]/g, "").trim().slice(0, max); }
function makePrompt(body) {
  const scenes = Array.isArray(body.scenes) ? body.scenes.slice(0, 6) : [];
  const sceneText = scenes.map((scene, index) => {
    const title = clean(scene.title, 70);
    const description = clean(scene.description, 500);
    const venue = clean(scene.venue, 120);
    const bride = clean(scene.brideOutfit, 120);
    const groom = clean(scene.groomOutfit, 120);
    return `Scene ${index + 1} — ${title}: ${description}${venue ? ` Setting: ${venue}.` : ""}${bride ? ` Bride outfit: ${bride}.` : ""}${groom ? ` Groom outfit: ${groom}.` : ""}`;
  }).join("\n");
  return `Use the uploaded couple photograph only as identity reference. Render them as consistent, clearly illustrated stylized 3D animated characters from the very first frame — never display the original photo, a portrait reveal, slideshow, collage or photorealistic face. Keep their facial likeness recognizable, with expressive animated eyes, gentle smiles, natural body language and smooth cinematic camera movement. Create a ${clean(body.type) === "journey" ? "romantic relationship journey" : `${clean(body.style, 80) || "Indian wedding"} invitation`} in a vertical 9:16 film. ${clean(body.direction, 1200)}. Each scene should flow naturally into the next; do not replay earlier scenes. No written text, dates, logos, watermarks, dialogue, voiceover, lip-sync or singing. Leave the upper third visually calm for optional lettering added in the website editor.\n\n${sceneText}`;
}
function sign(payload) {
  const key = process.env.XAI_API_KEY || "local-video-preview";
  return crypto.createHmac("sha256", key).update(payload).digest("base64url");
}
function tokenFor(payload) { const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url"); return `${encoded}.${sign(encoded)}`; }
function parseToken(token) {
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(encoded)))) throw new Error("Your review has expired. Review the generation again.");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (payload.expires < Date.now()) throw new Error("Your review has expired. Review the generation again.");
  return payload;
}
function videoUrl(data) {
  return data?.video_url || data?.url || data?.video?.url || data?.output?.url || data?.data?.[0]?.url || null;
}
function visible(job) {
  return { id: job.id, status: job.status, videoUrl: job.videoUrl || null, actualCredits: job.actualCredits ?? null, error: job.error || null };
}

export async function GET(_request, { params }) {
  const { action } = await params;
  if (action === "config") return Response.json({ ready: Boolean(process.env.XAI_API_KEY), message: process.env.XAI_API_KEY ? "AI video is ready for local testing." : "Generation is off until XAI_API_KEY is added to this project's .env file, then the dev server is restarted." });
  return Response.json({ error: "Unknown AI video request." }, { status: 404 });
}

export async function POST(request, { params }) {
  const { action } = await params;
  try {
    const body = await request.json();
    if (action === "quote") {
      const seconds = [5, 10, 15].includes(Number(body.duration)) ? Number(body.duration) : 15;
      const resolution = body.resolution === "480p" ? "480p" : "720p";
      const prompt = makePrompt(body);
      if (!Array.isArray(body.scenes) || !body.scenes.length) throw new Error("Add at least one scene before continuing.");
      const payload = { id: crypto.randomUUID(), expires: Date.now() + 15 * 60_000, seconds, resolution, prompt, estimate: price(seconds, resolution) };
      return Response.json({ token: tokenFor(payload), estimate: payload.estimate.toFixed(2), summary: `${seconds}-second ${resolution} vertical animated video` });
    }
    if (action === "generate") {
      if (!process.env.XAI_API_KEY) return Response.json({ error: "Add XAI_API_KEY to .env and restart the local dev server before generation." }, { status: 503 });
      const quote = parseToken(body.token);
      if (!String(body.image || "").startsWith("data:image/") || String(body.image).length > MAX_IMAGE_CHARS) throw new Error("Upload a JPG, PNG or WebP photo under 3 MB.");
      const provider = await fetch(XAI_URL, { method: "POST", headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "grok-imagine-video-1.5-lite", prompt: quote.prompt, image: { url: body.image }, duration: quote.seconds, resolution: quote.resolution, aspect_ratio: "9:16" }) });
      const data = await provider.json().catch(() => ({}));
      if (!provider.ok) throw new Error(data?.error?.message || data?.message || "xAI did not accept the video request.");
      const url = videoUrl(data);
      const job = { id: quote.id, providerId: data?.request_id || data?.id || data?.data?.id || null, status: url ? "completed" : "processing", videoUrl: url, actualCredits: data?.usage?.cost ?? null };
      jobs.set(quote.id, job);
      return Response.json(visible(job));
    }
    if (action === "status") {
      const job = jobs.get(clean(body.id, 100));
      if (!job) return Response.json({ error: "This local video job is no longer available. Do not generate it again without checking xAI usage." }, { status: 404 });
      if (job.status === "processing" && job.providerId) {
        const provider = await fetch(`https://api.x.ai/v1/videos/${encodeURIComponent(job.providerId)}`, { headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` } });
        if (!provider.ok) return Response.json({ error: "Could not check progress. Please wait and try again; do not create another paid request." }, { status: 503 });
        const data = await provider.json().catch(() => ({}));
        job.actualCredits = data?.usage?.cost ?? job.actualCredits;
        if (data.status === "done" || data.status === "completed") { job.status = "completed"; job.videoUrl = videoUrl(data); }
        if (data.status === "failed") { job.status = "failed"; job.error = data?.error?.message || "xAI could not complete this video."; }
        jobs.set(job.id, job);
      }
      return Response.json(visible(job));
    }
    return Response.json({ error: "Unknown AI video request." }, { status: 404 });
  } catch (error) { return Response.json({ error: error.message || "AI video request failed." }, { status: 400 }); }
}
