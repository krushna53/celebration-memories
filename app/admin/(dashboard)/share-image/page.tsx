import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { toEventDisplayData } from "@/lib/event-display";
import { getTemplateBySlug } from "@/lib/templates";
import { ShareImageGenerator } from "@/features/admin/share-image/share-image-generator";

// Available to both owner and client roles (see lib/admin-roles.ts) — an
// event host should be able to make their own shareable invitation image
// once they've filled in Event Settings, picked a Template, and added
// Gallery photos, without needing the agency to do it for them.
export const dynamic = "force-dynamic";

export default async function AdminShareImagePage() {
  const admin = await getCurrentAdmin();
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet. Clients: contact the site owner to get linked to your event. Owner: check your Supabase seed data.</p>;
  }

  const data = toEventDisplayData(event);
  const template = getTemplateBySlug(event.templateSlug);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Shareable Invitation Image</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Compose a downloadable invitation card with your event details and
        link — share it in your WhatsApp group alongside the site link.
      </p>
      <div className="mt-6">
        <ShareImageGenerator
          honoreeName={data.honoreeName}
          occasion={data.occasion}
          eventTitle={data.eventTitle}
          dateLabel={`${data.dayOfWeek}, ${data.date} · ${data.startTime}`}
          venueName={data.venueName}
          eventSlug={event.slug}
          primaryColor={template.primaryColor}
          secondaryColor={template.secondaryColor}
        />
      </div>
    </div>
  );
}
