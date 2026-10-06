import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SiteShell } from "@/components/layout/site-shell";
import { CustomCssBlock } from "@/features/event-landing/custom-css-block";
import { FullGallery } from "@/features/gallery/full-gallery";
import { TEMPLATE_THEMES } from "@/lib/template-themes";
import { DEFAULT_TEMPLATE_SLUG } from "@/lib/template-catalog";
import { buildEventMetadata } from "@/lib/event-metadata";
import { getEventBySlug } from "@/services/events";
import { publicMediaUrl } from "@/services/uploads";
import { listGalleryPhotos } from "@/services/gallery-photos";
import { listGuestGalleryPhotos } from "@/services/gallery-story";
import { TemplateThemeWrapper } from "@/templates/shared/template-theme-wrapper";
import type { EventRecord } from "@/types/event";

/**
 * Full-page gallery for one event — every family photo by chapter plus
 * approved guest photos, in a Pinterest-style mosaic or a Google
 * Photos-style grid (features/gallery/full-gallery.tsx). The event page's
 * Gallery section links here once there are more photos than fit there.
 * Same access model as /events/[slug]: anyone with the link.
 */
export const revalidate = 60;

/** Guest photos fetched for this page — the event page's section only needs a handful. */
const GUEST_PHOTO_LIMIT = 500;

interface GalleryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ chapter?: string }>;
}

const loadEvent = cache(async (slug: string): Promise<EventRecord | null> => {
  try {
    return await getEventBySlug(slug);
  } catch (err) {
    console.error("EventGalleryPage failed to load event:", err);
    return null;
  }
});

/**
 * Same link preview as the event page — the invitation card when one is
 * set (else the cover photo / EveryMoment card), so a shared gallery link
 * looks like the event in WhatsApp etc. — with a gallery-specific title.
 */
export async function generateMetadata({ params }: GalleryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) return {};
  const base = await buildEventMetadata(event);
  const title = `Gallery — ${event.honoreeName} | ${event.eventTitle}`;
  const description = `Photos and videos from ${event.honoreeName}'s ${event.eventTitle}.`;
  return {
    ...base,
    title,
    description,
    openGraph: { ...base.openGraph, title, description },
    twitter: { ...base.twitter, title, description },
    robots: event.visibility === "public" ? undefined : { index: false, follow: false },
  };
}

export default async function EventGalleryPage({ params, searchParams }: GalleryPageProps) {
  const { slug } = await params;
  const { chapter } = await searchParams;
  const event = await loadEvent(slug);
  if (!event) notFound();

  const eventHref = `/events/${encodeURIComponent(event.slug)}`;
  // A taken-down page stays taken down — the event page decides what to show.
  if (event.pageStatus === "unpublished") redirect(eventHref);

  const [photos, guestPhotos] = await Promise.all([
    listGalleryPhotos(event.id).catch(() => []),
    listGuestGalleryPhotos(event.id, GUEST_PHOTO_LIMIT).catch(() => []),
  ]);

  // Built-in templates have a palette here; community templates fall back to the default look.
  const theme = TEMPLATE_THEMES[event.templateSlug] ?? TEMPLATE_THEMES[DEFAULT_TEMPLATE_SLUG]!;

  return (
    <>
      <CustomCssBlock css={event.customCss} />
      <TemplateThemeWrapper theme={theme} overrides={event.themeOverrides}>
        <SiteShell
          honoreeName={event.honoreeName}
          homeHref={eventHref}
          navLinks={[
            { label: "Event", href: eventHref },
            { label: "Gallery", href: `${eventHref}/gallery` },
            { label: "Memories", href: `${eventHref}#memories` },
          ]}
        >
          <FullGallery
            eventId={event.id}
            chapterTitles={event.galleryChapterTitles}
            invitationCardUrl={event.shareImagePath ? publicMediaUrl("gallery", event.shareImagePath) : null}
            honoreeName={event.honoreeName}
            eventHref={eventHref}
            photos={photos}
            guestPhotos={guestPhotos}
            initialChapter={chapter ?? null}
          />
        </SiteShell>
      </TemplateThemeWrapper>
    </>
  );
}
