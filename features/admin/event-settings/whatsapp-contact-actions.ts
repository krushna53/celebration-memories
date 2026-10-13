"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { normaliseWhatsAppNumber, saveEventWhatsAppContact } from "@/services/event-extras";

/** Saves (or clears, when `number` is empty) the "Message us on WhatsApp" contact for one event. */
export async function updateWhatsAppContactAction(
  eventId: string,
  number: string,
  label: string,
): Promise<{ success: true; number: string | null } | { success: false; error: string }> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  const trimmed = number.trim();
  const digits = trimmed ? normaliseWhatsAppNumber(trimmed) : null;
  if (trimmed && !digits) return { success: false, error: "Enter a WhatsApp number with its country code, e.g. +91 70226 42121." };
  const cleanLabel = label.trim().replace(/\s+/g, " ").slice(0, 60) || null;

  try {
    await saveEventWhatsAppContact(eventId, digits, cleanLabel);
    revalidatePath("/events/[slug]", "page");
    revalidatePath("/invite/[token]", "page");
    revalidatePath("/admin/event-settings");
    return { success: true, number: digits };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}
