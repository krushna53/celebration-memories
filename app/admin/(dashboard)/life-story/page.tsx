import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { SITE_URL } from "@/lib/constants";
import { countFilmRenders, getLifeStoryBundle } from "@/services/life-story";
import { LifeStoryEditor } from "@/features/admin/life-story/life-story-editor";
import { NoEventState } from "@/features/admin/components/no-event-state";

export const dynamic = "force-dynamic";

/**
 * Life Story — a biography (web page + PDF book) and a narrated AI film,
 * from the family's story (.docx or pasted) and their photos. Owner +
 * client hosts; client AI runs are capped per event (life_stories.
 * structure_limit / film_render_limit). See services/life-story.ts.
 */
export default async function AdminLifeStoryPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) return <NoEventState />;

  const bundle = await getLifeStoryBundle(event.id, event.honoreeName);
  const isClient = admin?.role === "client";
  const quota = isClient
    ? {
        writesLeft: Math.max(0, bundle.story.structureLimit - bundle.story.structureRuns),
        filmsLeft: Math.max(0, bundle.story.filmRenderLimit - (await countFilmRenders(bundle.story.id))),
      }
    : null;

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Life Story</h1>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/60">
        Turn {event.honoreeName ? `${event.honoreeName}'s` : "a"} life story and a box of photos into a beautiful biography — to read
        online or print as a book — and a narrated film, with the most precious photos brought to life.
      </p>
      <div className="mt-6">
        <LifeStoryEditor
          key={bundle.story.structuredAt ?? "draft"}
          eventId={event.id}
          bundle={bundle}
          shareUrl={`${SITE_URL}/life-story/${bundle.story.shareToken}`}
          quota={quota}
          aiConfigured={Boolean(process.env.OPENAI_API_KEY)}
        />
      </div>
    </div>
  );
}
