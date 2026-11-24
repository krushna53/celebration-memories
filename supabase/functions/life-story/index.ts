// Supabase Edge Function — Life Story: biography chapters + narrated film.
//
//   { action: "structure", lifeStoryId }  AI reads the story + photos → chapters, captions, film script (background task)
//   { action: "film_start", renderId }    voiceover (OpenAI TTS) for every scene + Grok Imagine clips submitted (background task)
//   { action: "film_tick", renderId }     polled by /admin/life-story every few seconds — advances the render one step
//
// Render state machine (life_story_renders.status):
//   preparing  — film_start is voicing scenes and submitting Grok clips
//   animating  — waiting on Grok Imagine (xAI) clips; failed/moderated clips fall back to pan/zoom
//   submitting — one tick won the race to build the Shotstack edit (conditional update, so it's sent once)
//   rendering  — waiting on Shotstack; the finished MP4 is copied into our own `videos` bucket
//   done | error
//
// Auth: only the Next.js server calls this (services/life-story.ts), with
// the service-role key, after requireAdminForEvent() and the per-event
// quota check. Deployed with verify_jwt on (the gateway checks the JWT
// signature) and isServiceCaller() then requires the service_role claim, so
// a guest's or host's own token gets 401 and can't run up OpenAI / xAI /
// Shotstack costs. Nothing here
// trusts a URL from the caller — every input is re-read from the database
// and every media URL is signed here.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import { buildFilmEdit, clipRequestSeconds, pcmSeconds, pcmToWav, type Motion } from "./edit.ts";
import { MAX_AI_PHOTOS, speak, structureStory, type Language } from "./structure.ts";

/** Long enough for xAI's and Shotstack's queues to fetch every input. */
const SIGNED_URL_SECONDS = 6 * 60 * 60;
const XAI_TICKS_PER_USD = 10_000_000_000;
/** A Grok clip still pending after this long is given up on (that scene falls back to pan/zoom). */
const GROK_GIVE_UP_MS = 40 * 60 * 1000;

// Same royalty-free Shotstack-hosted tracks as lib/life-story.ts's FILM_MUSIC keys.
const MUSIC: Record<string, string | null> = {
  heartfelt: "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/ambisax.mp3",
  cinematic: "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/freepd/motions.mp3",
  celebration: "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/freepd/fireworks.mp3",
  none: null,
};

interface StoryRow {
  id: string;
  event_id: string;
  subject_name: string;
  title: string;
  subtitle: string;
  life_span: string;
  story_text: string;
  narration_language: Language;
  cover_photo_id: string | null;
}

interface RenderRow {
  id: string;
  life_story_id: string;
  event_id: string;
  status: string;
  music: string;
  shotstack_render_id: string | null;
  result_path: string | null;
  xai_cost_usd: number;
  error_message: string | null;
  progress_note: string;
  created_at: string;
}

interface RenderSceneRow {
  id: string;
  sort_order: number;
  photo_path: string | null;
  narration: string;
  caption: string;
  motion: Motion;
  animate: boolean;
  animation_prompt: string;
  narration_path: string | null;
  narration_seconds: number | null;
  xai_request_id: string | null;
  clip_status: "none" | "pending" | "ready" | "fallback";
  clip_path: string | null;
  clip_seconds: number | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function errorText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 2000);
}

function env(name: string): string | null {
  return Deno.env.get(name) || null;
}

async function signed(db: SupabaseClient, bucket: string, path: string): Promise<string> {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data) throw new Error(`Couldn't sign ${bucket}/${path}: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}

/** Runs `worker` over `items` with at most `limit` in flight. */
async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await worker(queue.shift()!);
    }),
  );
}

// ---------------------------------------------------------------------------
// structure
// ---------------------------------------------------------------------------

async function runStructure(db: SupabaseClient, lifeStoryId: string): Promise<void> {
  const fail = (message: string) =>
    db.from("life_stories").update({ structure_status: "error", structure_error: message, updated_at: new Date().toISOString() }).eq("id", lifeStoryId);

  try {
    const apiKey = env("OPENAI_API_KEY");
    if (!apiKey) throw new Error("AI isn't configured (OPENAI_API_KEY is not set).");

    const { data: story, error } = await db
      .from("life_stories")
      .select("id, event_id, subject_name, title, subtitle, life_span, story_text, narration_language, cover_photo_id")
      .eq("id", lifeStoryId)
      .single<StoryRow>();
    if (error || !story) throw new Error("Life story not found.");
    if (story.story_text.trim().length < 200) throw new Error("The story is too short — add at least a few paragraphs.");

    const { data: photoRows, error: photoError } = await db
      .from("life_story_photos")
      .select("id, storage_path, caption")
      .eq("life_story_id", lifeStoryId)
      .order("sort_order")
      .order("created_at")
      .limit(MAX_AI_PHOTOS);
    if (photoError) throw new Error(photoError.message);
    const rows = (photoRows ?? []) as { id: string; storage_path: string; caption: string }[];

    const photos = await Promise.all(
      rows.map(async (p, i) => ({ ref: `P${i + 1}`, id: p.id, caption: p.caption, url: await signed(db, "gallery", p.storage_path) })),
    );
    const idByRef = new Map(photos.map((p) => [p.ref, p.id]));
    const maxAnimated = Math.max(0, Number(env("LIFE_STORY_MAX_ANIMATED_SCENES") ?? 6) || 0);

    const { story: result } = await structureStory({
      apiKey,
      model: env("OPENAI_TEXT_MODEL") || "gpt-5.6-luna",
      subjectName: story.subject_name,
      language: story.narration_language,
      storyText: story.story_text,
      photos,
      maxAnimated,
    });

    // Replace chapters and scenes wholesale — this is a (re)generate.
    await db.from("life_story_scenes").delete().eq("life_story_id", lifeStoryId);
    await db.from("life_story_photos").update({ chapter_id: null }).eq("life_story_id", lifeStoryId);
    await db.from("life_story_chapters").delete().eq("life_story_id", lifeStoryId);

    const { data: chapterRows, error: chapterError } = await db
      .from("life_story_chapters")
      .insert(result.chapters.map((c, i) => ({ life_story_id: lifeStoryId, sort_order: i, title: c.title, period: c.period, body: c.body })))
      .select("id, sort_order");
    if (chapterError) throw new Error(`Couldn't save chapters: ${chapterError.message}`);
    const chapterIdByOrder = new Map((chapterRows ?? []).map((c: { id: string; sort_order: number }) => [c.sort_order, c.id]));

    // Photo order follows the chapters; photos the AI didn't place keep their relative order at the end.
    const placement = new Map<string, { chapterId: string; order: number }>();
    let order = 0;
    result.chapters.forEach((c, i) => {
      for (const ref of c.photoRefs) placement.set(ref, { chapterId: chapterIdByOrder.get(i)!, order: order++ });
    });
    const details = new Map(result.photos.map((p) => [p.ref, p]));
    await pool(photos, 6, async (p) => {
      const place = placement.get(p.ref);
      const detail = details.get(p.ref);
      const update: Record<string, unknown> = {
        chapter_id: place?.chapterId ?? null,
        sort_order: place ? place.order : order++,
      };
      if (detail) {
        if (!p.caption) update.caption = detail.caption;
        update.year_label = detail.yearLabel;
        update.ai_description = detail.description;
      }
      await db.from("life_story_photos").update(update).eq("id", p.id);
    });

    const { error: sceneError } = await db.from("life_story_scenes").insert(
      result.scenes.map((s, i) => ({
        life_story_id: lifeStoryId,
        sort_order: i,
        photo_id: s.photoRef ? idByRef.get(s.photoRef) ?? null : null,
        narration: s.narration,
        caption: s.caption,
        motion: s.motion,
        animate: s.animate,
        animation_prompt: s.animationPrompt,
      })),
    );
    if (sceneError) throw new Error(`Couldn't save the film script: ${sceneError.message}`);

    await db
      .from("life_stories")
      .update({
        // Never overwrite what the host typed themselves.
        title: story.title || result.title || story.subject_name,
        subtitle: story.subtitle || result.subtitle,
        life_span: story.life_span || result.lifeSpan,
        cover_photo_id: story.cover_photo_id ?? photos[0]?.id ?? null,
        structure_status: "done",
        structure_error: null,
        structured_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lifeStoryId);
  } catch (err) {
    console.error(`life-story structure ${lifeStoryId}:`, errorText(err));
    await fail(errorText(err));
  }
}

// ---------------------------------------------------------------------------
// film_start
// ---------------------------------------------------------------------------

async function loadRender(db: SupabaseClient, renderId: string): Promise<{ render: RenderRow; scenes: RenderSceneRow[] } | null> {
  const { data: render } = await db
    .from("life_story_renders")
    .select("id, life_story_id, event_id, status, music, shotstack_render_id, result_path, xai_cost_usd, error_message, progress_note, created_at")
    .eq("id", renderId)
    .maybeSingle<RenderRow>();
  if (!render) return null;
  const { data: scenes } = await db
    .from("life_story_render_scenes")
    .select(
      "id, sort_order, photo_path, narration, caption, motion, animate, animation_prompt, narration_path, narration_seconds, xai_request_id, clip_status, clip_path, clip_seconds",
    )
    .eq("render_id", renderId)
    .order("sort_order");
  return { render, scenes: (scenes ?? []) as RenderSceneRow[] };
}

const setRender = (db: SupabaseClient, renderId: string, values: Record<string, unknown>) =>
  db.from("life_story_renders").update({ ...values, updated_at: new Date().toISOString() }).eq("id", renderId);

async function submitGrokClip(params: { apiKey: string; imageUrl: string; prompt: string; seconds: number }): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/videos/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${params.apiKey}` },
    body: JSON.stringify({
      model: env("XAI_VIDEO_MODEL") || "grok-imagine-video-1.5-lite",
      prompt:
        `${params.prompt.trim() || "A gentle, slow camera push-in."} ` +
        "Subtle, realistic motion that stays true to the original photograph. Keep every person and face exactly as they are. No new people, no text, no speaking.",
      image: { url: params.imageUrl },
      duration: params.seconds,
      resolution: env("XAI_VIDEO_RESOLUTION") || "720p",
      generate_audio: false,
    }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.request_id) throw new Error(`Grok Imagine refused the clip (${res.status}): ${payload?.error?.message ?? payload?.error ?? "unknown error"}`);
  return String(payload.request_id);
}

async function runFilmStart(db: SupabaseClient, renderId: string): Promise<void> {
  try {
    const openaiKey = env("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("AI voiceover isn't configured (OPENAI_API_KEY is not set).");
    if (!env("SHOTSTACK_API_KEY")) throw new Error("Video rendering isn't configured (SHOTSTACK_API_KEY is not set).");

    const loaded = await loadRender(db, renderId);
    if (!loaded || loaded.render.status !== "preparing") return;
    const { render, scenes } = loaded;
    const { data: story } = await db.from("life_stories").select("narration_language").eq("id", render.life_story_id).single<{ narration_language: Language }>();
    const language = story?.narration_language ?? "english";
    const base = `${render.event_id}/life-story/${renderId}`;

    let voiced = 0;
    await pool(scenes.filter((s) => s.narration.trim()), 4, async (scene) => {
      const pcm = await speak({ apiKey: openaiKey, text: scene.narration, language });
      const path = `${base}/narration-${scene.sort_order}.wav`;
      const { error } = await db.storage.from("audio").upload(path, pcmToWav(pcm), { contentType: "audio/wav", upsert: true });
      if (error) throw new Error(`Couldn't save the voiceover: ${error.message}`);
      scene.narration_seconds = pcmSeconds(pcm.length);
      await db.from("life_story_render_scenes").update({ narration_path: path, narration_seconds: scene.narration_seconds }).eq("id", scene.id);
      voiced++;
      if (voiced % 5 === 0) await setRender(db, renderId, { progress_note: `Recorded narration for ${voiced} of ${scenes.length} scenes…` });
    });

    const xaiKey = env("XAI_API_KEY");
    const toAnimate = scenes.filter((s) => s.animate && s.photo_path);
    await pool(toAnimate, 3, async (scene) => {
      if (!xaiKey) {
        await db.from("life_story_render_scenes").update({ clip_status: "fallback", clip_error: "Grok Imagine isn't configured (XAI_API_KEY)." }).eq("id", scene.id);
        return;
      }
      try {
        const requestId = await submitGrokClip({
          apiKey: xaiKey,
          imageUrl: await signed(db, "gallery", scene.photo_path!),
          prompt: scene.animation_prompt,
          seconds: clipRequestSeconds(scene.narration_seconds ?? 0),
        });
        await db.from("life_story_render_scenes").update({ clip_status: "pending", xai_request_id: requestId }).eq("id", scene.id);
      } catch (err) {
        // One refused clip shouldn't sink the film — that scene just uses pan/zoom.
        await db.from("life_story_render_scenes").update({ clip_status: "fallback", clip_error: errorText(err) }).eq("id", scene.id);
      }
    });

    await setRender(db, renderId, {
      status: "animating",
      progress_note: toAnimate.length && xaiKey ? `Bringing ${toAnimate.length} photo(s) to life with Grok Imagine…` : "Assembling the film…",
    });
  } catch (err) {
    console.error(`life-story film_start ${renderId}:`, errorText(err));
    await setRender(db, renderId, { status: "error", error_message: errorText(err) });
  }
}

// ---------------------------------------------------------------------------
// film_tick
// ---------------------------------------------------------------------------

async function pollGrokClips(db: SupabaseClient, render: RenderRow, scenes: RenderSceneRow[]): Promise<void> {
  const xaiKey = env("XAI_API_KEY");
  let costUsd = Number(render.xai_cost_usd) || 0;
  for (const scene of scenes.filter((s) => s.clip_status === "pending" && s.xai_request_id)) {
    try {
      const res = await fetch(`https://api.x.ai/v1/videos/${scene.xai_request_id}`, { headers: { Authorization: `Bearer ${xaiKey}` } });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload) continue; // transient — try again next tick
      const status = String(payload.status ?? "");
      if (status === "pending") continue;
      costUsd += (Number(payload.usage?.cost_in_usd_ticks) || 0) / XAI_TICKS_PER_USD;

      const url = payload.video?.url;
      if (status !== "done" || !url || payload.video?.respect_moderation === false) {
        const reason = payload.error?.message ?? (payload.video?.respect_moderation === false ? "The clip was held back by Grok's moderation." : `Grok Imagine status: ${status}`);
        Object.assign(scene, { clip_status: "fallback" });
        await db.from("life_story_render_scenes").update({ clip_status: "fallback", clip_error: String(reason).slice(0, 500) }).eq("id", scene.id);
        continue;
      }
      // Grok's URL is temporary — keep our own copy.
      const clip = await fetch(url);
      if (!clip.ok) continue;
      const path = `${render.event_id}/life-story/${render.id}/clip-${scene.sort_order}.mp4`;
      const { error } = await db.storage.from("videos").upload(path, new Uint8Array(await clip.arrayBuffer()), { contentType: "video/mp4", upsert: true });
      if (error) throw new Error(error.message);
      const seconds = Number(payload.video?.duration) || null;
      Object.assign(scene, { clip_status: "ready", clip_path: path, clip_seconds: seconds });
      await db.from("life_story_render_scenes").update({ clip_status: "ready", clip_path: path, clip_seconds: seconds }).eq("id", scene.id);
    } catch (err) {
      Object.assign(scene, { clip_status: "fallback" });
      await db.from("life_story_render_scenes").update({ clip_status: "fallback", clip_error: errorText(err).slice(0, 500) }).eq("id", scene.id);
    }
  }
  if (costUsd !== Number(render.xai_cost_usd)) await setRender(db, render.id, { xai_cost_usd: costUsd });
}

async function submitShotstack(db: SupabaseClient, render: RenderRow, scenes: RenderSceneRow[]): Promise<void> {
  const { data: story } = await db
    .from("life_stories")
    .select("subject_name, title, subtitle, life_span, cover_photo_id")
    .eq("id", render.life_story_id)
    .single<{ subject_name: string; title: string; subtitle: string; life_span: string; cover_photo_id: string | null }>();
  if (!story) throw new Error("Life story not found.");
  let coverPath: string | null = null;
  if (story.cover_photo_id) {
    const { data } = await db.from("life_story_photos").select("storage_path").eq("id", story.cover_photo_id).maybeSingle<{ storage_path: string }>();
    coverPath = data?.storage_path ?? null;
  }

  const { edit, durationSeconds } = buildFilmEdit({
    title: story.title || story.subject_name,
    subtitle: story.subtitle,
    lifeSpan: story.life_span,
    coverUrl: coverPath ? await signed(db, "gallery", coverPath) : null,
    musicUrl: MUSIC[render.music] ?? null,
    scenes: await Promise.all(
      scenes.map(async (s) => ({
        photoUrl: s.photo_path ? await signed(db, "gallery", s.photo_path) : null,
        clipUrl: s.clip_status === "ready" && s.clip_path ? await signed(db, "videos", s.clip_path) : null,
        clipSeconds: s.clip_seconds === null ? null : Number(s.clip_seconds),
        narrationUrl: s.narration_path ? await signed(db, "audio", s.narration_path) : null,
        narrationSeconds: Number(s.narration_seconds) || 0,
        caption: s.caption,
        motion: s.motion,
      })),
    ),
  });

  const res = await fetch(`https://api.shotstack.io/edit/${env("SHOTSTACK_ENV") || "v1"}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": env("SHOTSTACK_API_KEY")! },
    body: JSON.stringify(edit),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.response?.id) throw new Error(`Shotstack rejected the film (${res.status}): ${payload?.message ?? payload?.response?.message ?? "unknown error"}`);
  await setRender(db, render.id, {
    status: "rendering",
    shotstack_render_id: payload.response.id,
    duration_seconds: durationSeconds,
    progress_note: `Rendering a ${Math.round(durationSeconds / 60) || 1}-minute film…`,
  });
}

async function pollShotstack(db: SupabaseClient, render: RenderRow): Promise<void> {
  const res = await fetch(`https://api.shotstack.io/edit/${env("SHOTSTACK_ENV") || "v1"}/render/${render.shotstack_render_id}`, {
    headers: { "x-api-key": env("SHOTSTACK_API_KEY")! },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.response) return; // transient — the browser polls again shortly
  const { status, url, error } = payload.response as { status: string; url?: string; error?: string };
  if (status === "failed") {
    await setRender(db, render.id, { status: "error", error_message: `Shotstack couldn't render the film${error ? `: ${error}` : "."}`.slice(0, 2000) });
    return;
  }
  if (status !== "done" || !url) return;

  const video = await fetch(url);
  if (!video.ok) throw new Error(`Couldn't download the finished film (${video.status}).`);
  const path = `${render.event_id}/life-story/${render.id}/film.mp4`;
  const { error: uploadError } = await db.storage.from("videos").upload(path, new Uint8Array(await video.arrayBuffer()), { contentType: "video/mp4", upsert: true });
  if (uploadError) throw new Error(`Couldn't save the finished film: ${uploadError.message}`);
  await setRender(db, render.id, { status: "done", result_path: path, progress_note: "Your film is ready." });
}

/** How long one film_tick may hold the render before another poll can take over. */
const TICK_LEASE_SECONDS = 120;

async function advanceRender(db: SupabaseClient, renderId: string): Promise<void> {
  const loaded = await loadRender(db, renderId);
  if (!loaded) return;
  const { render, scenes } = loaded;
  try {
    if (render.status === "animating") {
      await pollGrokClips(db, render, scenes);
      if (Date.now() - new Date(render.created_at).getTime() > GROK_GIVE_UP_MS) {
        for (const scene of scenes.filter((s) => s.clip_status === "pending")) {
          scene.clip_status = "fallback";
          await db.from("life_story_render_scenes").update({ clip_status: "fallback", clip_error: "Grok Imagine took too long." }).eq("id", scene.id);
        }
      }
      if (scenes.every((s) => s.clip_status !== "pending")) {
        // Only the tick that flips animating → submitting sends the render.
        const { data: won } = await db
          .from("life_story_renders")
          .update({ status: "submitting", progress_note: "Assembling the film…", updated_at: new Date().toISOString() })
          .eq("id", renderId)
          .eq("status", "animating")
          .select("id");
        if (won?.length) await submitShotstack(db, render, scenes);
      }
    } else if (render.status === "rendering" && render.shotstack_render_id) {
      await pollShotstack(db, render);
    }
  } catch (err) {
    console.error(`life-story film_tick ${renderId}:`, errorText(err));
    await setRender(db, renderId, { status: "error", error_message: errorText(err) });
  } finally {
    await db.from("life_story_renders").update({ tick_lease_until: null }).eq("id", renderId);
  }
}

/**
 * Claims a short lease and advances the render in the background, so the
 * caller (a Next.js Server Action on Netlify) never waits on a clip or film
 * download. A poll that finds the lease held just reports the status.
 */
async function runFilmTick(db: SupabaseClient, renderId: string): Promise<Response> {
  const nowIso = new Date().toISOString();
  const { data: claimed, error } = await db
    .from("life_story_renders")
    .update({ tick_lease_until: new Date(Date.now() + TICK_LEASE_SECONDS * 1000).toISOString() })
    .eq("id", renderId)
    .in("status", ["animating", "rendering"])
    .or(`tick_lease_until.is.null,tick_lease_until.lt.${nowIso}`)
    .select("id");
  if (error) return json({ success: false, error: error.message }, 500);
  if (claimed?.length) EdgeRuntime.waitUntil(advanceRender(db, renderId));
  return json({ success: true });
}

// ---------------------------------------------------------------------------

/**
 * Only the service role may call this. Deployed with verify_jwt ON, so the
 * Supabase gateway has already checked the JWT's signature before we run —
 * reading its `role` claim here is then safe. (A plain string compare with
 * SUPABASE_SERVICE_ROLE_KEY isn't enough: the key injected into functions
 * can differ from the one the web app holds while still being the same role.)
 */
function isServiceCaller(authorization: string | null, serviceRoleKey: string): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const token = authorization.slice(7);
  if (token === serviceRoleKey) return true;
  const payload = token.split(".")[1];
  if (!payload) return false;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return claims?.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return json({ success: false, error: "Not configured" }, 500);
  if (!isServiceCaller(req.headers.get("authorization"), serviceRoleKey)) return json({ success: false, error: "Unauthorized" }, 401);

  let body: { action?: string; lifeStoryId?: string; renderId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid request body" }, 400);
  }
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  switch (body.action) {
    case "structure":
      if (!body.lifeStoryId) return json({ success: false, error: "Missing lifeStoryId" }, 400);
      EdgeRuntime.waitUntil(runStructure(db, body.lifeStoryId));
      return json({ success: true });
    case "film_start":
      if (!body.renderId) return json({ success: false, error: "Missing renderId" }, 400);
      EdgeRuntime.waitUntil(runFilmStart(db, body.renderId));
      return json({ success: true });
    case "film_tick":
      if (!body.renderId) return json({ success: false, error: "Missing renderId" }, 400);
      return runFilmTick(db, body.renderId);
    default:
      return json({ success: false, error: "Unknown action" }, 400);
  }
});
