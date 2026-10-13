"use client";

import { useRef, useState, useTransition } from "react";
import { ImageUp, Loader2, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RsvpConfig } from "@/lib/rsvp-config";
import type { GenerateRsvpConfigResult } from "@/features/admin/rsvp-form/actions";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * "Generate with AI" panel at the top of the RSVP form builder. Describe
 * what to ask, or upload a photo of an existing form; the suggestion is
 * loaded into the builder for review — nothing is saved until the host
 * clicks Save. The image is sent as a data URL and never stored.
 */
export function RsvpAiAssist({
  generateAction,
  onGenerated,
}: {
  generateAction: (input: { prompt?: string; imageDataUrl?: string }) => Promise<GenerateRsvpConfigResult>;
  onGenerated: (config: RsvpConfig) => void;
}) {
  const [mode, setMode] = useState<"prompt" | "image">("prompt");
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function pickImage(file: File) {
    setError(null);
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
      setError("Upload a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is too large — please use one under 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  function generate() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await generateAction(mode === "image" ? { imageDataUrl: image ?? undefined } : { prompt });
      if (result.success) {
        onGenerated(result.config);
        setDone(true);
      } else {
        setError(result.error);
      }
    });
  }

  const canGenerate = mode === "prompt" ? prompt.trim().length >= 5 : Boolean(image);

  return (
    <section className="rounded-xl border border-gold-500/25 bg-gold-500/5 p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-gold-600" aria-hidden="true" />
        <h2 className="font-display text-lg text-navy-950">Generate with AI</h2>
      </div>
      <p className="mt-1 text-sm text-navy-700/70">
        Describe what you&rsquo;d like to ask, or upload a photo of a form you already use. We&rsquo;ll set up the form below —
        review it, change anything, then save.
      </p>
      <div className="mt-3 inline-flex rounded-full border border-navy-950/15 bg-white p-0.5 text-sm" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "prompt"}
          className={mode === "prompt" ? "inline-flex items-center gap-1.5 rounded-full bg-navy-950 px-3 py-1 text-ivory-50" : "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-navy-700"}
          onClick={() => setMode("prompt")}
        >
          <Wand2 size={13} /> Describe it
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "image"}
          className={mode === "image" ? "inline-flex items-center gap-1.5 rounded-full bg-navy-950 px-3 py-1 text-ivory-50" : "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-navy-700"}
          onClick={() => setMode("image")}
        >
          <ImageUp size={13} /> Upload a form image
        </button>
      </div>

      {mode === "prompt" ? (
        <textarea
          className="mt-3 w-full resize-y rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          rows={3}
          maxLength={2000}
          value={prompt}
          placeholder="e.g. Leadership summit — ask work email, company, designation, dietary needs and which breakout session (Strategy, Product or Culture). No kids."
          onChange={(e) => setPrompt(e.target.value)}
        />
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) pickImage(file);
            }}
          />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <ImageUp size={16} /> {image ? "Choose a different image" : "Choose an image"}
          </Button>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Form to copy" className="h-16 w-auto rounded border border-navy-950/10 object-contain" />
          ) : null}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={generate} disabled={pending || !canGenerate}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {pending ? "Setting up your form…" : "Generate"}
        </Button>
        {done ? <p className="text-sm text-green-700" role="status">Done — review the form below, then save it.</p> : null}
        {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
