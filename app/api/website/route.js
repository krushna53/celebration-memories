// Publish a Sacred Garden website from /wedding-websites/create; it is then shown at /wedding/<slug>.
import { serveWebsite } from "@/features/sacred-garden/lib/website-service.mjs";
import { websiteStore } from "@/features/sacred-garden/lib/stores.mjs";

export const dynamic = "force-dynamic";
export async function POST(request) {
  try { return await serveWebsite(request, await websiteStore()); }
  catch { return Response.json({ error: "Could not save or load the website. Please try again." }, { status: 503 }); }
}
