// AI wedding video studio API: /api/ai-video/config, /quote, /generate, /status, /media, /history, /balance, /suggest-story.
// Secrets (server only): XAI_API_KEY, AI_VIDEO_ACCESS_CODE (16+ chars, required outside local dev),
// optional XAI_MANAGEMENT_API_KEY + XAI_TEAM_ID for the remaining-credits readout.
import { serveAiVideo } from "@/features/ai-video/lib/ai-video-service.mjs";
import { aiVideoStore } from "@/features/ai-video/lib/ai-video-store.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request) {
  return serveAiVideo(request, {
    store: await aiVideoStore(),
    apiKey: process.env.XAI_API_KEY ?? "",
    accessCode: process.env.AI_VIDEO_ACCESS_CODE ?? "",
    managementKey: process.env.XAI_MANAGEMENT_API_KEY ?? "",
    teamId: process.env.XAI_TEAM_ID ?? "",
    // On `next dev` at localhost the access code is skipped (same-origin requests only). Never in production.
    allowLocalAccess: process.env.NODE_ENV === "development",
  });
}

export { handle as GET, handle as POST };
