import type { EventRecord } from "@/types/event";

export type RsvpPricingTier = "early_bird" | "regular";

export interface RsvpPrice {
  tier: RsvpPricingTier;
  amount: number;
  currency: string;
}

/**
 * Computes what a guest owes to confirm a "coming" RSVP for a paid
 * event, right now. Null means "don't show a payment step" — either
 * the event isn't paid, or it's paid but no regular price has been set
 * yet (a client toggled "paid event" on but hasn't finished pricing).
 *
 * Early-bird logic: rsvpEarlyBirdPrice applies strictly before
 * rsvpEarlyBirdDeadline; at or after the deadline (or with no deadline
 * set at all), rsvpRegularPrice applies. An early-bird price with no
 * deadline is treated as "no early-bird tier" — same as not setting an
 * early-bird price — since there's no way to know when it should stop.
 */
export function computeRsvpPrice(
  event: Pick<EventRecord, "isPaidEvent" | "rsvpRegularPrice" | "rsvpEarlyBirdPrice" | "rsvpEarlyBirdDeadline" | "rsvpCurrency">,
  now: Date = new Date(),
): RsvpPrice | null {
  if (!event.isPaidEvent) return null;
  if (event.rsvpRegularPrice === null || event.rsvpRegularPrice <= 0) return null;

  const currency = event.rsvpCurrency || "INR";

  if (
    event.rsvpEarlyBirdPrice !== null &&
    event.rsvpEarlyBirdPrice > 0 &&
    event.rsvpEarlyBirdDeadline &&
    now.getTime() < new Date(event.rsvpEarlyBirdDeadline).getTime()
  ) {
    return { tier: "early_bird", amount: event.rsvpEarlyBirdPrice, currency };
  }

  return { tier: "regular", amount: event.rsvpRegularPrice, currency };
}
