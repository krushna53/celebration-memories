import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { SITE_URL } from "@/lib/constants";
import { getReelSettings, listReelGuests, listReelPool, listReelReferences } from "@/services/guest-reels";
import { ReelsManager } from "@/features/admin/reels/reels-manager";
import { NoEventState } from "@/features/admin/components/no-event-state";

export const dynamic = "force-dynamic";

/**
 * Guest Reels — personalised 9:16 videos for each guest, of the photos
 * they're in with the guest of honour. Owner + client hosts (client
 * renders are capped per event, events.guest_reel_render_limit). See
 * services/guest-reels.ts for the full flow.
 */
export default async function AdminReelsPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) return <NoEventState />;

  const [settings, guests, pool, references] = await Promise.all([
    getReelSettings(event.id),
    listReelGuests(event.id),
    listReelPool(event.id, event.honoreeName),
    listReelReferences(event.id, event.honoreeName),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Guest Reels</h1>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/60">
        After the celebration, give every guest a personal Instagram-ready reel of the moments they shared with{" "}
        {event.honoreeName}. AI recognises each guest (only those who agreed) in the photos from the day and builds their
        reel automatically.
      </p>
      <div className="mt-6">
        <ReelsManager
          eventId={event.id}
          honoreeName={event.honoreeName}
          hostedBy={event.hostedBy}
          eventEnded={Date.parse(event.endAt) < Date.now()}
          siteUrl={SITE_URL}
          isOwner={admin?.role === "owner"}
          settings={settings}
          guests={guests}
          pool={pool}
          references={references}
        />
      </div>
    </div>
  );
}
