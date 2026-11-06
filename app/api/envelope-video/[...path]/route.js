// Grok re-letters the envelope film's wax seal for the Sacred Garden create page (/wedding-websites/create).
// Needs XAI_API_KEY, and AI_VIDEO_ACCESS_CODE for use outside localhost.
import { serveEnvelopeVideo } from "@/features/sacred-garden/lib/envelope-video-service.mjs";
import { envelopeStores } from "@/features/sacred-garden/lib/stores.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request) {
  return serveEnvelopeVideo(request, {
    ...(await envelopeStores()),
    apiKey: process.env.XAI_API_KEY ?? "",
    accessCode: process.env.AI_VIDEO_ACCESS_CODE ?? "",
    allowLocalAccess: process.env.NODE_ENV !== "production", // free on your own machine
  });
}
export { handle as GET, handle as HEAD, handle as POST };
