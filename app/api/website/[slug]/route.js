// A published Sacred Garden website's form, for /wedding/<slug>.
import { serveWebsite } from "@/features/sacred-garden/lib/website-service.mjs";
import { websiteStore } from "@/features/sacred-garden/lib/stores.mjs";

export const dynamic = "force-dynamic";
export async function GET(request) {
  try { return await serveWebsite(request, await websiteStore()); }
  catch { return Response.json({ error: "Could not save or load the website. Please try again." }, { status: 503 }); }
}
