import { EVENT_SLUG } from "@/lib/constants";
import { getEventBySlug } from "@/services/events";
import { TemplatePicker } from "@/features/admin/templates/template-picker";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const event = await getEventBySlug(EVENT_SLUG);
  if (!event) {
    return <p className="text-navy-700">No event found. Check your Supabase seed data.</p>;
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Templates</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Choose the look of your site. Every template uses the same sections
        (Hero, Countdown, Gallery, Timeline, RSVP, Memory Wall) — only
        colours, fonts, and animation style change.
      </p>
      <div className="mt-6">
        <TemplatePicker eventId={event.id} currentTemplateSlug={event.templateSlug} />
      </div>
    </div>
  );
}
