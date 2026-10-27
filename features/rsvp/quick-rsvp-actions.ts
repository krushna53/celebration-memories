"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { getEventForPublicRsvp } from "@/services/public-rsvp";
import { submitRsvp } from "@/services/rsvps";
import { getRsvpConfig } from "@/services/rsvp-config";
import { buildRsvpSchema, pickAnswers } from "@/lib/rsvp-config";
import { notifyAdminsOfRsvpSubmission } from "@/services/admin-notifications";
import { currentIpHash, isLockedOut, recordFailure } from "@/services/abuse-guard";
import {
  createNameOnlyInvitee,
  findInviteeForGuest,
  findOrCreateInviteeForGuest,
  getAttendance,
  getSignedInGuest,
  recordAttendance,
} from "@/services/quick-rsvp";
import { ATTENDANCE_OPTIONS, type AttendanceOption } from "@/types/rsvp";
import type { ConfiguredRsvpValues } from "@/features/rsvp/rsvp-config-fields";
import type { EventRecord } from "@/types/event";

export interface QuickRsvpGuest {
  name: string;
  email: string;
  phone: string | null;
  coming: AttendanceOption | null;
}

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const comingSchema = z.enum(ATTENDANCE_OPTIONS);
const nameSchema = z.string().trim().min(2, "Please enter your full name.").max(120);

async function notify(event: EventRecord, name: string, coming: AttendanceOption) {
  const host = (await headers()).get("host");
  notifyAdminsOfRsvpSubmission({
    eventId: event.id,
    honoreeName: event.honoreeName,
    eventTitle: event.eventTitle,
    values: { name, coming },
    host,
  }).catch((err) => console.error("notifyAdminsOfRsvpSubmission failed:", err));
}

/** Who is signed in (if anyone) and what they already answered — the guest is read from the session, never the client. */
export async function getQuickRsvpGuestAction(eventSlug: string): Promise<Result<QuickRsvpGuest | null>> {
  const event = await getEventForPublicRsvp(eventSlug);
  if (!event) return { success: false, error: "RSVP isn't open for this event." };
  const guest = await getSignedInGuest();
  if (!guest) return { success: true, data: null };
  const invitee = await findInviteeForGuest(event.id, guest);
  return {
    success: true,
    data: {
      name: invitee?.name ?? guest.name,
      email: guest.email,
      phone: invitee?.phone ?? guest.phone,
      coming: invitee ? await getAttendance(invitee.id) : null,
    },
  };
}

/** Yes / Maybe / No from a guest signed in with Google — matched to the guest list by email or phone, or added to it. */
export async function quickRsvpSignedInAction(eventSlug: string, coming: AttendanceOption): Promise<Result<QuickRsvpGuest>> {
  const parsedComing = comingSchema.safeParse(coming);
  if (!parsedComing.success) return { success: false, error: "Please choose one of the options." };
  const event = await getEventForPublicRsvp(eventSlug);
  if (!event) return { success: false, error: "RSVP isn't open for this event." };
  const guest = await getSignedInGuest();
  if (!guest) return { success: false, error: "Please confirm with Google first." };

  try {
    const invitee = await findOrCreateInviteeForGuest(event.id, guest);
    await recordAttendance(invitee.id, parsedComing.data);
    await notify(event, invitee.name, parsedComing.data);
    revalidatePath("/admin/invitees");
    return { success: true, data: { name: invitee.name, email: guest.email, phone: invitee.phone ?? guest.phone, coming: parsedComing.data } };
  } catch (err) {
    console.error("quickRsvpSignedInAction failed:", err);
    return { success: false, error: "Something went wrong saving your RSVP. Please try again." };
  }
}

/**
 * Maybe / No without signing in: a name is enough. Always adds a new guest
 * row (a typed name can't change anyone else's answer); a hidden honeypot
 * and a per-connection limit keep bots from filling the host's list.
 */
export async function quickRsvpNameOnlyAction(
  eventSlug: string,
  name: string,
  coming: AttendanceOption,
  honeypot?: string,
): Promise<Result> {
  if (honeypot) return { success: true, data: undefined };
  if (coming === "coming") return { success: false, error: "Please confirm with Google to say yes." };
  const parsedComing = comingSchema.safeParse(coming);
  const parsedName = nameSchema.safeParse(name);
  if (!parsedComing.success) return { success: false, error: "Please choose one of the options." };
  if (!parsedName.success) return { success: false, error: parsedName.error.issues[0]?.message ?? "Please enter your name." };

  const event = await getEventForPublicRsvp(eventSlug);
  if (!event) return { success: false, error: "RSVP isn't open for this event." };
  const ipHash = await currentIpHash();
  if (await isLockedOut("quick-rsvp", ipHash)) {
    return { success: false, error: "Too many replies from this connection — please try again later." };
  }

  try {
    const invitee = await createNameOnlyInvitee(event.id, parsedName.data);
    await recordAttendance(invitee.id, parsedComing.data);
    await recordFailure("quick-rsvp", ipHash);
    await notify(event, invitee.name, parsedComing.data);
    revalidatePath("/admin/invitees");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("quickRsvpNameOnlyAction failed:", err);
    return { success: false, error: "Something went wrong saving your reply. Please try again." };
  }
}

/** The optional "Fill in the form" details after a signed-in Yes — headcount, meal, phone, comments and the host's own questions. */
export async function saveQuickRsvpDetailsAction(eventSlug: string, values: ConfiguredRsvpValues): Promise<Result> {
  const event = await getEventForPublicRsvp(eventSlug);
  if (!event) return { success: false, error: "RSVP isn't open for this event." };
  const guest = await getSignedInGuest();
  if (!guest) return { success: false, error: "Please confirm with Google first." };

  const config = await getRsvpConfig(event.id);
  // The email is the Google account's, whatever the form sent.
  const parsed = buildRsvpSchema(config).safeParse({ ...values, email: guest.email, consent: true });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };

  try {
    const invitee = await findOrCreateInviteeForGuest(event.id, guest);
    await submitRsvp(invitee.id, parsed.data, config.questions.length > 0 ? pickAnswers(config, parsed.data.answers) : undefined);
    revalidatePath("/admin/invitees");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("saveQuickRsvpDetailsAction failed:", err);
    return { success: false, error: "Something went wrong saving your details. Please try again." };
  }
}
