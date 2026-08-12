"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2, Sparkles, Wand2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CustomFormField } from "@/services/custom-forms";
import { generateFormFromImageAction, generateFormFromPromptAction } from "@/features/forms/builder-actions";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

interface AiFormGeneratorProps {
  token: string;
  hasExistingFields: boolean;
  onGenerated: (result: { title: string; description: string | null; fields: CustomFormField[] }) => void;
}

/**
 * Sits at the top of the builder (features/forms/form-builder.tsx), the
 * first thing a builder sees — two ways to skip hand-building a form
 * entirely: describe it in a sentence, or upload a photo/screenshot of
 * an existing form and let AI transcribe it. Both call into
 * lib/ai-form-generator.ts via features/forms/builder-actions.ts,
 * which persists the result and hands back the saved rows — this
 * component just swaps the parent's state to match, it never manages
 * the generated form's data itself.
 */
export function AiFormGenerator({ token, hasExistingFields, onGenerated }: AiFormGeneratorProps) {
  const [mode, setMode] = useState<"prompt" | "image">("prompt");
  const [prompt, setPrompt] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function confirmOverwriteIfNeeded(): boolean {
    if (!hasExistingFields) return true;
    return confirm("This replaces every field currently on this form with the AI-generated ones. Continue?");
  }

  async function handleGenerateFromPrompt() {
    if (!prompt.trim()) {
      setError("Describe the form you want first.");
      return;
    }
    if (!confirmOverwriteIfNeeded()) return;

    setError(null);
    setGenerating(true);
    const result = await generateFormFromPromptAction(token, prompt.trim());
    setGenerating(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    onGenerated(result);
  }

  function handleImageFile(file: File) {
    setError(null);
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is too large — please use one under 4MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleGenerateFromImage() {
    if (!imageDataUrl) {
      setError("Choose an image of a form first.");
      return;
    }
    if (!confirmOverwriteIfNeeded()) return;

    setError(null);
    setGenerating(true);
    const result = await generateFormFromImageAction(token, imageDataUrl);
    setGenerating(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    onGenerated(result);
  }

  return (
    <section className="rounded-xl border border-gold-500/25 bg-gradient-to-br from-gold-500/10 to-transparent p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-gold-600" />
        <h2 className="font-display text-lg text-navy-950">Build with AI</h2>
      </div>
      <p className="mt-1 text-sm text-navy-700/60">
        Describe the form you want, or upload a photo of an existing one — AI fills in the title and fields for you.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("prompt")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-luxury duration-200",
            mode === "prompt" ? "border-gold-500 bg-gold-500/10 text-navy-950" : "border-navy-950/15 text-navy-700/60",
          )}
        >
          <Wand2 size={13} /> Describe it
        </button>
        <button
          type="button"
          onClick={() => setMode("image")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-luxury duration-200",
            mode === "image" ? "border-gold-500 bg-gold-500/10 text-navy-950" : "border-navy-950/15 text-navy-700/60",
          )}
        >
          <ImageUp size={13} /> Upload a form image
        </button>
      </div>

      {mode === "prompt" ? (
        <div className="mt-3 grid gap-2.5">
          <textarea
            rows={3}
            placeholder="e.g. A wedding RSVP with meal choice, plus-one, and a note for the couple"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-lg border border-navy-950/15 bg-white px-3.5 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          />
          <button
            type="button"
            onClick={handleGenerateFromPrompt}
            disabled={generating || !prompt.trim()}
            className="flex items-center justify-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:brightness-110 disabled:opacity-60"
          >
            {generating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
            Generate Form
          </button>
        </div>
      ) : (
        <div className="mt-3 grid gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])}
          />
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="" className="h-32 w-full rounded-lg border border-navy-950/10 object-cover" />
          ) : null}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-navy-950/20 px-3.5 py-2.5 text-xs font-medium text-navy-700/70 hover:border-gold-500/40 hover:text-gold-700"
          >
            <ImageUp size={14} /> {imagePreview ? "Choose a different image" : "Choose an image"}
          </button>
          <button
            type="button"
            onClick={handleGenerateFromImage}
            disabled={generating || !imageDataUrl}
            className="flex items-center justify-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:brightness-110 disabled:opacity-60"
          >
            {generating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
            Generate Form
          </button>
        </div>
      )}

      {error ? (
        <p className="mt-2.5 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
