import type { EventPaymentProvider } from "@/types/event-payment-settings";
import type { RsvpPricingTier } from "@/lib/rsvp-pricing";

export type RsvpPaymentStatus = "pending" | "paid" | "failed" | "rejected";

/** One payment attempt against a paid event's RSVP. Multiple rows per invitee are allowed (a guest can retry after a failed attempt) — see services/rsvp-payments.ts. */
export interface RsvpPaymentRecord {
  id: string;
  eventId: string;
  inviteeId: string;
  amount: number;
  currency: string;
  pricingTier: RsvpPricingTier;
  provider: EventPaymentProvider;
  status: RsvpPaymentStatus;
  externalId: string | null;
  /** Guest-entered UTR/reference note — only meaningful for provider "manual". */
  referenceNote: string | null;
  /** Owner/client note on approve or reject — only meaningful for provider "manual". */
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
}
