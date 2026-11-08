import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { NoEventState } from "@/features/admin/components/no-event-state";
import { designFormFor } from "@/features/sacred-garden/lib/design";
import { RsvpTeaserSection } from "@/features/rsvp/rsvp-teaser-section";
import CreateInvitation from "@/app/wedding-websites/create/CreateInvitation";

export const dynamic = "force-dynamic";

/**
 * The Sacred Garden design of a live wedding, editable after the wizard —
 * the same form as the wizard's Design step, saved straight onto the event
 * (features/sacred-garden/actions.ts's saveEventDesignAction). Linked from Event Settings.
 */
export default async function AdminWeddingDesignPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) return <NoEventState />;

  if (event.templateSlug !== "sacred-garden") {
    return (
      <div className="rounded-xl border border-navy-950/10 bg-white p-6">
        <h1 className="font-display text-2xl text-navy-950">Wedding design</h1>
        <p className="mt-2 text-sm text-navy-700/70">
          This page edits the Sacred Garden wedding design. {event.honoreeName}&rsquo;s event uses another template — pick
          Sacred Garden under <Link href="/admin/templates" className="text-gold-600 underline underline-offset-2">Templates</Link> first.
        </p>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6">
      <CreateInvitation
        eventId={event.id}
        initialForm={designFormFor(event)}
        rsvp={
          <RsvpTeaserSection eventId={event.id} eventSlug={event.slug} publicRsvpEnabled={event.publicRsvpEnabled}
            honoreeName={event.honoreeName} category={event.category} />
        }
      />
    </div>
  );
}
