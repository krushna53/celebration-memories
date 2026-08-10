import type { EventRecord } from "@/types/event";
import type { ScheduleItemRecord } from "@/types/content";

export type RsvpPricingTier = "early_bird" | "regular";

export interface RsvpPrice {
  tier: RsvpPricingTier;
  amount: number;
  currency: string;
}

interface PricingTiers {
  isPaid: boolean;
  regularPrice: number | null;
  earlyBirdPrice: number | null;
  earlyBirdDeadline: string | null;
  currency: string;
}

/**
 * Shared by computeRsvpPrice (event-level ticket) and
 * computeSessionPrice (per-session, #63) — both use the identical
 * early-bird-before-a-deadline shape. Null means "don't show a payment
 * step": either not paid, or paid but no regular price set yet (a
 * client toggled pricing on but hasn't finished configuring it).
 *
 * Early-bird logic: earlyBirdPrice applies strictly before
 * earlyBirdDeadline; at or after the deadline (or with no deadline set
 * at all), regularPrice applies. An early-bird price with no deadline
 * is treated as "no early-bird tier" — same as not setting one — since
 * there's no way to know when it should stop.
 */
function computePrice(tiers: PricingTiers, now: Date): RsvpPrice | null {
  if (!tiers.isPaid) return null;
  if (tiers.regularPrice === null || tiers.regularPrice <= 0) return null;

  const currency = tiers.currency || "INR";

  if (
    tiers.earlyBirdPrice !== null &&
    tiers.earlyBirdPrice > 0 &&
    tiers.earlyBirdDeadline &&
    now.getTime() < new Date(tiers.earlyBirdDeadline).getTime()
  ) {
    return { tier: "early_bird", amount: tiers.earlyBirdPrice, currency };
  }

  return { tier: "regular", amount: tiers.regularPrice, currency };
}

/** What a guest owes to confirm a "coming" RSVP for a paid event, right now. */
export function computeRsvpPrice(
  event: Pick<EventRecord, "isPaidEvent" | "rsvpRegularPrice" | "rsvpEarlyBirdPrice" | "rsvpEarlyBirdDeadline" | "rsvpCurrency">,
  now: Date = new Date(),
): RsvpPrice | null {
  return computePrice(
    {
      isPaid: event.isPaidEvent,
      regularPrice: event.rsvpRegularPrice,
      earlyBirdPrice: event.rsvpEarlyBirdPrice,
      earlyBirdDeadline: event.rsvpEarlyBirdDeadline,
      currency: event.rsvpCurrency,
    },
    now,
  );
}

/** What a guest owes to register for one paid Event Day session, right now (#63). Null when the session doesn't require payment (free registration) or isn't priced yet. */
export function computeSessionPrice(
  session: Pick<ScheduleItemRecord, "isPaidSession" | "regularPrice" | "earlyBirdPrice" | "earlyBirdDeadline" | "currency">,
  now: Date = new Date(),
): RsvpPrice | null {
  return computePrice(
    {
      isPaid: session.isPaidSession,
      regularPrice: session.regularPrice,
      earlyBirdPrice: session.earlyBirdPrice,
      earlyBirdDeadline: session.earlyBirdDeadline,
      currency: session.currency,
    },
    now,
  );
}
