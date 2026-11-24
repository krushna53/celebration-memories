import {hasRepeatedGenerationPrompt,REPEATED_PROMPT_ERROR} from "./ai-prompt-audit.mjs";
import {validWeddingScenes} from './ai-wedding-scenes.mjs';
import {suggestionRequest,suggestionText,STORY_SUGGESTION_MODEL} from "./ai-story-suggestions.mjs";
import { FULL_PROMPT_LIMIT, SCENE_DESCRIPTION_LIMIT, STORY_TEXT_LIMIT } from "./ai-video-limits.mjs";
import { AI_CEREMONIES, AI_WEDDING_STYLES, weddingVideoPrompt } from "./ai-wedding-prompt.mjs";
export { weddingVideoPrompt } from "./ai-wedding-prompt.mjs";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { estimateAiVideo } from "./ai-video-pricing.mjs";
import { prepaidBalanceUsd } from "./ai-credits.mjs";
import { validStoryScene } from "./ai-story.mjs";

const styles = AI_WEDDING_STYLES;
const ceremonies = AI_CEREMONIES;
const reply = (status, data) => Response.json(data, { status, headers: { "cache-control": "no-store" } });
const hash = (value) => createHash("sha256").update(value).digest("hex");
export function providerCostUsd(result) {
  const raw = result?.usage?.cost_in_usd_ticks;
  if (raw === undefined || raw === null || raw === "") return null;
  const ticks = Number(raw);
  return Number.isSafeInteger(ticks) && ticks >= 0 ? ticks / 1e10 : null;
}
const equal = (a, b) => { const x = Buffer.from(a || ""), y = Buffer.from(b || ""); return x.length === y.length && timingSafeEqual(x, y); };
function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
function verify(token, secret, now) {
  if (typeof token !== "string" || token.length > 400000) throw new Error("Invalid confirmation. Review the cost again.");
  const [body, signature, extra] = token.split(".");
  if (extra || !signature || !equal(signature, createHmac("sha256", secret).update(body).digest("base64url"))) throw new Error("Invalid confirmation. Review the cost again.");
  const data = JSON.parse(Buffer.from(body, "base64url").toString());
  if (!/^[a-f0-9-]{36}$/.test(data.id) || !Number.isFinite(data.expires) || now > data.expires + 86400000) throw new Error("This generation session has expired.");
  return data;
}
async function readJson(request, limit) {
  const reader = request.body?.getReader(); let length = 0; const chunks = [];
  if (!reader) throw new Error("Missing request data.");
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > limit) { await reader.cancel(); throw new Error("Upload is too large. Use a photo under 3 MB."); } chunks.push(value); }
  return JSON.parse(Buffer.concat(chunks).toString());
}
function photoBytes(data) {
  const match = typeof data === "string" && data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new Error("Use a JPG, PNG or WebP photo.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 3000000) throw new Error("Use a photo under 3 MB.");
  const valid = match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : match[1] === "png" ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP";
  if (!valid) throw new Error("The photo file is not a valid supported image.");
  return bytes;
}
// store provides get/set/claim for per-job artifacts. claim must be atomic.
export async function serveAiVideo(request, { store, apiKey = "", accessCode = "", allowLocalAccess = false, managementKey = "", teamId = "", fetcher = fetch, now = Date.now() }) {
  const url = new URL(request.url); const action = url.pathname.replace(/\/$/, "").split("/").pop();
  const localAccess = allowLocalAccess && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const ready = Boolean(apiKey && (localAccess || accessCode.length >= 16));
  if (request.method === "GET" && action === "config") return reply(200, { ready, accessRequired: !localAccess, message: ready ? "Review estimated credits before sending your photo to xAI." : !apiKey ? "Server setup is incomplete: the xAI API key is missing. Add it to the server environment and restart." : "Server setup is incomplete: add a private generation access code of at least 16 characters and restart." });
  if (!["quote", "generate", "status", "media", "history", "balance", "suggest-story"].includes(action) || request.method !== "POST") return reply(405, { error: "Unsupported request." });
  if (!ready) return reply(503, { error: "AI generation is not configured on this server yet." });
  if (request.headers.get("origin") && request.headers.get("origin") !== url.origin) return reply(403, { error: "This request must come from the invitation site." });
  if (localAccess && request.headers.get("origin") !== url.origin) return reply(403, { error: "Local generation must be requested from this site." });
  if (!localAccess && !equal(request.headers.get("x-ai-access-code"), accessCode)) return reply(403, { error: "Enter the generation access code provided by the site owner." });
  const secret = hash(`${apiKey}:${accessCode}`);
  try {
    const body = await readJson(request, action === "generate" ? 4600000 : 256000);
    if(action === "suggest-story") {
      const payload=suggestionRequest(body);
      try {
        const upstream=await fetcher('https://api.x.ai/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
        if(!upstream.ok)return reply(502,{error:'AI story suggestions are unavailable. Check text-model access or xAI usage. Your story has not changed.'});
        const result=await upstream.json();
        return reply(200,{suggestion:suggestionText(result,body.maxCharacters === SCENE_DESCRIPTION_LIMIT?SCENE_DESCRIPTION_LIMIT:STORY_TEXT_LIMIT),model:STORY_SUGGESTION_MODEL,actualCostUsd:providerCostUsd(result)});
      }catch{return reply(503,{error:'Could not finish the AI suggestion. Your original story is unchanged; no automatic retry was made.'});}
    }
    if (action === "balance") {
      if (!managementKey || !teamId) return reply(200, { available: false, reason: "Remaining credits are not connected yet. Check your balance in xAI Console." });
      try {
        const upstream = await fetcher(`https://management-api.x.ai/v1/billing/teams/${encodeURIComponent(teamId)}/prepaid/balance`, { headers: { Authorization: `Bearer ${managementKey}` }, signal: AbortSignal.timeout(15000) });
        if (!upstream.ok) return reply(200, { available: false, reason: "Could not read remaining credits from xAI. Check Management API permissions." });
        const remainingUsd = prepaidBalanceUsd(await upstream.json());
        return reply(200, remainingUsd === null ? { available: false, reason: "xAI returned an unrecognised balance format." } : { available: true, remainingUsd, checkedAt: now });
      } catch { return reply(200, { available: false, reason: "Remaining credits could not be refreshed. Check xAI Console." }); }
    }
    if (action === "history") {
      const records = store.list ? await store.list() : [];
      const clips = records.filter(({key,job}) => /^job-[a-f0-9-]{36}$/.test(key) && job?.state === "done" && job.videoUrl)
        .sort((a,b)=>(b.job.created||0)-(a.job.created||0)).map(({key,job})=> {
          const { requestId, ...visible } = job;
          return { ...visible, id:key.slice(4), token:sign({ id:key.slice(4),expires:now+600000 },secret) };
        });
      return reply(200,{clips});
    }
    if (action === "quote") {
      const estimate = estimateAiVideo(body);
      if (!styles.includes(body.style) || !ceremonies.includes(body.ceremony) || !/^[a-f0-9]{64}$/.test(body.photoHash)) throw new Error("Choose a valid photo, wedding style and ceremony.");
      if (body.promptMode !== undefined && body.promptMode !== "replace") throw new Error("Invalid prompt mode.");
      const promptLimit = body.promptMode === "replace" ? FULL_PROMPT_LIMIT : 1200;
      if (body.customPrompt !== undefined && (typeof body.customPrompt !== "string" || body.customPrompt.length > promptLimit)) throw new Error(`Prompt must be under ${promptLimit} characters.`);
      if (body.promptMode === "replace" && !body.customPrompt?.trim()) throw new Error("Enter an animation prompt before reviewing the cost.");
      if (hasRepeatedGenerationPrompt(body.customPrompt)) throw new Error(REPEATED_PROMPT_ERROR);
      if (!validStoryScene(body.storyScene)) throw new Error("Invalid story scene details.");
      if (!validWeddingScenes(body.weddingScenes) || body.ceremony === 'story' && body.weddingScenes !== undefined) throw new Error('Invalid ceremony scene details.');
      if (body.weddingLayout !== undefined && !['invitation','cinematic'].includes(body.weddingLayout)) throw new Error('Invalid invitation look.');
      if (body.ceremony === "story" && (!body.storyScene || body.promptMode !== "replace")) throw new Error("Describe your story scene before reviewing credits.");
      const quote = { ...estimate, storyScene:body.storyScene,weddingScenes:body.weddingScenes,weddingLayout:body.weddingLayout, customPrompt: body.customPrompt || "", promptMode: body.promptMode, style: body.style, ceremony: body.ceremony, photoHash: body.photoHash, id: randomUUID(), expires: now + 600000 };
      return reply(200, { ...quote, token: sign(quote, secret) });
    }
    const q = verify(body.token, secret, now);
    const key = `job-${q.id}`;
    let job = await store.get(key);
    if (action === "generate") {
      if (body.confirmed !== true) return reply(400, { error: "Confirm the displayed price before generating." });
      if (job) { const { requestId, ...visible } = job; return reply(200, visible); }
      if (now > q.expires) return reply(409, { error: "Price confirmation expired. Review the cost again." });
      if (hasRepeatedGenerationPrompt(q.customPrompt)) return reply(409,{error:REPEATED_PROMPT_ERROR});
      const bytes = photoBytes(body.image);
      if (hash(bytes) !== q.photoHash) return reply(409, { error: "The photo changed. Review the cost again." });
      const current = estimateAiVideo(q);
      if (current.totalCents !== q.totalCents) return reply(409, { error: "Pricing changed. Review the cost again." });
      job = { state: "starting", estimatedCents: q.totalCents, model: q.model, seconds: q.seconds, resolution: q.resolution, ceremony: q.ceremony, style:q.style, customPrompt:q.customPrompt, promptMode:q.promptMode, storyScene:q.storyScene,weddingScenes:q.weddingScenes,weddingLayout:q.weddingLayout, created: now };
      if (!await store.claim(key, job)) { const { requestId, ...visible } = await store.get(key) || job; return reply(202, visible); }
      // Never retry this POST automatically: an interrupted response may still be billed.
      try {
        const upstream = await fetcher("https://api.x.ai/v1/videos/generations", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model: q.model, prompt: q.promptMode === "replace" ? q.customPrompt : weddingVideoPrompt(q.style, q.ceremony, q.seconds, q.customPrompt), image:{url:body.image}, duration: q.seconds, resolution: q.resolution, aspect_ratio: "9:16" }), signal: AbortSignal.timeout(25000) });
        const result = await upstream.json();
        const actualCostUsd = providerCostUsd(result);
        if (actualCostUsd !== null) job = { ...job, actualCostUsd };
        if (!upstream.ok) {
          job = { ...job, state: "failed", error: upstream.status === 402 || upstream.status === 429 ? "Provider credits or usage limit reached. Check xAI billing and usage before trying again." : "xAI rejected this generation. Check API permissions, model access and billing. No automatic retry was made." };
        } else if (typeof result.request_id === "string" && /^[A-Za-z0-9_-]{1,150}$/.test(result.request_id)) job = { ...job, state: "pending", requestId: result.request_id };
        else job = { ...job, state: "unknown", error: "Provider response was incomplete. Check xAI usage before starting another paid generation." };
      } catch { job = { ...job, state: "unknown", error: "Connection interrupted after submission. The request may be billed. Check xAI usage; it will not be retried automatically." }; }
      await store.set(key, job);
      const { requestId, ...visible } = job; return reply(202, visible);
    }
    if (!job) return reply(404, { error: "Generation not found. No paid request was submitted for this quote." });
    if (action === "media") {
      if (job.state !== "done" || !job.videoUrl) return reply(409, { error: "This video is not ready." });
      const media = new URL(job.videoUrl);
      if (media.protocol !== "https:" || !["x.ai", "grok.com"].some(host => media.hostname === host || media.hostname.endsWith(`.${host}`))) throw new Error("Unexpected video URL from provider.");
      const upstream = await fetcher(media.href, { redirect: "error", signal: AbortSignal.timeout(60000) });
      if (!upstream.ok) {
        const reason=upstream.status===403?(await upstream.text()).slice(0,6000):"";
        const expired=[404,410].includes(upstream.status) || upstream.status===403 && /ExpiredToken|Request has expired|RequestExpired|Signature has expired/i.test(reason);
        return reply(expired?410:503,{code:expired?"VIDEO_EXPIRED":"VIDEO_TEMPORARY",error:expired?"This provider video has expired.":"Video temporarily unavailable. Retry when the connection or provider recovers."});
      }
      return new Response(upstream.body, { headers: { "content-type": "video/mp4", "cache-control": "no-store" } });
    }
    if ((job.state === "pending" || (job.state === "done" && !Number.isFinite(job.actualCostUsd))) && job.requestId) {
      let upstream;
      try {
        upstream = await fetcher(`https://api.x.ai/v1/videos/${encodeURIComponent(job.requestId)}`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20000) });
      } catch (error) {
        // The server couldn't reach xAI this time (network drop, DNS, timeout). The video keeps generating at xAI.
        return reply(503, { code: "STATUS_RETRY", error: `Couldn't reach xAI to check progress (${networkReason(error)}). Your video is still generating; do not start another one.` });
      }
      if (!upstream.ok) return reply(503, { code: "STATUS_RETRY", error: "Could not check progress. Resume checking; do not start another generation." });
      const result = await upstream.json();
      const actualCostUsd = providerCostUsd(result);
      if (actualCostUsd !== null) { job = { ...job, actualCostUsd }; await store.set(key, job); }
      if (result.status === "done") {
        const video = new URL(result.video?.url);
        if (video.protocol !== "https:" || !["x.ai", "grok.com"].some((host) => video.hostname === host || video.hostname.endsWith(`.${host}`))) throw new Error("Unexpected video URL from provider.");
        job = { ...job, state: "done", videoUrl: video.href }; await store.set(key, job);
      } else if (result.status === "failed") { const reason = String(result.error?.message || result.error?.code || (typeof result.error === "string" ? result.error : "") || result.failure_reason || result.reason || result.message || "").slice(0, 300); job = { ...job, state: "failed", providerReason: reason, error: "Video generation failed" + (reason ? " (xAI: " + reason + ")" : "") + ". Check xAI usage for any charge. Regeneration requires a new price confirmation." }; await store.set(key, job); }
    }
    const { requestId, ...visible } = job; return reply(200, visible);
  } catch (error) {
    if (error?.message === "fetch failed" || error?.name === "TimeoutError") return reply(503, { error: `Couldn't reach xAI (${networkReason(error)}). Check this server's internet connection and try again.` });
    return reply(400, { error: error instanceof SyntaxError ? "Invalid request data." : error.message || "Could not process this request." });
  }
}

/** Short reason for a failed server-side fetch: Node reports only "fetch failed" and keeps the real cause in error.cause. */
function networkReason(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "timed out";
  const cause = error?.cause;
  return String(cause?.code || cause?.message || error?.message || "network error").slice(0, 80);
}
