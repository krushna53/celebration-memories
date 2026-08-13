"use server";

import { revalidatePath } from "next/cache";

import { requireCheckInAccessForSession } from "@/services/admin-auth";
import { getScheduleItemById } from "@/services/event-day";
import { getRegistrationByQrToken, getRegistrationById, checkInRegistration, undoCheckIn } from "@/services/session-registrations";
import { getInviteeById } from "@/services/invitees";

export type CheckInResult =
  | { success: true; registrationId: string; guestName: string; alreadyCheckedIn: boolean; attendedAt: string }
  | { success: false; error: string };

async function resolveAndCheckIn(scheduleItemId: string, registrationId: string): Promise<CheckInResult> {
  const session = await getScheduleItemById(scheduleItemId);
  if (!session) return { success: false, error: "Session not found." };

  try {
    const admin = await requireCheckInAccessForSession(session.eventId, scheduleItemId);
    const before = await getRegistrationById(registrationId);
    const wasAlreadyIn = Boolean(before?.attendedAt);
    const registration = await checkInRegistration(registrationId, admin.id);
    const found = await getInviteeById(registration.inviteeId);
    revalidatePath("/admin/my-sessions");
    revalidatePath("/admin/event-day");
    return {
      success: true,
      registrationId: registration.id,
      guestName: found?.invitee.name ?? "Guest",
      alreadyCheckedIn: wasAlreadyIn,
      attendedAt: registration.attendedAt ?? new Date().toISOString(),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Check-in failed." };
  }
}

/** Camera-scan or manually-typed code entry point — the guest's own check-in code (session_registrations.qr_token), scoped to this one session so a code from a different session can't be reused here. */
export async function checkInByCodeAction(scheduleItemId: string, code: string): Promise<CheckInResult> {
  if (!code.trim()) return { success: false, error: "Enter a check-in code." };

  const session = await getScheduleItemById(scheduleItemId);
  if (!session) return { success: false, error: "Session not found." };

  try {
    await requireCheckInAccessForSession(session.eventId, scheduleItemId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  const registration = await getRegistrationByQrToken(scheduleItemId, code);
  if (!registration) return { success: false, error: "That code doesn't match anyone registered for this session." };

  return resolveAndCheckIn(scheduleItemId, registration.id);
}

/** "Mark Attended" button on the attendee table — the registration id is already known there, so this skips the code lookup. */
export async function checkInByRegistrationIdAction(scheduleItemId: string, registrationId: string): Promise<CheckInResult> {
  return resolveAndCheckIn(scheduleItemId, registrationId);
}

export type UndoCheckInResult = { success: true } | { success: false; error: string };

export async function undoCheckInAction(scheduleItemId: string, registrationId: string): Promise<UndoCheckInResult> {
  const session = await getScheduleItemById(scheduleItemId);
  if (!session) return { success: false, error: "Session not found." };

  try {
    await requireCheckInAccessForSession(session.eventId, scheduleItemId);
    await undoCheckIn(registrationId);
    revalidatePath("/admin/my-sessions");
    revalidatePath("/admin/event-day");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to undo check-in." };
  }
}
