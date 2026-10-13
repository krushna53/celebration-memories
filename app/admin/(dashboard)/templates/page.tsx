import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { listApprovedTemplateSubmissions } from "@/services/template-submissions";
import { communitySubmissionToTemplateSummary } from "@/lib/community-theme";
import { templatesForEvent } from "@/services/template-access";
import { BuildFromCardButton } from "@/features/admin/templates/build-from-card-button";
import { CARD_TEMPLATE_SLUG } from "@/lib/card-theme";
import { TemplatePicker, type PickerTemplate } from "@/features/admin/templates/template-picker";
import { NoEventState } from "@/features/admin/components/no-event-state";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const [event, approvedSubmissions] = await Promise.all([
    admin ? resolveAdminEvent(admin) : Promise.resolve(null),
    listApprovedTemplateSubmissions(),
  ]);
  if (!event) {
    return <NoEventState />;
  }

  // Built-in templates first, then approved community submissions — see
  // lib/community-theme.ts#communitySubmissionToTemplateSummary for how a
  // submission maps to this same shape.
  const viewer = { isPlatformOwner: admin?.role === "owner", email: admin?.email ?? null, eventId: event.id };
  const templates: PickerTemplate[] = [
    ...(await templatesForEvent(event.id, viewer)),
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
      {event.shareImagePath ? (
        <div className="mt-6">
          <BuildFromCardButton
            eventId={event.id}
            hasCardTemplate={templates.some((t) => t.slug === CARD_TEMPLATE_SLUG)}
          />
        </div>
      ) : null}
      <div className="mt-6">
        <TemplatePicker
          eventId={event.id}
          eventSlug={event.slug}
          currentTemplateSlug={event.templateSlug}
          currentThemeOverrides={event.themeOverrides}
          templates={templates}
        />
      </div>
    </div>
  );
}
