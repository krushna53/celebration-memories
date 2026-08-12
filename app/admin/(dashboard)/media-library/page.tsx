import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { listMediaLibrary } from "@/services/media-library";
import { MediaLibraryGrid } from "@/features/admin/media-library/media-library-grid";

export const dynamic = "force-dynamic";

export default async function MediaLibraryPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet. Clients: contact the site owner to get linked to your event. Owner: check your Supabase seed data.</p>;
  }

  const items = await listMediaLibrary(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Media Library</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Every photo, video, and audio clip in one place — Gallery, approved Memory Wall uploads, AI Images, Slideshow
        Videos, and Video Edits. Select multiple items to feature, download, or delete them together.
      </p>

      <MediaLibraryGrid eventId={event.id} items={items} />
    </div>
  );
}
