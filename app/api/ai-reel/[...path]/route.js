import { serveAiReel } from "@/features/wedding-showcase/reels/ai-reel-service.mjs";
import { aiReelStore } from "@/features/sacred-garden/lib/stores.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
async function handle(request) {
  return serveAiReel(request, { store: await aiReelStore(), apiKey: process.env.XAI_API_KEY ?? "" });
}
export { handle as GET, handle as POST };
