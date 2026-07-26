import type { Metadata } from "next";

import { getCoverPhoto } from "@/services/gallery-photos";
import { publicMediaUrl } from "@/services/uploads";
import { toEventDisplayData } from "@/lib/event-display";
import { SITE_NAME } from "@/lib/constants";
import type { EventRecord } from "@/types/event";

/**
 * Builds per-event page metadata, including a real Open Graph image, so
 * pasting an event's link into Facebook/X/WhatsApp/iMessage shows a
 * proper preview card instead of the generic site default.
 *
 * Image priority: the organizer's chosen Link Preview Image
 * (events.share_image_path, set on Event Settings) first, then the
 * oldest Gallery photo as a reasonable default, then no image — this
 * should never throw and break a page render even if Supabase is
 * unreachable.
 */
export async function buildEventMetadata(event: EventRecord | null): Promise<Metadata> {
  const data = toEventDisplayData(event);
  const title = `${data.honoreeName} — ${data.eventTitle} | ${SITE_NAME}`;
  const description = data.occasion
    ? `${data.occasion} · Hosted by ${data.hostedBy} · ${data.dayOfWeek}, ${data.date}`
    : `Hosted by ${data.hostedBy} · ${data.dayOfWeek}, ${data.date}`;

  let coverImage: string | null = null;
  if (event?.shareImagePath) {
    coverImage = publicMediaUrl("gallery", event.shareImagePath);
  } else if (event) {
    try {
      coverImage = await getCoverPhoto(event.id);
    } catch (err) {
      console.error("buildEventMetadata failed to load cover photo:", err);
    }
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: coverImage ? [{ url: coverImage, width: 1200, height: 900 }] : undefined,
    },
    twitter: {
      card: coverImage ? "summary_large_image" : "summary",
      title,
      description,
      images: coverImage ? [coverImage] : undefined,
    },
  };
}
