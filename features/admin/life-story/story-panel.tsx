"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LIFE_STORY_MAX_STORY_CHARS, LIFE_STORY_MIN_STORY_CHARS } from "@/lib/life-story";
import type { LifeStory } from "@/types/life-story";
import { saveStoryAction } from "@/features/admin/life-story/actions";
import { card, errorText, hint, input, label } from "@/features/admin/life-story/styles";

/**
 * Step 1 — the story itself. A Google Doc is brought in by downloading it
 * as .docx (File → Download → Microsoft Word) and picking it here; the text
 * is extracted in the browser with mammoth, so the file never travels to
 * the server. Pasting the text works just as well.
 */
export function StoryPanel({ eventId, story, onDone }: { eventId: string; story: LifeStory; onDone: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState({
    subjectName: story.subjectName,
    title: story.title,
    subtitle: story.subtitle,
    lifeSpan: story.lifeSpan,
    storyText: story.storyText,
    storySource: story.storySource,
  });
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  };

  async function readDocx(file: File) {
    setError(null);
    if (!/\.docx$/i.test(file.name)) {
      setError("Please choose a .docx file. In Google Docs: File → Download → Microsoft Word (.docx).");
      return;
    }
    setReading(true);
    try {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      const text = value.replace(/\n{3,}/g, "\n\n").trim();
      if (!text) throw new Error("That document looks empty.");
      if (values.storyText.trim() && !window.confirm("Replace the story text you already have with this document?")) return;
      set("storyText", text.slice(0, LIFE_STORY_MAX_STORY_CHARS));
      set("storySource", "docx");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that document.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(next: boolean) {
    setSaving(true);
    setError(null);
    const res = await saveStoryAction(eventId, values);
    setSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
    if (next) onDone();
  }

  const words = values.storyText.trim() ? values.storyText.trim().split(/\s+/).length : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg text-navy-950">The story</h2>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              id="life-story-docx"
              onChange={(e) => e.target.files?.[0] && readDocx(e.target.files[0])}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={reading}>
              {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              Upload .docx
            </Button>
          </div>
        </div>
        <p className={`mt-1 ${hint}`}>
          Have it in Google Docs? Use <strong>File → Download → Microsoft Word (.docx)</strong>, then upload it here — or just
          copy and paste the text. Write it however it comes: memories, dates, anecdotes, quotes from the family.
        </p>
        <label htmlFor="life-story-text" className="sr-only">
          Story text
        </label>
        <textarea
          id="life-story-text"
          value={values.storyText}
          onChange={(e) => {
            set("storyText", e.target.value.slice(0, LIFE_STORY_MAX_STORY_CHARS));
            if (values.storySource === "docx") set("storySource", "paste");
          }}
          rows={22}
          placeholder={`${values.subjectName || "Papa"} was born in 1951 in a small village near…`}
          className={`mt-4 font-serif leading-relaxed ${input}`}
        />
        <p className={`mt-2 ${hint}`}>
          {words.toLocaleString()} words
          {values.storySource === "docx" ? " · from your document" : ""}
          {values.storyText.trim().length > 0 && values.storyText.trim().length < LIFE_STORY_MIN_STORY_CHARS
            ? " · add a little more so the AI has something to work with"
            : ""}
        </p>
      </section>

      <aside className={`${card} h-fit space-y-4`}>
        <div>
          <label htmlFor="ls-subject" className={label}>
            Whose life story?
          </label>
          <input id="ls-subject" className={`mt-1 ${input}`} value={values.subjectName} onChange={(e) => set("subjectName", e.target.value)} />
        </div>
        <div>
          <label htmlFor="ls-title" className={label}>
            Title <span className="normal-case tracking-normal">(optional — the AI suggests one)</span>
          </label>
          <input id="ls-title" className={`mt-1 ${input}`} value={values.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <label htmlFor="ls-subtitle" className={label}>
            Subtitle
          </label>
          <input
            id="ls-subtitle"
            className={`mt-1 ${input}`}
            value={values.subtitle}
            placeholder="A Life of Love and Service"
            onChange={(e) => set("subtitle", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="ls-span" className={label}>
            Years
          </label>
          <input id="ls-span" className={`mt-1 ${input}`} value={values.lifeSpan} placeholder="1951 – present" onChange={(e) => set("lifeSpan", e.target.value)} />
        </div>
        {error ? <p className={errorText}>{error}</p> : null}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" onClick={() => save(true)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save & add photos
          </Button>
          <Button type="button" variant="outline" onClick={() => save(false)} disabled={saving}>
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </aside>
    </div>
  );
}
