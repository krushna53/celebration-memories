"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent, requireSessionOrganizerForSession } from "@/services/admin-auth";
import { updateEvent } from "@/services/events";
import {
  createMenuItem,
  createScheduleItem,
  deleteMenuItem,
  deleteScheduleItem,
  ensureEventDayShareToken,
  ensureSessionShareToken,
  getMenuItemById,
  getScheduleItemById,
  regenerateEventDayShareToken,
  regenerateSessionShareToken,
  setScheduleItemCustomForm,
  updateMenuItem,
  updateScheduleItem,
} from "@/services/event-day";
import { getFormBySlug } from "@/services/custom-forms";
import type { MenuDietaryTag } from "@/types/content";

function revalidateEventDayPaths() {
  revalidatePath("/admin/event-day");
  revalidatePath("/");
}

/** Looks up which event a schedule item belongs to and confirms the caller may manage it — same guard as timeline's requireAdminForMilestone. */
async function requireAdminForScheduleItem(id: string) {
  const item = await getScheduleItemById(id);
  if (!item) throw new Error("Schedule item not found.");
  await requireAdminForEvent(item.eventId);
  return item;
}

async function requireAdminForMenuItem(id: string) {
  const item = await getMenuItemById(id);
  if (!item) throw new Error("Menu item not found.");
  await requireAdminForEvent(item.eventId);
  return item;
}

// ---------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------

export async function updateEventDaySettingsAction(
  eventId: string,
  input: { eventDayMode?: "off" | "public" | "private"; menuStyle?: "buffet" | "a_la_carte" },
) {
  try {
    await requireAdminForEvent(eventId);
    await updateEvent(eventId, input);
    revalidateEventDayPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function getEventDayShareLinkAction(eventId: string) {
  try {
    await requireAdminForEvent(eventId);
    const token = await ensureEventDayShareToken(eventId);
    return { success: true as const, data: token };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed to load share link." };
  }
}

export async function regenerateEventDayShareLinkAction(eventId: string) {
  try {
    await requireAdminForEvent(eventId);
    const token = await regenerateEventDayShareToken(eventId);
    revalidateEventDayPaths();
    return { success: true as const, data: token };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed to regenerate share link." };
  }
}

// ---------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------

export async function createScheduleItemAction(input: {
  eventId: string;
  startLabel: string;
  endLabel?: string;
  title: string;
  description?: string;
  sortOrder: number;
}) {
  try {
    await requireAdminForEvent(input.eventId);
    await createScheduleItem(input);
    revalidateEventDayPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function updateScheduleItemAction(
  id: string,
  input: {
    startLabel?: string;
    endLabel?: string | null;
    title?: string;
    description?: string | null;
    sortOrder?: number;
    requiresRegistration?: boolean;
    isPaidSession?: boolean;
    regularPrice?: number | null;
    earlyBirdPrice?: number | null;
    earlyBirdDeadline?: string | null;
    currency?: string;
  },
) {
  try {
    await requireAdminForScheduleItem(id);
    await updateScheduleItem(id, input);
    revalidateEventDayPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteScheduleItemAction(id: string) {
  try {
    await requireAdminForScheduleItem(id);
    await deleteScheduleItem(id);
    revalidateEventDayPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

// ---------------------------------------------------------------------
// Per-session share link + linked custom form (#106)
// ---------------------------------------------------------------------

export async function getSessionShareLinkAction(scheduleItemId: string) {
  try {
    await requireAdminForScheduleItem(scheduleItemId);
    const token = await ensureSessionShareToken(scheduleItemId);
    return { success: true as const, data: token };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed to load session link." };
  }
}

export async function regenerateSessionShareLinkAction(scheduleItemId: string) {
  try {
    await requireAdminForScheduleItem(scheduleItemId);
    const token = await regenerateSessionShareToken(scheduleItemId);
    revalidateEventDayPaths();
    return { success: true as const, data: token };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed to regenerate session link." };
  }
}

/** Self-serve counterpart to getSessionShareLinkAction for a session_organizer (#106) fetching/generating THEIR OWN assigned session's link from /admin/my-sessions — requireSessionOrganizerForSession re-verifies the assignment instead of requireAdminForEvent (which rejects the role outright). */
export async function getMySessionShareLinkAction(scheduleItemId: string) {
  try {
    await requireSessionOrganizerForSession(scheduleItemId);
    const token = await ensureSessionShareToken(scheduleItemId);
    return { success: true as const, data: token };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed to load session link." };
  }
}

/** Links a session to an existing Custom Form Builder form by its public slug (e.g. "form-a1b2c3d4") — an empty slug clears the link. Only ever resolves the slug to an id server-side, never trusts a raw id from the client. */
export async function setScheduleItemCustomFormAction(scheduleItemId: string, slug: string) {
  try {
    await requireAdminForScheduleItem(scheduleItemId);
    const trimmed = slug.trim();
    if (!trimmed) {
      await setScheduleItemCustomForm(scheduleItemId, null);
      revalidateEventDayPaths();
      return { success: true as const };
    }
    const form = await getFormBySlug(trimmed);
    if (!form) return { success: false as const, error: "No form found with that link/slug." };
    await setScheduleItemCustomForm(scheduleItemId, form.id);
    revalidateEventDayPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed to link form." };
  }
}

// ---------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------

export async function createMenuItemAction(input: {
  eventId: string;
  category: string;
  name: string;
  description?: string;
  dietaryTag?: MenuDietaryTag | null;
  sortOrder: number;
}) {
  try {
    await requireAdminForEvent(input.eventId);
    await createMenuItem(input);
    revalidateEventDayPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function updateMenuItemAction(
  id: string,
  input: { category?: string; name?: string; description?: string | null; dietaryTag?: MenuDietaryTag | null; sortOrder?: number },
) {
  try {
    await requireAdminForMenuItem(id);
    await updateMenuItem(id, input);
    revalidateEventDayPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteMenuItemAction(id: string) {
  try {
    await requireAdminForMenuItem(id);
    await deleteMenuItem(id);
    revalidateEventDayPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}
