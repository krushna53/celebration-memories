import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventLandingPage } from "@/features/event-landing/event-landing-page";
import { getDraftEventByToken } from "@/services/event-drafts";

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
  return <EventLandingPage event={event} templateOverride={template} />;
}
