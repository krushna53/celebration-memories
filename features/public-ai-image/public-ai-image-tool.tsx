"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

const EXAMPLE_PROMPTS = [
  "Elegant gold and navy 75th birthday invitation for Mahesh, with 'Join us to celebrate!' in an elegant script",
  "Floral pastel wedding invitation with 'Save the Date' and a watercolor bouquet border",
  "Playful cartoon baby shower invitation with balloons and 'It's a Girl!'",
];

interface Result {
  dataUrl: string;
}

/**
 * Client half of the public, no-login "AI Invitation Image" tool
 * (#81) — a marketing/lead-gen page (app/ai-invitation-image/page.tsx)
 * that lets a visitor try the AI Image feature before committing to
 * /start. Calls app/api/public-ai-image/route.ts directly, which is
 * itself the real enforcement point for rate limiting — this component
 * just surfaces whatever it returns (including a 429's friendly
 * message) rather than re-implementing any limit checks client-side.
 */
export function PublicAiImageTool() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError("Please describe the invitation image you want.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/public-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setResult({ dataUrl: data.dataUrl });
    } catch (err) {
      console.error("Public AI image generation failed:", err);
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.dataUrl;
    a.download = "invitation-image.png";
    a.click();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-navy-950/10 bg-white p-6 shadow-sm">
        <label htmlFor="public-ai-prompt" className="text-sm font-medium text-navy-950">
          Describe your invitation
        </label>
        <textarea
          id="public-ai-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          maxLength={500}
          placeholder="e.g. Elegant gold and navy 75th birthday invitation with 'Join us to celebrate!' in an elegant script"
          className="mt-2 w-full resize-none rounded-lg border border-navy-950/15 p-3 text-sm text-navy-950 outline-none focus:border-gold-500"
        />
        <p className="mt-1 text-right text-xs text-navy-700/40">{prompt.length}/500</p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setPrompt(example)}
              className="rounded-full border border-navy-950/10 px-2.5 py-1 text-xs text-navy-700/60 hover:border-gold-500/40 hover:text-gold-700"
            >
              {example.length > 40 ? `${example.slice(0, 40)}...` : example}
            </button>
          ))}
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <Button onClick={handleGenerate} disabled={loading} className="mt-4 w-full">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Generating — this can take up to a minute...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Sparkles size={16} /> Generate Free Image
            </span>
          )}
        </Button>
        <p className="mt-2 text-center text-xs text-navy-700/40">
          1 free generation per hour, no account needed.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy-950/15 bg-ivory-50 p-6">
        {result ? (
          <div className="w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL, next/image can't optimize this */}
            <img src={result.dataUrl} alt="Your AI-generated invitation" className="w-full rounded-xl border border-navy-950/10 shadow-sm" />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={handleDownload} className="flex-1">
                <Download size={16} className="mr-1.5" /> Download
              </Button>
              <Button asChild className="flex-1">
                <Link href="/start">Build Your Full Site — Free to Try</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center">
            <Sparkles size={28} className="mx-auto text-gold-500/50" />
            <p className="mt-3 text-sm text-navy-700/50">Your image will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
