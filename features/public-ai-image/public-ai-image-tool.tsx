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

/** Generation usually takes 20-60s; the Edge Function itself is cut off at 150s. */
const GENERATION_TIMEOUT_MS = 150_000;

/** Parses a JSON body without throwing on a non-JSON error page (e.g. a gateway timeout), so the real status still reaches the user. */
async function readJson(res: Response): Promise<{ error?: string; ticketId?: unknown; dataUrl?: unknown }> {
  try {
    return await res.json();
  } catch {
    return { error: res.ok ? undefined : `The server returned an unexpected response (${res.status}). Please try again.` };
  }
}

/**
 * Client half of the public, no-login "AI Invitation Image" tool
 * (#81) — a marketing/lead-gen page (app/ai-invitation-image/page.tsx)
 * that lets a visitor try the AI Image feature before committing to
 * /start. Two steps: app/api/public-ai-image/route.ts (the real
 * rate-limit enforcement point) issues a single-use ticket, then the
 * generate-public-ai-image Supabase Edge Function turns that ticket
 * into an image — generation takes longer than a Netlify function is
 * allowed to run. This component just surfaces whatever either step
 * returns (including a 429's friendly message) rather than
 * re-implementing any limit checks client-side.
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
    try {
      const ticketRes = await fetch("/api/public-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const ticket = await readJson(ticketRes);
      if (!ticketRes.ok || typeof ticket.ticketId !== "string") {
        setError(ticket.error || "Something went wrong. Please try again.");
        return;
      }

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      const imageRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-public-ai-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey },
        body: JSON.stringify({ ticketId: ticket.ticketId }),
        signal: controller.signal,
      });
      const image = await readJson(imageRes);
      if (!imageRes.ok || typeof image.dataUrl !== "string") {
        setError(image.error || "The image couldn't be generated. Please try again.");
        return;
      }
      setResult({ dataUrl: image.dataUrl });
    } catch (err) {
      console.error("Public AI image generation failed:", err);
      setError(
        err instanceof DOMException && err.name === "AbortError"
          ? "This is taking much longer than expected. Please try again in a bit."
          : "Something went wrong. Please check your connection and try again.",
      );
    } finally {
      clearTimeout(timeout);
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
