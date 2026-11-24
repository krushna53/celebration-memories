// Indicative USD rates checked 2 November 2026. Revalidate on the server
// before enabling paid generation; client estimates are never authorisation.
export const AI_VIDEO_MODELS = [
  { id: "grok-imagine-video-1.5-lite", label: "Imagine 1.5 Lite", rates: { "480p": 0.02, "720p": 0.03, "1080p": 0.14 }, image: 0.01 },
  { id: "grok-imagine-video-1.5", label: "Imagine 1.5", rates: { "480p": 0.08, "720p": 0.14, "1080p": 0.25 }, image: 0.01 },
];
export function estimateAiVideo({ model, resolution, seconds }) {
  const selected = AI_VIDEO_MODELS.find((item) => item.id === model);
  if (!selected || !selected.rates[resolution] || ![5, 10, 15].includes(seconds)) throw new Error("Choose a supported video configuration.");
  const outputCents = Math.round(selected.rates[resolution] * 100) * seconds;
  return { model: selected.id, label: selected.label, resolution, seconds, outputCents, inputCents: 1, totalCents: outputCents + 1 };
}
export const usd = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
