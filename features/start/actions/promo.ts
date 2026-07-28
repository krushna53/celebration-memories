"use server";

import { redirect } from "next/navigation";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { getAdminByEventId } from "@/services/admin-auth";
import { findActivePromoCode, redeemPromoCode } from "@/services/promo-codes";
import { claimDraftEvent } from "@/services/event-drafts";
import { recordWizardPayment } from "@/services/wizard-payments";

export type RedeemPromoResult = { success: false; error: string };

/**
 * Alternative to Stripe/Razorpay checkout on the wizard's payment step —
 * a valid, active, under-capacity promo code claims the draft directly
 * (free), with no payment processor involved at all. See
 * services/promo-codes.ts's redeemPromoCode for the atomic
 * check-and-increment that makes this safe under concurrent use of the
 * same code by different hosts.
 */
export async function redeemPromoCodeAction(token: string, eventId: string, code: string): Promise<RedeemPromoResult> {
  let event;
  try {
    event = await requireDraftEvent(token);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "This link is no longer valid." };
  }
  if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };

  if (!code.trim()) return { success: false, error: "Enter a promo code." };

  const admin = await getAdminByEventId(event.id);
  if (!admin) {
    return {
      success: false,
      error: "Please verify your email first — check your inbox for the confirmation link, then come back here.",
    };
  }

  const found = await findActivePromoCode(code);
  if (!found) return { success: false, error: "That code isn't valid." };

  const redeemed = await redeemPromoCode(code);
  if (!redeemed) {
    return { success: false, error: "That code has already reached its redemption limit." };
  }

  await claimDraftEvent(event.id);
  await recordWizardPayment({
    eventId: event.id,
    adminId: admin.id,
    provider: "promo",
    plan: "one_time",
    amount: 0,
    currency: "usd",
    promoCode: found.code,
  });

  redirect(`/start/success?slug=${encodeURIComponent(event.slug)}`);
}
