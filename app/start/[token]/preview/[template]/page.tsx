import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventLandingPage } from "@/features/event-landing/event-landing-page";
import { getDraftEventByToken } from "@/services/event-drafts";
import { canUseTemplate, TEMPLATE_CATALOG } from "@/lib/template-catalog";
import { getTemplateViewer } from "@/services/template-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Drafts are previewable only with their setup capability, never by public slug. */
export default async function DraftTemplatePreview({ params }: {
  params: Promise<{ token: string; template: string }>;
}) {
  const { token, template } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();
  const requested = decodeURIComponent(template);
  // A private template only previews for the people it's shared with (TemplateSummary.access).
  const privateTemplate = TEMPLATE_CATALOG.find((t) => t.slug === requested && t.access);
  const allowed = !privateTemplate || canUseTemplate(privateTemplate, await getTemplateViewer(event.id));
  return <EventLandingPage event={event} templateOverride={allowed ? requested : event.templateSlug} />;
}
