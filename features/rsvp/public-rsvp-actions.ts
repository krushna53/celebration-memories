"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { findOrCreateSelfInvitee, getEventForPublicRsvp } from "@/services/public-rsvp";
import { submitRsvp } from "@/services/rsvps";
import { sendRsvpConfirmation } from "@/lib/email";
import { buildRsvpSchema, pickAnswers } from "@/lib/rsvp-config";
import { getRsvpConfig } from "@/services/rsvp-config";
import type { ConfiguredRsvpValues } from "@/features/rsvp/rsvp-config-fields";
import { notifyAdminsOfRsvpSubmission } from "@/services/admin-notifications";
import { currentIpHash, isLockedOut, recordFailure } from "@/services/abuse-guard";
import { createNameOnlyInvitee } from "@/services/quick-rsvp";

/** Extra family members one name-only reply can carry (plus the person filling it in). */
const MAX_EXTRA_NAMES = 9;

export type SubmitPublicRsvpResult =
  | { success: true; inviteeId: string }
  | { success: false; error: string };

/**
 * Server Action backing the public, no-invite-link RSVP page
 * (/events/[slug]/rsvp). Unlike submitRsvpAction (features/rsvp/actions.ts),
 * there's no token to resolve an invitee from — instead this re-checks
 * that the event has opted into public RSVP server-side (never trusts
 * the client), then matches or creates an invitee by phone number.
 *
 * `honeypot` is a hidden form field real guests never see or fill in —
 * if it comes back non-empty, a bot filled the form, so this quietly
 * reports success without writing anything. This page is reachable
 * without any secret token, so it needs its own light spam guard that
 * the per-guest invite links don't.
 */
export async function submitPublicRsvpAction(
  eventSlug: string,
  values: ConfiguredRsvpValues,
  honeypot?: string,
): Promise<SubmitPublicRsvpResult> {
  if (honeypot) {
    // Quietly report success without writing anything — inviteeId is
    // never used by the client on this path since nothing was saved.
    return { success: true, inviteeId: "" };
  }

  const event = await getEventForPublicRsvp(eventSlug);
  if (!event) {
    return { success: false, error: "Public RSVP isn't open for this event." };
  }

  // Validated against this event's own RSVP form setup; phone stays required here (it identifies a returning guest).
  const config = await getRsvpConfig(event.id);
  const parsed = buildRsvpSchema(config, { forcePhone: true }).safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Please check the form and try again." };
  }

  if (!parsed.data.phone) {
    return {
      success: false,
      error: "Please enter your phone number — it's how we'll recognize you if you come back to update your RSVP.",
    };
  }

  let inviteeId: string;
  try {
    const invitee = await findOrCreateSelfInvitee(event.id, {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
    });
    inviteeId = invitee.id;
    await submitRsvp(invitee.id, parsed.data, config.questions.length > 0 ? pickAnswers(config, parsed.data.answers) : undefined);
  } catch (err) {
    console.error("submitPublicRsvpAction failed:", err);
    return {
      success: false,
      error: "Unable to save this public reply. To update an existing reply, use your personal invitation or verified Google sign-in. Otherwise, contact the host.",
    };
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");

  if (parsed.data.email) {
    const eventUrl = host ? `https://${host}/events/${eventSlug}` : `/events/${eventSlug}`;
    sendRsvpConfirmation({
      guestEmail: parsed.data.email,
      guestName: parsed.data.name,
      honoreeName: event.honoreeName,
      eventTitle: event.eventTitle,
      coming: parsed.data.coming,
      eventUrl,
    }).catch((err) => console.error("sendRsvpConfirmation failed:", err));
  }

  notifyAdminsOfRsvpSubmission({
    eventId: event.id,
    honoreeName: event.honoreeName,
    eventTitle: event.eventTitle,
    values: parsed.data,
    host,
  }).catch((err) => console.error("notifyAdminsOfRsvpSubmission failed:", err));

  revalidatePath(`/events/${eventSlug}/rsvp`);
  return { success: true, inviteeId };
}

/**
 * The shared RSVP for events whose form is set to "name only"
 * (RsvpConfig.nameOnly): a name, the attendance choice and the host's own
 * questions. Like quickRsvpNameOnlyAction it always adds a new guest row (a
 * typed name can't overwrite anyone else's reply), guarded by the honeypot
 * and a per-connection limit.
 */
export async function submitNameOnlyRsvpAction(
  eventSlug: string,
  values: ConfiguredRsvpValues,
  honeypot?: string,
  /** Family members replying together — each becomes their own guest row with the same reply and answers. */
  extraNames: string[] = [],
): Promise<SubmitPublicRsvpResult> {
  if (honeypot) return { success: true, inviteeId: "" };

  const event = await getEventForPublicRsvp(eventSlug);
  if (!event) return { success: false, error: "RSVP isn't open for this event." };
  const config = await getRsvpConfig(event.id);
  if (!config.nameOnly) return { success: false, error: "Please use the full RSVP form for this event." };

  // Only the name, reply and answers are taken from the guest — every other field gets the table defaults.
  const parsed = buildRsvpSchema(config).safeParse({
    name: values.name,
    coming: values.coming,
    answers: values.answers,
    adults: 1,
    children: 0,
    mealPreference: "no_preference",
    consent: true,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const others = extraNames.map((n) => n.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (others.length > MAX_EXTRA_NAMES) return { success: false, error: `Please add at most ${MAX_EXTRA_NAMES + 1} names in one reply.` };
  if (others.some((n) => n.length < 2 || n.length > 120)) return { success: false, error: "Please enter each person's full name." };

  const ipHash = await currentIpHash();
  if (await isLockedOut("quick-rsvp", ipHash)) {
    return { success: false, error: "Too many replies from this connection — please try again later." };
  }

  let inviteeId: string;
  try {
    const answers = pickAnswers(config, parsed.data.answers);
    const invitee = await createNameOnlyInvitee(event.id, parsed.data.name);
    inviteeId = invitee.id;
    await submitRsvp(invitee.id, parsed.data, answers);
    for (const name of others) {
      const extra = await createNameOnlyInvitee(event.id, name);
      await submitRsvp(extra.id, { ...parsed.data, name }, answers);
    }
    // One submission counts once, however many names it carries.
    await recordFailure("quick-rsvp", ipHash);
  } catch (err) {
    console.error("submitNameOnlyRsvpAction failed:", err);
    return { success: false, error: "Something went wrong saving your RSVP. Please try again." };
  }

  notifyAdminsOfRsvpSubmission({
    eventId: event.id,
    honoreeName: event.honoreeName,
    eventTitle: event.eventTitle,
    values: others.length > 0 ? { ...parsed.data, name: [parsed.data.name, ...others].join(", ") } : parsed.data,
    host: (await headers()).get("host"),
  }).catch((err) => console.error("notifyAdminsOfRsvpSubmission failed:", err));

  revalidatePath("/admin/invitees");
  return { success: true, inviteeId };
}
