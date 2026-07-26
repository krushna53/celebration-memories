"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { findOrCreateSelfInvitee, getEventForPublicRsvp } from "@/services/public-rsvp";
import { submitRsvp } from "@/services/rsvps";
import { sendRsvpConfirmation } from "@/lib/email";
import { rsvpFormSchema, type RsvpFormValues } from "@/types/rsvp";

export type SubmitPublicRsvpResult =
  | { success: true }
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
  values: RsvpFormValues,
  honeypot?: string,
): Promise<SubmitPublicRsvpResult> {
  if (honeypot) {
    return { success: true };
  }

  const parsed = rsvpFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Please check the form and try again." };
  }

  if (!parsed.data.phone) {
    return {
      success: false,
      error: "Please enter your phone number — it's how we'll recognize you if you come back to update your RSVP.",
    };
  }

  const event = await getEventForPublicRsvp(eventSlug);
  if (!event) {
    return { success: false, error: "Public RSVP isn't open for this event." };
  }

  try {
    const invitee = await findOrCreateSelfInvitee(event.id, {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
    });
    await submitRsvp(invitee.id, parsed.data);
  } catch (err) {
    console.error("submitPublicRsvpAction failed:", err);
    return {
      success: false,
      error: "Something went wrong saving your RSVP. Please try again.",
    };
  }

  if (parsed.data.email) {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host");
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

  revalidatePath(`/events/${eventSlug}/rsvp`);
  return { success: true };
}
