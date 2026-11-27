"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Clapperboard, Loader2, Plus, Trash2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  estimateFilmSeconds,
  LIFE_STORY_LANGUAGES,
  LIFE_STORY_MAX_ANIMATED,
  LIFE_STORY_MAX_SCENES,
  LIFE_STORY_MOTIONS,
  LIFE_STORY_MUSIC,
} from "@/lib/life-story";
import type { LifeStoryBundle, LifeStoryLanguage, LifeStoryMotion, LifeStoryMusic, LifeStoryRender, LifeStoryScene } from "@/types/life-story";
import { saveFilmSettingsAction, saveScenesAction, startFilmAction, tickFilmAction } from "@/features/admin/life-story/actions";
import { card, errorText, hint, input, label } from "@/features/admin/life-story/styles";

type EditableScene = Omit<LifeStoryScene, "sortOrder">;

const STEP_LABEL: Record<LifeStoryRender["status"], string> = {
  preparing: "Recording the narration",
  animating: "Bringing photos to life",
  submitting: "Assembling the film",
  rendering: "Rendering the film",
  done: "Done",
  error: "Something went wrong",
};

function minutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Step 4 — the film. One scene = one photo + one line of narration. Scenes
 * marked "Bring to life" are animated with Grok Imagine (a few seconds of
 * gentle motion — a paid call per scene, so capped); every other scene gets
 * a slow pan/zoom. "Make the film" snapshots the script, and this panel
 * polls the render until the MP4 is ready.
 */
export function FilmPanel({ eventId, bundle, filmsLeft }: { eventId: string; bundle: LifeStoryBundle; filmsLeft: number | null }) {
  const router = useRouter();
  const [scenes, setScenes] = useState<EditableScene[]>(bundle.scenes);
  const [language, setLanguage] = useState<LifeStoryLanguage>(bundle.story.narrationLanguage);
  const [music, setMusic] = useState<LifeStoryMusic>(bundle.story.music);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [render, setRender] = useState<LifeStoryRender | null>(bundle.latestRender);
  const [filmUrl, setFilmUrl] = useState<string | null>(bundle.film?.url ?? null);

  const busy = Boolean(render && render.status !== "done" && render.status !== "error");
  const photoById = new Map(bundle.photos.map((p) => [p.id, p]));
  const animatedCount = scenes.filter((s) => s.animate).length;

  // Poll the render while it's in flight. Each tick also advances it server-side.
  useEffect(() => {
    if (!render || !busy) return;
    const timer = setInterval(async () => {
      const res = await tickFilmAction(eventId, render.id);
      if (!res.success) return;
      setRender(res.data.render);
      if (res.data.url) {
        setFilmUrl(res.data.url);
        router.refresh();
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [render, busy, eventId, router]);

  const update = (index: number, values: Partial<EditableScene>) => {
    setScenes((list) => list.map((s, i) => (i === index ? { ...s, ...values } : s)));
    setDirty(true);
  };
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= scenes.length) return;
    const next = [...scenes];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setScenes(next);
    setDirty(true);
  };

  async function saveAll(): Promise<boolean> {
    setSaving(true);
    setError(null);
    const [scriptRes, settingsRes] = await Promise.all([
      dirty ? saveScenesAction(eventId, scenes) : Promise.resolve({ success: true as const }),
      saveFilmSettingsAction(eventId, { narrationLanguage: language, music }),
    ]);
    setSaving(false);
    const failed = [scriptRes, settingsRes].find((r) => !r.success);
    if (failed && !failed.success) {
      setError(failed.error);
      return false;
    }
    setDirty(false);
    return true;
  }

  async function makeFilm() {
    if (!(await saveAll())) return;
    const res = await startFilmAction(eventId);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setRender({
      id: res.data.renderId,
      status: "preparing",
      progressNote: "Recording the narration…",
      resultPath: null,
      durationSeconds: null,
      xaiCostUsd: 0,
      errorMessage: null,
      createdAt: new Date().toISOString(),
    });
  }

  if (bundle.scenes.length === 0 && scenes.length === 0) {
    return (
      <section className={card}>
        <h2 className="font-display text-lg text-navy-950">Film</h2>
        <p className={`mt-1 ${hint}`}>Use “Write with AI” in step 3 first — it drafts the film script along with the biography.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="font-display text-lg text-navy-950">Film</h2>
            <p className={hint}>
              About {minutes(estimateFilmSeconds(scenes.map((s) => s.narration)))} · {scenes.length} scenes · {animatedCount} brought to
              life with Grok Imagine. Narration is read by an AI voice; music plays softly underneath.
            </p>
            {filmsLeft !== null ? <p className={`mt-1 ${hint}`}>{filmsLeft} film render(s) left for this event.</p> : null}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="ls-language" className={label}>
                Narration
              </label>
              <select
                id="ls-language"
                className={`mt-1 ${input}`}
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value as LifeStoryLanguage);
                  setDirty(true);
                }}
              >
                {Object.entries(LIFE_STORY_LANGUAGES).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ls-music" className={label}>
                Music
              </label>
              <select id="ls-music" className={`mt-1 ${input}`} value={music} onChange={(e) => {
                  setMusic(e.target.value as LifeStoryMusic);
                  setDirty(true);
                }}>
                {Object.entries(LIFE_STORY_MUSIC).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" onClick={makeFilm} disabled={busy || saving || filmsLeft === 0 || scenes.length === 0}>
              {busy || saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
              {filmUrl ? "Make a new version" : "Make the film"}
            </Button>
          </div>
        </div>
        {language !== bundle.story.narrationLanguage ? (
          <p className={`mt-3 ${hint}`}>
            Changing the narration language doesn&apos;t translate the script below — rewrite it, or use “Rewrite with AI” in step 3
            after saving.
          </p>
        ) : null}
        {error ? <p className={`mt-3 ${errorText}`}>{error}</p> : null}

        {render && render.status !== "done" ? (
          <div className={cn("mt-4 rounded-lg px-4 py-3 text-sm", render.status === "error" ? "bg-red-50 text-red-800" : "bg-ivory-100 text-navy-900")} role="status">
            {render.status === "error" ? (
              <>The film couldn&apos;t be made: {render.errorMessage ?? "unknown error"}</>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {STEP_LABEL[render.status]} — {render.progressNote || "working…"} This usually takes 3–10 minutes; you can leave this page and
                come back.
              </span>
            )}
          </div>
        ) : null}

        {filmUrl ? (
          <div className="mt-5">
            <video src={filmUrl} controls preload="metadata" className="aspect-video w-full max-w-3xl rounded-lg bg-black" />
            <a href={filmUrl} download className="mt-2 inline-block text-xs text-gold-600 underline underline-offset-2">
              Download MP4
            </a>
          </div>
        ) : null}
      </section>

      <ol className="space-y-3">
        {scenes.map((scene, i) => {
          const photo = scene.photoId ? photoById.get(scene.photoId) : undefined;
          return (
            <li key={scene.id} className={`${card} p-4`}>
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="w-full shrink-0 sm:w-44">
                  {photo ? (
                    <img src={photo.url} alt={photo.caption || `Scene ${i + 1}`} className="aspect-video w-full rounded object-cover" loading="lazy" />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded bg-navy-950 text-xs text-ivory-100/60">Title card</div>
                  )}
                  <label className="sr-only" htmlFor={`sc-photo-${scene.id}`}>
                    Photo
                  </label>
                  <select
                    id={`sc-photo-${scene.id}`}
                    className={`mt-2 px-2 py-1 text-xs ${input}`}
                    value={scene.photoId ?? ""}
                    onChange={(e) => update(i, { photoId: e.target.value || null, animate: e.target.value ? scene.animate : false })}
                  >
                    <option value="">No photo</option>
                    {bundle.photos.map((p, n) => (
                      <option key={p.id} value={p.id}>
                        {p.caption || `Photo ${n + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={label}>Scene {i + 1}</span>
                    <div className="flex gap-1">
                      <button type="button" aria-label="Move scene up" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-navy-700/60 hover:bg-ivory-100 disabled:opacity-30">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move scene down"
                        onClick={() => move(i, 1)}
                        disabled={i === scenes.length - 1}
                        className="rounded p-1 text-navy-700/60 hover:bg-ivory-100 disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete scene"
                        onClick={() => {
                          setScenes((list) => list.filter((_, j) => j !== i));
                          setDirty(true);
                        }}
                        className="rounded p-1 text-red-700/70 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <label className="sr-only" htmlFor={`sc-narr-${scene.id}`}>
                    Narration
                  </label>
                  <textarea
                    id={`sc-narr-${scene.id}`}
                    rows={3}
                    className={`font-serif ${input}`}
                    value={scene.narration}
                    placeholder="What the narrator says over this photo"
                    onChange={(e) => update(i, { narration: e.target.value })}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label="On-screen caption" className={input} placeholder="On-screen caption (optional)" value={scene.caption} onChange={(e) => update(i, { caption: e.target.value })} />
                    <select aria-label="Camera motion" className={input} value={scene.motion} onChange={(e) => update(i, { motion: e.target.value as LifeStoryMotion })}>
                      {Object.entries(LIFE_STORY_MOTIONS).map(([value, name]) => (
                        <option key={value} value={value}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {photo ? (
                    <div>
                      <label className="inline-flex items-center gap-2 text-sm text-navy-950">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-navy-950/30 text-gold-500 focus:ring-gold-500/40"
                          checked={scene.animate}
                          disabled={!scene.animate && animatedCount >= LIFE_STORY_MAX_ANIMATED}
                          onChange={(e) => update(i, { animate: e.target.checked })}
                        />
                        <Wand2 className="h-3.5 w-3.5 text-gold-600" aria-hidden />
                        Bring this photo to life (Grok Imagine)
                      </label>
                      {scene.animate ? (
                        <input
                          aria-label="How should it move?"
                          className={`mt-2 ${input}`}
                          placeholder="How should it move? e.g. She smiles softly as the camera slowly pushes in."
                          value={scene.animationPrompt}
                          onChange={(e) => update(i, { animationPrompt: e.target.value })}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {animatedCount >= LIFE_STORY_MAX_ANIMATED ? <p className={hint}>Up to {LIFE_STORY_MAX_ANIMATED} photos can be brought to life per film.</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={scenes.length >= LIFE_STORY_MAX_SCENES}
          onClick={() => {
            setScenes((list) => [...list, { id: crypto.randomUUID(), photoId: null, narration: "", caption: "", motion: "zoom_in", animate: false, animationPrompt: "" }]);
            setDirty(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add scene
        </Button>
        <Button type="button" onClick={saveAll} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {dirty ? "Save script" : "Saved"}
        </Button>
      </div>
    </div>
  );
}
