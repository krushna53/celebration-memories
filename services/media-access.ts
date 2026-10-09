import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { eventPermissions, supportExpiry } from "@/services/event-access";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Authorization runs afresh at every media request, never cached across viewers. */
export async function authorizeMedia(bucket: string, path: string, support = false): Promise<{ ttl: number; eventId: string; support: boolean } | null> {
  const eventId = path.split("/")[0] ?? "";
  if (path.includes("..") || path.includes("\\")) return null;
  if (!UUID.test(eventId)) {
    // These existing namespaces contain platform marketing/payment assets,
    // never event media. A valid server signature is still required by caller.
    return /^(platform\/(payment-qr|testimonials|feature-video)\/|custom-forms\/)/.test(path) ? { ttl: 60, eventId: "", support: false } : null;
  }
  const permissions = await eventPermissions(eventId);
  if (!permissions.event) return null;
  const cookieJar = await cookies();
  const draftToken = cookieJar.get("em_draft_preview")?.value;
  if (permissions.event.status === "draft" && draftToken) {
    const { data } = await supabaseAdmin().from("events").select("id").eq("id",eventId).eq("status","draft").eq("draft_token",draftToken).maybeSingle();
    if (data) return { ttl: 60, eventId, support: false };
  }
  if (permissions.manage) return { ttl: 60, eventId, support: false };
  if (permissions.platformAdmin && (support || !permissions.view)) {
    const expiry = await supportExpiry(eventId, `${bucket}/${path}`);
    const ttl = expiry ? Math.min(60, Math.floor((expiry - Date.now()) / 1000)) : 0;
    return ttl > 0 ? { ttl, eventId, support: true } : null;
  }
  if (!permissions.view) return null;
  const guestToken = cookieJar.get("em_guest_preview")?.value;
  if (guestToken) {
    const { data: guest } = await supabaseAdmin().from("invitees").select("id").eq("event_id",eventId).eq("token",guestToken).maybeSingle();
    if (guest && path.split("/")[1] === guest.id && ["photos","videos","audio"].includes(bucket)) return { ttl: 60, eventId, support: false };
  }
  // Never grant a visitor a raw folder listing or an unpublished upload.
  const db = supabaseAdmin();
  if (["photos", "videos", "audio"].includes(bucket)) {
    const { data, error } = await db.from(bucket).select("id").eq("event_id", eventId)
      .eq("storage_path", path).eq("approved", true).is("deleted_at", null).limit(1);
    if (!error && data?.length) return { ttl: 60, eventId, support: false };
  }
  if (bucket === "gallery") {
    const results = await Promise.all([
      db.from("gallery_photos").select("id").eq("event_id", eventId).eq("storage_path", path).is("deleted_at", null).limit(1),
      db.from("timeline_milestones").select("id").eq("event_id", eventId).eq("image_path", path).limit(1),
      db.from("events").select("share_image_path,share_video_path,highlight_reel_path").eq("id", eventId).single(),
    ]);
    if (results.some(r => r.error)) return null;
    const assets = results[2].data;
    if (results[0].data?.length || results[1].data?.length || (assets && Object.values(assets).includes(path))) {
      return { ttl: 60, eventId, support: false };
    }
  }
  const publishedJobs = bucket === "gallery" ? ["slideshow_video_jobs", "ai_video_jobs", "ai_image_jobs"] : bucket === "videos" ? ["guest_reels", "timeline_movie_jobs"] : [];
  for (const table of publishedJobs) {
    const { data, error } = await db.from(table).select("id").eq("event_id", eventId).eq("result_path", path).eq("status", "done").limit(1);
    if (!error && data?.length) return { ttl: 60, eventId, support: false };
  }
  return null;
}
