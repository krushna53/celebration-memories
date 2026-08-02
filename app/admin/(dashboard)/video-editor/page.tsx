import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { listVideoEditorMediaLibrary, listVideoEditJobs } from "@/services/video-editor";
import { VideoEditorClientBoundary } from "@/features/admin/video-editor/video-editor-client-boundary";

export const dynamic = "force-dynamic";

/**
 * A second, separate Shotstack-powered admin page alongside "Slideshow
 * Video" (/admin/slideshow, which auto-arranges photos with no manual
 * control) — this one embeds the actual @shotstack/shotstack-studio
 * timeline editor so a client can hand-build an Instagram-Reels-style
 * edit from every photo/video the event has (Gallery, Timeline, Memory
 * Wall) plus their own custom uploads, then render a real MP4 and
 * optionally set it live on the Big Screen Display.
 *
 * Available to owner and client roles (see lib/admin-roles.ts); client
 * usage is capped per event (events.video_editor_generation_limit,
 * default 3 — owner exempt) since rendering bills through Shotstack the
 * same as Slideshow Video.
 */
export default async function AdminVideoEditorPage() {
  const admin = await getCurrentAdmin();
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!admin || !event) {
    return (
      <p className="text-navy-700">
        No event is assigned to this account yet. Clients: contact the site owner to get linked to your event. Owner:
        check your Supabase seed data.
      </p>
    );
  }

  const [mediaLibrary, jobs] = await Promise.all([
    listVideoEditorMediaLibrary(event.id),
    listVideoEditJobs(event.id),
  ]);

  const isClient = admin.role === "client";
  const limit = event.videoEditorGenerationLimit;
  const used = jobs.filter((j) => j.status === "done" || j.status === "rendering").length;

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Video Editor</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Build a custom video by hand from this event&rsquo;s photos and videos, or upload your own footage — trim,
        reorder, add music, then render a real MP4 you can download or set as the Big Screen Display video.
      </p>
      {isClient ? (
        <p className="mt-1 text-xs text-navy-700/50">
          Renders count toward a shared limit with other quota-based tools on this event — {Math.max(0, limit - used)}{" "}
          of {limit} remaining.
        </p>
      ) : null}

      <div className="mt-6">
        <VideoEditorClientBoundary
          eventId={event.id}
          initialMediaLibrary={mediaLibrary}
          initialJobs={jobs}
          quota={isClient ? { used, limit } : null}
        />
      </div>
    </div>
  );
}
