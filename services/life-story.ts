import "server-only";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl, UploadValidationError } from "@/services/uploads";
import { assertEventStorageAvailable, StorageQuotaError } from "@/services/storage-quota";
import { LIFE_STORY_MAX_PHOTOS, LIFE_STORY_PHOTO_MAX_BYTES } from "@/lib/life-story";
import type {
  LifeStory,
  LifeStoryBundle,
  LifeStoryChapter,
  LifeStoryLanguage,
  LifeStoryMotion,
  LifeStoryMusic,
  LifeStoryPhoto,
  LifeStoryRender,
  LifeStoryScene,
} from "@/types/life-story";

/**
 * Life Story — a written biography (web page + PDF book) and a narrated
 * film, made from a story the host uploads (.docx or pasted text) and the
 * photos they attach. One per event; the subject defaults to the honoree.
 *
 *   1. Story + photos are saved here (photos go browser → Storage via a
 *      signed upload URL, into `gallery/<eventId>/life-story/`).
 *   2. "Write with AI" flips structure_status to processing and asks the
 *      life-story Edge Function to read the story and look at the photos;
 *      it writes chapters, captions and a film script in the background.
 *   3. The host edits all of it, then "Make the film" snapshots the script
 *      into a render and the Edge Function voices it (OpenAI TTS), brings
 *      the chosen photos to life (Grok Imagine), and renders it (Shotstack).
 *      The admin page polls tickRender() until it's done.
 *   4. Sharing on → /life-story/<shareToken> shows the biography and film
 *      to anyone with the link (services/media-access.ts lets those files
 *      through for anonymous visitors only while sharing is on).
 *
 * Every function here assumes the caller already passed
 * requireAdminForEvent(eventId) — and every query is scoped by that
 * eventId, so a stray id from the browser can't reach another event.
 */

const STORY_COLUMNS =
  "id, event_id, subject_name, title, subtitle, life_span, story_text, story_source, dedication, narration_language, music, structure_status, structure_error, structured_at, cover_photo_id, share_token, is_shared, structure_limit, structure_runs, film_render_limit";
const RENDER_COLUMNS = "id, status, progress_note, result_path, duration_seconds, xai_cost_usd, error_message, created_at";

interface StoryRow {
  id: string;
  event_id: string;
  subject_name: string;
  title: string;
  subtitle: string;
  life_span: string;
  story_text: string;
  story_source: "paste" | "docx";
  dedication: string;
  narration_language: LifeStoryLanguage;
  music: LifeStoryMusic;
  structure_status: LifeStory["structureStatus"];
  structure_error: string | null;
  structured_at: string | null;
  cover_photo_id: string | null;
  share_token: string;
  is_shared: boolean;
  structure_limit: number;
  structure_runs: number;
  film_render_limit: number;
}

interface RenderRow {
  id: string;
  status: LifeStoryRender["status"];
  progress_note: string;
  result_path: string | null;
  duration_seconds: number | string | null;
  xai_cost_usd: number | string;
  error_message: string | null;
  created_at: string;
}

function toStory(r: StoryRow): LifeStory {
  return {
    id: r.id,
    eventId: r.event_id,
    subjectName: r.subject_name,
    title: r.title,
    subtitle: r.subtitle,
    lifeSpan: r.life_span,
    storyText: r.story_text,
    storySource: r.story_source,
    dedication: r.dedication,
    narrationLanguage: r.narration_language,
    music: r.music,
    structureStatus: r.structure_status,
    structureError: r.structure_error,
    structuredAt: r.structured_at,
    coverPhotoId: r.cover_photo_id,
    shareToken: r.share_token,
    isShared: r.is_shared,
    structureLimit: r.structure_limit,
    structureRuns: r.structure_runs,
    filmRenderLimit: r.film_render_limit,
  };
}

function toRender(r: RenderRow): LifeStoryRender {
  return {
    id: r.id,
    status: r.status,
    progressNote: r.progress_note,
    resultPath: r.result_path,
    durationSeconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
    xaiCostUsd: Number(r.xai_cost_usd) || 0,
    errorMessage: r.error_message,
    createdAt: r.created_at,
  };
}

const now = () => new Date().toISOString();

function check(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`Couldn't ${what}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getLifeStory(eventId: string): Promise<LifeStory | null> {
  const { data, error } = await supabaseAdmin().from("life_stories").select(STORY_COLUMNS).eq("event_id", eventId).maybeSingle<StoryRow>();
  check(error, "load the life story");
  return data ? toStory(data) : null;
}

/** The event's life story, created on first visit with the honoree as its subject (empty until the host names them). */
export async function getOrCreateLifeStory(eventId: string, honoreeName: string): Promise<LifeStory> {
  const existing = await getLifeStory(eventId);
  if (existing) return existing;
  const { data, error } = await supabaseAdmin()
    .from("life_stories")
    .upsert({ event_id: eventId, subject_name: honoreeName.trim() }, { onConflict: "event_id", ignoreDuplicates: true })
    .select(STORY_COLUMNS)
    .maybeSingle<StoryRow>();
  check(error, "start the life story");
  // ignoreDuplicates returns no row when a parallel request created it first.
  return data ? toStory(data) : (await getLifeStory(eventId))!;
}

async function loadBundle(story: LifeStory): Promise<LifeStoryBundle> {
  const db = supabaseAdmin();
  const [chapters, photos, scenes, renders] = await Promise.all([
    db.from("life_story_chapters").select("id, sort_order, title, period, body, epigraph, epigraph_source").eq("life_story_id", story.id).order("sort_order"),
    db
      .from("life_story_photos")
      .select("id, chapter_id, storage_path, width, height, caption, year_label, sort_order")
      .eq("life_story_id", story.id)
      .order("sort_order")
      .order("created_at"),
    db
      .from("life_story_scenes")
      .select("id, photo_id, sort_order, narration, caption, motion, animate, animation_prompt")
      .eq("life_story_id", story.id)
      .order("sort_order"),
    db.from("life_story_renders").select(RENDER_COLUMNS).eq("life_story_id", story.id).order("created_at", { ascending: false }).limit(10),
  ]);
  check(chapters.error ?? photos.error ?? scenes.error ?? renders.error, "load the life story");

  const renderList = ((renders.data ?? []) as RenderRow[]).map(toRender);
  const finished = renderList.find((r) => r.status === "done" && r.resultPath);

  return {
    story,
    chapters: (chapters.data ?? []).map((c) => ({
      id: c.id,
      sortOrder: c.sort_order,
      title: c.title,
      period: c.period,
      body: c.body,
      epigraph: c.epigraph,
      epigraphSource: c.epigraph_source,
    })),
    photos: (photos.data ?? []).map((p) => ({
      id: p.id,
      chapterId: p.chapter_id,
      storagePath: p.storage_path,
      width: p.width,
      height: p.height,
      caption: p.caption,
      yearLabel: p.year_label,
      sortOrder: p.sort_order,
      url: publicMediaUrl("gallery", p.storage_path),
    })),
    scenes: (scenes.data ?? []).map((s) => ({
      id: s.id,
      photoId: s.photo_id,
      sortOrder: s.sort_order,
      narration: s.narration,
      caption: s.caption,
      motion: s.motion as LifeStoryMotion,
      animate: s.animate,
      animationPrompt: s.animation_prompt,
    })),
    latestRender: renderList[0] ?? null,
    film: finished?.resultPath ? { url: publicMediaUrl("videos", finished.resultPath), durationSeconds: finished.durationSeconds } : null,
  };
}

export async function getLifeStoryBundle(eventId: string, honoreeName: string): Promise<LifeStoryBundle> {
  return loadBundle(await getOrCreateLifeStory(eventId, honoreeName));
}

/** Public page: possession of the share token is the credential, and sharing must be switched on. */
export async function getSharedLifeStory(shareToken: string): Promise<LifeStoryBundle | null> {
  if (!/^[a-f0-9]{36}$/.test(shareToken)) return null;
  const { data, error } = await supabaseAdmin()
    .from("life_stories")
    .select(STORY_COLUMNS)
    .eq("share_token", shareToken)
    .eq("is_shared", true)
    .maybeSingle<StoryRow>();
  check(error, "load the life story");
  return data ? loadBundle(toStory(data)) : null;
}

/**
 * A Biography event's book (/events/<slug>/book): the event page is the
 * publication, so whoever can open the event page can read the book — no
 * separate sharing switch. Null until the AI (or the host) has written it.
 */
export async function getEventBook(eventId: string): Promise<LifeStoryBundle | null> {
  const story = await getLifeStory(eventId);
  if (!story) return null;
  const bundle = await loadBundle(story);
  return bundle.chapters.length ? bundle : null;
}

/** For services/media-access.ts: a Biography event's book photos + film follow the event page's own access. */
export async function isBiographyBookMedia(eventId: string, bucket: string, path: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from("events").select("category").eq("id", eventId).maybeSingle<{ category: string }>();
  return data?.category === "biography" && isSharedLifeStoryMedia(eventId, bucket, path, { requireShared: false });
}

/**
 * For services/media-access.ts: may an anonymous visitor read this file?
 * Only the story's own photos / finished film — and, with `requireShared`,
 * only while the share link is switched on.
 */
export async function isSharedLifeStoryMedia(eventId: string, bucket: string, path: string, options: { requireShared?: boolean } = {}): Promise<boolean> {
  const db = supabaseAdmin();
  let query = db.from("life_stories").select("id").eq("event_id", eventId);
  if (options.requireShared !== false) query = query.eq("is_shared", true);
  const { data: story } = await query.maybeSingle<{ id: string }>();
  if (!story) return false;
  if (bucket === "gallery") {
    const { data } = await db.from("life_story_photos").select("id").eq("life_story_id", story.id).eq("storage_path", path).limit(1);
    return Boolean(data?.length);
  }
  if (bucket === "videos") {
    const { data } = await db.from("life_story_renders").select("id").eq("life_story_id", story.id).eq("result_path", path).eq("status", "done").limit(1);
    return Boolean(data?.length);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Story + settings
// ---------------------------------------------------------------------------

export async function updateLifeStory(
  eventId: string,
  values: Partial<{
    subjectName: string;
    title: string;
    subtitle: string;
    lifeSpan: string;
    storyText: string;
    storySource: "paste" | "docx";
    dedication: string;
    narrationLanguage: LifeStoryLanguage;
    music: LifeStoryMusic;
    isShared: boolean;
    coverPhotoId: string | null;
  }>,
): Promise<void> {
  const map: Record<string, string> = {
    subjectName: "subject_name",
    title: "title",
    subtitle: "subtitle",
    lifeSpan: "life_span",
    storyText: "story_text",
    storySource: "story_source",
    dedication: "dedication",
    narrationLanguage: "narration_language",
    music: "music",
    isShared: "is_shared",
    coverPhotoId: "cover_photo_id",
  };
  const update: Record<string, unknown> = { updated_at: now() };
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && map[key]) update[map[key]] = value;
  }
  if (values.coverPhotoId) {
    const story = await getLifeStory(eventId);
    const { data } = await supabaseAdmin().from("life_story_photos").select("id").eq("id", values.coverPhotoId).eq("life_story_id", story?.id ?? "").maybeSingle();
    if (!data) throw new Error("That photo isn't part of this life story.");
  }
  const { error } = await supabaseAdmin().from("life_stories").update(update).eq("event_id", eventId);
  check(error, "save the life story");
}

/** A fresh share link — the old one stops working immediately. */
export async function rotateShareToken(eventId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("life_stories")
    .update({ share_token: randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 4), updated_at: now() })
    .eq("event_id", eventId);
  check(error, "reset the share link");
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export async function createLifeStoryPhotoUpload(params: { eventId: string; contentType: string; fileSize: number }) {
  const { eventId, contentType, fileSize } = params;
  if (contentType !== "image/jpeg" && contentType !== "image/png") {
    throw new UploadValidationError("Photos are converted to JPEG before upload — please try that photo again.");
  }
  if (fileSize <= 0 || fileSize > LIFE_STORY_PHOTO_MAX_BYTES) throw new UploadValidationError("That photo is too large (25 MB max).");
  try {
    await assertEventStorageAvailable(eventId, fileSize, "host");
  } catch (err) {
    if (err instanceof StorageQuotaError) throw new UploadValidationError(err.message);
    throw err;
  }
  const story = await getLifeStory(eventId);
  if (!story) throw new Error("Open the Life Story page first.");
  const { count } = await supabaseAdmin().from("life_story_photos").select("id", { count: "exact", head: true }).eq("life_story_id", story.id);
  if ((count ?? 0) >= LIFE_STORY_MAX_PHOTOS) throw new UploadValidationError(`A life story can hold up to ${LIFE_STORY_MAX_PHOTOS} photos.`);

  const ext = contentType === "image/png" ? "png" : "jpg";
  const path = `${eventId}/life-story/photos/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from("gallery").createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  return { path, token: data.token };
}

export async function confirmLifeStoryPhoto(params: {
  eventId: string;
  path: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  caption: string;
}): Promise<LifeStoryPhoto> {
  const { eventId, path } = params;
  // The path must be one we minted for this event — never trust an arbitrary path from the browser.
  if (!new RegExp(`^${eventId}/life-story/photos/[0-9a-f-]{36}\\.(jpg|png)$`).test(path)) throw new Error("Invalid upload.");
  const story = await getLifeStory(eventId);
  if (!story) throw new Error("Life story not found.");

  const db = supabaseAdmin();
  const folder = path.slice(0, path.lastIndexOf("/"));
  const { data: listed } = await db.storage.from("gallery").list(folder, { search: path.slice(path.lastIndexOf("/") + 1), limit: 1 });
  if (!listed?.length) throw new Error("The upload didn't finish — please try again.");

  const { data: last } = await db.from("life_story_photos").select("sort_order").eq("life_story_id", story.id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await db
    .from("life_story_photos")
    .insert({
      life_story_id: story.id,
      event_id: eventId,
      storage_path: path,
      file_size: params.fileSize,
      width: params.width,
      height: params.height,
      caption: params.caption.trim().slice(0, 160),
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id, chapter_id, storage_path, width, height, caption, year_label, sort_order")
    .single();
  check(error, "save the photo");
  if (!story.coverPhotoId) await db.from("life_stories").update({ cover_photo_id: data!.id }).eq("id", story.id);
  return {
    id: data!.id,
    chapterId: data!.chapter_id,
    storagePath: data!.storage_path,
    width: data!.width,
    height: data!.height,
    caption: data!.caption,
    yearLabel: data!.year_label,
    sortOrder: data!.sort_order,
    url: publicMediaUrl("gallery", data!.storage_path),
  };
}

async function storyIdFor(eventId: string): Promise<string> {
  const story = await getLifeStory(eventId);
  if (!story) throw new Error("Life story not found.");
  return story.id;
}

export async function updateLifeStoryPhoto(eventId: string, photoId: string, values: { caption?: string; yearLabel?: string; chapterId?: string | null }): Promise<void> {
  const storyId = await storyIdFor(eventId);
  const update: Record<string, unknown> = {};
  if (values.caption !== undefined) update.caption = values.caption.trim().slice(0, 160);
  if (values.yearLabel !== undefined) update.year_label = values.yearLabel.trim().slice(0, 40);
  if (values.chapterId !== undefined) {
    if (values.chapterId) {
      const { data } = await supabaseAdmin().from("life_story_chapters").select("id").eq("id", values.chapterId).eq("life_story_id", storyId).maybeSingle();
      if (!data) throw new Error("That chapter isn't part of this life story.");
    }
    update.chapter_id = values.chapterId;
  }
  const { error } = await supabaseAdmin().from("life_story_photos").update(update).eq("id", photoId).eq("life_story_id", storyId);
  check(error, "save the photo");
}

export async function reorderLifeStoryPhotos(eventId: string, orderedIds: string[]): Promise<void> {
  const storyId = await storyIdFor(eventId);
  const db = supabaseAdmin();
  await Promise.all(orderedIds.map((id, i) => db.from("life_story_photos").update({ sort_order: i }).eq("id", id).eq("life_story_id", storyId)));
}

export async function deleteLifeStoryPhoto(eventId: string, photoId: string): Promise<void> {
  const storyId = await storyIdFor(eventId);
  const db = supabaseAdmin();
  const { data } = await db.from("life_story_photos").select("storage_path").eq("id", photoId).eq("life_story_id", storyId).maybeSingle<{ storage_path: string }>();
  if (!data) throw new Error("Photo not found.");
  const { error } = await db.from("life_story_photos").delete().eq("id", photoId).eq("life_story_id", storyId);
  check(error, "delete the photo");
  await db.storage.from("gallery").remove([data.storage_path]);
}

// ---------------------------------------------------------------------------
// Chapters + scenes (the host's edits after the AI pass)
// ---------------------------------------------------------------------------

function chapterRow(c: Omit<LifeStoryChapter, "sortOrder">) {
  return {
    title: c.title.trim().slice(0, 160),
    period: c.period.trim().slice(0, 60),
    body: c.body.slice(0, 20_000),
    epigraph: c.epigraph.trim().slice(0, 400),
    epigraph_source: c.epigraphSource.trim().slice(0, 120),
  };
}

export async function saveLifeStoryChapters(eventId: string, chapters: Omit<LifeStoryChapter, "sortOrder">[]): Promise<void> {
  const storyId = await storyIdFor(eventId);
  const db = supabaseAdmin();
  const { data: existing } = await db.from("life_story_chapters").select("id").eq("life_story_id", storyId);
  const known = new Set((existing ?? []).map((c) => c.id));
  const keep = chapters.filter((c) => known.has(c.id));
  const removed = [...known].filter((id) => !chapters.some((c) => c.id === id));

  if (removed.length) await db.from("life_story_chapters").delete().in("id", removed).eq("life_story_id", storyId);
  await Promise.all(
    keep.map((c) =>
      db
        .from("life_story_chapters")
        .update({ ...chapterRow(c), sort_order: chapters.indexOf(c), updated_at: now() })
        .eq("id", c.id)
        .eq("life_story_id", storyId),
    ),
  );
  const added = chapters.filter((c) => !known.has(c.id));
  if (added.length) {
    const { error } = await db.from("life_story_chapters").insert(
      added.map((c) => ({ life_story_id: storyId, ...chapterRow(c), title: c.title.trim().slice(0, 160) || "New chapter", sort_order: chapters.indexOf(c) })),
    );
    check(error, "add the chapter");
  }
}

export async function saveLifeStoryScenes(eventId: string, scenes: Omit<LifeStoryScene, "sortOrder">[]): Promise<void> {
  const storyId = await storyIdFor(eventId);
  const db = supabaseAdmin();
  const [{ data: existing }, { data: photos }] = await Promise.all([
    db.from("life_story_scenes").select("id").eq("life_story_id", storyId),
    db.from("life_story_photos").select("id").eq("life_story_id", storyId),
  ]);
  const known = new Set((existing ?? []).map((s) => s.id));
  const photoIds = new Set((photos ?? []).map((p) => p.id));
  const row = (s: Omit<LifeStoryScene, "sortOrder">, i: number) => ({
    photo_id: s.photoId && photoIds.has(s.photoId) ? s.photoId : null,
    narration: s.narration.trim().slice(0, 600),
    caption: s.caption.trim().slice(0, 80),
    motion: s.motion,
    animate: s.animate && Boolean(s.photoId),
    animation_prompt: s.animationPrompt.trim().slice(0, 400),
    sort_order: i,
    updated_at: now(),
  });

  const removed = [...known].filter((id) => !scenes.some((s) => s.id === id));
  if (removed.length) await db.from("life_story_scenes").delete().in("id", removed).eq("life_story_id", storyId);
  await Promise.all(
    scenes
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => known.has(s.id))
      .map(({ s, i }) => db.from("life_story_scenes").update(row(s, i)).eq("id", s.id).eq("life_story_id", storyId)),
  );
  const added = scenes.map((s, i) => ({ s, i })).filter(({ s }) => !known.has(s.id));
  if (added.length) {
    const { error } = await db.from("life_story_scenes").insert(added.map(({ s, i }) => ({ life_story_id: storyId, ...row(s, i) })));
    check(error, "add the scene");
  }
}

// ---------------------------------------------------------------------------
// AI + film (Edge Function)
// ---------------------------------------------------------------------------

async function invokeLifeStory<T = { success: boolean; error?: string }>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseAdmin().functions.invoke<T>("life-story", { body });
  if (error) throw new Error(`The Life Story service didn't respond: ${error.message}`);
  return data as T;
}

/** An AI writing run is normally done in 1–3 minutes; past this the Edge Function must have died. */
const STRUCTURE_STALE_MS = 10 * 60 * 1000;
/** A render whose background start never finished (or that's been going far too long) is given up on. */
const RENDER_PREPARING_STALE_MS = 15 * 60 * 1000;
const RENDER_STALE_MS = 2 * 60 * 60 * 1000;

/** Writing status for the editor's poll — a run stuck far past normal is reported (and recorded) as failed. */
export async function getWritingStatus(eventId: string): Promise<Pick<LifeStory, "structureStatus" | "structureError">> {
  const { data, error } = await supabaseAdmin()
    .from("life_stories")
    .select("id, structure_status, structure_error, updated_at")
    .eq("event_id", eventId)
    .maybeSingle<{ id: string; structure_status: LifeStory["structureStatus"]; structure_error: string | null; updated_at: string }>();
  check(error, "check progress");
  if (!data) throw new Error("Life story not found.");
  if (data.structure_status === "processing" && Date.now() - new Date(data.updated_at).getTime() > STRUCTURE_STALE_MS) {
    const message = "Writing took too long and was stopped. Please try again.";
    await supabaseAdmin().from("life_stories").update({ structure_status: "error", structure_error: message }).eq("id", data.id).eq("structure_status", "processing");
    return { structureStatus: "error", structureError: message };
  }
  return { structureStatus: data.structure_status, structureError: data.structure_error };
}

export async function startStructuring(eventId: string): Promise<void> {
  const story = await getLifeStory(eventId);
  if (!story) throw new Error("Life story not found.");
  // Conditional flip, so a double click can't start two AI runs (a run stuck past STRUCTURE_STALE_MS can be restarted).
  const staleBefore = new Date(Date.now() - STRUCTURE_STALE_MS).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("life_stories")
    .update({ structure_status: "processing", structure_error: null, structure_runs: story.structureRuns + 1, updated_at: now() })
    .eq("id", story.id)
    .or(`structure_status.neq.processing,updated_at.lt.${staleBefore}`)
    .select("id");
  check(error, "start writing");
  if (!data?.length) throw new Error("The AI is already writing this story.");
  try {
    const res = await invokeLifeStory({ action: "structure", lifeStoryId: story.id });
    if (!res?.success) throw new Error(res?.error ?? "The AI couldn't start.");
  } catch (err) {
    await supabaseAdmin().from("life_stories").update({ structure_status: "error", structure_error: err instanceof Error ? err.message : "Couldn't start." }).eq("id", story.id);
    throw err;
  }
}

export async function countFilmRenders(storyId: string): Promise<number> {
  const { count } = await supabaseAdmin().from("life_story_renders").select("id", { count: "exact", head: true }).eq("life_story_id", storyId).neq("status", "error");
  return count ?? 0;
}

/** Snapshots the current script into a new render and asks the Edge Function to start it. */
export async function startFilmRender(eventId: string, adminId: string): Promise<string> {
  const story = await getLifeStory(eventId);
  if (!story) throw new Error("Life story not found.");
  const db = supabaseAdmin();

  await db
    .from("life_story_renders")
    .update({ status: "error", error_message: "This render stopped responding and was cancelled.", updated_at: now() })
    .eq("life_story_id", story.id)
    .not("status", "in", "(done,error)")
    .lt("created_at", new Date(Date.now() - RENDER_STALE_MS).toISOString());
  const { data: inFlight } = await db.from("life_story_renders").select("id").eq("life_story_id", story.id).not("status", "in", "(done,error)").limit(1);
  if (inFlight?.length) throw new Error("A film is already being made — wait for it to finish.");

  const [{ data: scenes }, { data: photos }] = await Promise.all([
    db.from("life_story_scenes").select("photo_id, narration, caption, motion, animate, animation_prompt").eq("life_story_id", story.id).order("sort_order"),
    db.from("life_story_photos").select("id, storage_path, width, height").eq("life_story_id", story.id),
  ]);
  const usable = (scenes ?? []).filter((s) => s.narration.trim());
  if (usable.length === 0) throw new Error("Write the film script first — it has no narration yet.");
  const photoById = new Map((photos ?? []).map((p) => [p.id, p]));

  const { data: render, error } = await db
    .from("life_story_renders")
    .insert({ life_story_id: story.id, event_id: eventId, admin_id: adminId, music: story.music, progress_note: "Recording the narration…" })
    .select("id")
    .single();
  check(error, "start the film");
  const renderId = render!.id as string;

  const { error: snapshotError } = await db.from("life_story_render_scenes").insert(
    usable.map((s, i) => {
      const photo = s.photo_id ? photoById.get(s.photo_id) : undefined;
      return {
        render_id: renderId,
        sort_order: i,
        photo_path: photo?.storage_path ?? null,
        photo_width: photo?.width ?? null,
        photo_height: photo?.height ?? null,
        narration: s.narration,
        caption: s.caption,
        motion: s.motion,
        animate: s.animate && Boolean(photo),
        animation_prompt: s.animation_prompt,
      };
    }),
  );
  if (snapshotError) {
    await db.from("life_story_renders").update({ status: "error", error_message: snapshotError.message }).eq("id", renderId);
    throw new Error(`Couldn't start the film: ${snapshotError.message}`);
  }

  try {
    const res = await invokeLifeStory({ action: "film_start", renderId });
    if (!res?.success) throw new Error(res?.error ?? "The film couldn't start.");
  } catch (err) {
    await db.from("life_story_renders").update({ status: "error", error_message: err instanceof Error ? err.message : "Couldn't start." }).eq("id", renderId);
    throw err;
  }
  return renderId;
}

export async function tickFilmRender(eventId: string, renderId: string): Promise<LifeStoryRender> {
  const db = supabaseAdmin();
  const { data: owned } = await db
    .from("life_story_renders")
    .select("id, status, created_at")
    .eq("id", renderId)
    .eq("event_id", eventId)
    .maybeSingle<{ id: string; status: string; created_at: string }>();
  if (!owned) throw new Error("Render not found.");
  const age = Date.now() - new Date(owned.created_at).getTime();
  if ((owned.status === "preparing" && age > RENDER_PREPARING_STALE_MS) || (owned.status !== "done" && owned.status !== "error" && age > RENDER_STALE_MS)) {
    await db
      .from("life_story_renders")
      .update({ status: "error", error_message: "The film stopped making progress. Please try again.", updated_at: now() })
      .eq("id", renderId)
      .eq("status", owned.status);
  } else if (owned.status === "animating" || owned.status === "rendering") {
    await invokeLifeStory({ action: "film_tick", renderId });
  }
  const { data, error } = await db.from("life_story_renders").select(RENDER_COLUMNS).eq("id", renderId).single<RenderRow>();
  check(error, "check the film");
  return toRender(data!);
}

export function filmUrl(render: LifeStoryRender): string | null {
  return render.status === "done" && render.resultPath ? publicMediaUrl("videos", render.resultPath) : null;
}
