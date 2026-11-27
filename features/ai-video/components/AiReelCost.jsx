import { reelCost } from "@/features/ai-video/lib/ai-reel-cost.mjs";
import { creditUnits as money } from "@/features/ai-video/lib/ai-credits.mjs";
export default function AiReelCost({ clips, seconds }) {
  if (!clips.length) return null;
  const cost = reelCost(clips);
  const duration = Math.round(seconds || cost.seconds);
  return <section className="ai-reel-cost" aria-label="Full reel credits used">
    <strong>{cost.complete ? `API credits used for ${duration ? `${duration}-second` : "this"} reel: ${money(cost.actualUsd)}` : `Full reel credits used: ${cost.unavailable ? "unavailable for imported files" : "awaiting xAI billing"}`}</strong>
    {!cost.complete && <p className="hint small">Confirmed credits used so far: {money(cost.actualUsd)}. {cost.pending > 0 && `${cost.pending} clip usage record(s) pending. `}{cost.unavailable > 0 && "Imported MP4s have no linked API billing record."} This is not a complete actual total.</p>}
    <p className="hint small">{clips.length} clip{clips.length === 1 ? "" : "s"} included. Editing, combining and downloading do not add an API generation charge.</p>
    {clips.map((clip,i) => <p className="hint small" key={`${clip.videoUrl}:${i}`}>Clip {i+1}{clip.seconds ? ` · ${clip.seconds}s` : ""}: {Number.isFinite(clip.actualCostUsd) ? money(clip.actualCostUsd) : clip.token ? "Credits used pending" : "Original credits used unavailable"}</p>)}
  </section>;
}
