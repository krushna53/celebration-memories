export function reelCost(clips) {
  const jobs = new Map();
  let unavailable = 0;
  for (const clip of clips) {
    if (!clip.token) { unavailable++; continue; }
    const previous = jobs.get(clip.token);
    if (!previous || Number.isFinite(clip.actualCostUsd)) jobs.set(clip.token, clip);
  }
  const known = [...jobs.values()].filter(c => Number.isFinite(c.actualCostUsd) && c.actualCostUsd >= 0);
  return {
    actualUsd: Math.round(known.reduce((sum,c) => sum + c.actualCostUsd, 0) * 1e10) / 1e10,
    pending: jobs.size - known.length,
    unavailable,
    complete: clips.length > 0 && known.length === jobs.size && unavailable === 0,
    seconds: clips.reduce((sum,c) => sum + (Number.isFinite(c.seconds) ? c.seconds : 0), 0),
  };
}
