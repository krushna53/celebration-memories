import { EVENT_SLUG } from "@/lib/constants";
import { getEventBySlug } from "@/services/events";
import { toEventDisplayData } from "@/lib/event-display";
import { getTemplateBySlug } from "@/lib/templates";
import { ShareImageGenerator } from "@/features/admin/share-image/share-image-generator";

export const dynamic = "force-dynamic";

export default async function AdminShareImagePage() {
  const event = await getEventBySlug(EVENT_SLUG);
  if (!event) {
    return <p className="text-navy-700">No event found. Check your Supabase seed data.</p>;
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
