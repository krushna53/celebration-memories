"use client";

import { useRef, useState } from "react";
import { Download, Film, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { startAiVideoAction } from "@/features/admin/ai-video/actions";
import { supabaseBrowser } from "@/lib/supabase/client";

const PROMPT_EXAMPLES = [
  {
    label: "Birthday celebration",
    prompt:
      "An elegant golden birthday celebration, soft confetti drifting through warm candlelight, joyful guests in the background, a gentle cinematic camera push-in, premium and heartfelt.",
  },
  {
    label: "Wedding invitation",
    prompt:
      "Delicate ivory flowers and rose petals floating around a wedding invitation, soft morning light, graceful slow motion, romantic editorial film style.",
  },
  {
    label: "Photo memory",
    prompt:
      "A cherished family photograph coming gently to life: subtle natural smiles, a light breeze moving hair and clothing, warm nostalgic sunlight, slow camera movement, realistic and respectful.",
  },
  {
    label: "Memorial tribute",
    prompt:
      "A peaceful remembrance scene with a glowing candle, soft white flowers, gentle floating light particles, quiet sunrise colours, slow and respectful cinematic movement.",
  },
] as const;

interface AiVideoGeneratorProps {
  eventId: string;
  quota: { used: number; limit: number } | null;
  initialVideoUrl?: string | null;
}

export function AiVideoGenerator({ eventId, quota, initialVideoUrl = null }: AiVideoGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "starting" | "processing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl);
  const [remaining, setRemaining] = useState<number | null>(null);
  const cancelled = useRef(false);
  const remainingCount = remaining ?? (quota ? quota.limit - quota.used : null);

  async function generate() {
    setError(null); setVideoUrl(null); setStatus("starting"); cancelled.current = false;
    const started = await startAiVideoAction(eventId, prompt);
    if (!started.success) { setError(started.error); setStatus("error"); return; }
    setRemaining(started.remaining);
    const { data: { session } } = await supabaseBrowser().auth.getSession();
    if (!session?.access_token) { setError("Your session has expired — please sign in again."); setStatus("error"); return; }
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
    try {
      const created = await fetch(`${base}/functions/v1/generate-ai-video`, { method: "POST", headers, body: JSON.stringify({ jobId: started.jobId, eventId }) });
      const createResult: { success: boolean; error?: string } = await created.json();
      if (!createResult.success) throw new Error(createResult.error || "Unable to start generation.");
      setStatus("processing");
      for (let polls = 0; polls < 90 && !cancelled.current; polls += 1) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
        const response = await fetch(`${base}/functions/v1/ai-video-status`, { method: "POST", headers, body: JSON.stringify({ jobId: started.jobId }) });
        const result: { success: boolean; status?: string; error?: string; resultUrl?: string } = await response.json();
        if (!result.success || result.status === "error") throw new Error(result.error || "Video generation failed.");
        if (result.status === "done" && result.resultUrl) { setVideoUrl(result.resultUrl); setStatus("done"); return; }
      }
      if (!cancelled.current) throw new Error("This is taking longer than expected. Please check back shortly.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to generate the video."); setStatus("error"); }
  }

  const busy = status === "starting" || status === "processing";
  return <div className="grid gap-6 lg:grid-cols-2">
    <section className="rounded-xl border border-navy-950/10 bg-white p-5">
      <label className="text-sm font-medium text-navy-950">Describe your animated moment</label>
      <p className="mt-1 text-xs text-navy-700/55">
        Pick an example to start, then make it your own.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PROMPT_EXAMPLES.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => setPrompt(example.prompt)}
            disabled={busy}
            className="rounded-full border border-gold-500/30 bg-gold-500/5 px-3 py-1.5 text-xs font-medium text-navy-700 transition-luxury duration-300 hover:border-gold-500 hover:bg-gold-500/15 disabled:opacity-50"
          >
            {example.label}
          </button>
        ))}
      </div>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8} maxLength={2000} placeholder="A warm golden birthday celebration, confetti slowly floating through the air, elegant cinematic camera movement..." className="mt-2 w-full rounded-lg border border-navy-950/15 px-3 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30" />
      <p className="mt-2 text-xs text-navy-700/55">Creates a vertical 4-second MP4. For the best result, include the scene, motion, lighting, camera movement, and mood. Avoid asking the model to render exact invitation text.</p>
      {remainingCount !== null ? <p className="mt-3 text-xs text-navy-700/55">{Math.max(0, remainingCount)} of {quota?.limit} generations remaining.</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <Button type="button" onClick={generate} disabled={busy || !prompt.trim() || remainingCount === 0} className="mt-5 w-full gap-2"><Sparkles size={17} />{busy ? <><Loader2 size={16} className="animate-spin" /> {status === "starting" ? "Starting..." : "Generating video — this can take a few minutes..."}</> : "Generate AI video"}</Button>
    </section>
    <section className="grid min-h-80 place-items-center rounded-xl border border-dashed border-navy-950/15 bg-white p-4">
      {videoUrl ? <div className="w-full"><video src={videoUrl} controls loop playsInline className="aspect-[9/16] max-h-[480px] w-full rounded-lg bg-navy-950 object-contain" /><a href={videoUrl} download className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-gold-600 hover:text-gold-500"><Download size={16} /> Download MP4</a></div> : <div className="text-center text-navy-700/45"><Film className="mx-auto" size={32} /><p className="mt-3 text-sm">Your AI-generated video will appear here.</p></div>}
    </section>
  </div>;
}
