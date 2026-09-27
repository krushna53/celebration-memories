import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventLandingPage } from "@/features/event-landing/event-landing-page";
import { EventUnpublishedScreen } from "@/features/event-landing/event-unpublished-screen";
import { getEventBySlug } from "@/services/events";

export const dynamic = "force-dynamic";

/** Previews are for the host's template picker only — never indexed. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

interface TemplatePreviewPageProps {
  params: Promise<{ slug: string; template: string }>;
}

/**
 * The event's real page rendered in a different template, for the
 * template picker's "Preview" popup (features/admin/templates/
 * template-preview-dialog.tsx, shown in an iframe). Purely visual — it
 * changes nothing, and unknown template slugs fall back to the default
 * look (resolveTemplate). Same visibility rule as the live page:
 * unpublished events show the unpublished screen. Page-view analytics
 * skip /preview/ URLs (features/analytics/page-view-beacon.tsx).
 */
export default async function TemplatePreviewPage({ params }: TemplatePreviewPageProps) {
  const { slug, template } = await params;
  const event = await getEventBySlug(slug).catch(() => null);
  if (!event) notFound();
  if (event.pageStatus === "unpublished") return <EventUnpublishedScreen eventTitle={event.eventTitle} />;
  return <EventLandingPage event={event} templateOverride={decodeURIComponent(template)} />;
}
