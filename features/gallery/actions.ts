"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForOrganizerArea } from "@/services/admin-auth";
import { getEventById, updateEvent } from "@/services/events";
import { CHAPTERS, CHAPTER_TITLE_MAX, GALLERY_CATEGORIES, type GalleryCategory } from "@/features/gallery/gallery-data";

/**
 * Gallery chapter renaming, used from the public event page and the full
 * gallery page (pencil next to each chapter title) and from Admin →
 * Gallery. Same permission as the rest of Gallery management: the owner,
 * the event's own host, or an organizer for that event.
 */

/** True when the signed-in visitor may rename this event's chapters. Never throws — guests just get false. */
export async function canEditGalleryAction(eventId: string): Promise<boolean> {
  try {
    await requireAdminForOrganizerArea(eventId, "gallery");
    return true;
  } catch {
    return false;
  }
}

export async function renameGalleryChapterAction(
  eventId: string,
  category: GalleryCategory,
  title: string,
): Promise<{ success: true; data: { title: string } } | { success: false; error: string }> {
  try {
    await requireAdminForOrganizerArea(eventId, "gallery");
    if (!GALLERY_CATEGORIES.some((c) => c.value === category && c.value !== "all")) {
      return { success: false, error: "Unknown chapter." };
    }
    const event = await getEventById(eventId);
    if (!event) return { success: false, error: "Event not found." };

    const name = title.trim().replace(/\s+/g, " ").slice(0, CHAPTER_TITLE_MAX);
    const next = { ...(event.galleryChapterTitles ?? {}) };
    if (name) next[category] = name;
    else delete next[category]; // empty = back to the default name
    await updateEvent(eventId, { galleryChapterTitles: next });

    revalidatePath("/");
    revalidatePath("/events/[slug]", "page");
    revalidatePath("/events/[slug]/gallery", "page");
    revalidatePath("/admin/gallery");
    const fallback = CHAPTERS.find((c) => c.category === category)?.title ?? category;
    return { success: true, data: { title: name || fallback } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't rename that chapter." };
  }
}
