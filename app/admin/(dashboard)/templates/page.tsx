import Link from "next/link";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { listApprovedTemplateSubmissions } from "@/services/template-submissions";
import { communitySubmissionToTemplateSummary } from "@/lib/community-theme";
import { TEMPLATE_CATALOG } from "@/lib/template-catalog";
import { TemplatePicker, type PickerTemplate } from "@/features/admin/templates/template-picker";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const admin = await getCurrentAdmin();
  const [event, approvedSubmissions] = await Promise.all([
    admin ? resolveAdminEvent(admin) : Promise.resolve(null),
    listApprovedTemplateSubmissions(),
  ]);
  if (!event) {
    return <p className="text-navy-700">No event found. Check your Supabase seed data.</p>;
  }

  // Built-in templates first, then approved community submissions — see
  // lib/community-theme.ts#communitySubmissionToTemplateSummary for how a
  // submission maps to this same shape.
  const templates: PickerTemplate[] = [
    ...TEMPLATE_CATALOG,
    ...approvedSubmissions.map(communitySubmissionToTemplateSummary),
  ];

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Templates</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Choose the look of your site. Every template uses the same sections
        (Hero, Countdown, Gallery, Timeline, RSVP, Memory Wall) — only
        colours, fonts, and animation style change. Includes
        community-contributed templates —{" "}
        <Link href="/templates/submit" className="text-gold-600 underline underline-offset-2">
          anyone can submit one
        </Link>
        .
      </p>
      <div className="mt-6">
        <TemplatePicker eventId={event.id} currentTemplateSlug={event.templateSlug} templates={templates} />
      </div>
    </div>
  );
}
