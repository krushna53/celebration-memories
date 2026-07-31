"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createDraftEvent } from "@/services/event-drafts";
import { updateEvent } from "@/services/events";
import { wizardStepHref } from "@/features/start/wizard-steps";
import { PROMO_COOKIE } from "@/features/pricing/constants";
import { getPlanAiLimits } from "@/services/pricing-settings";

/**
 * Entry point used by every /pricing tier's "Get Started" button —
 * functionally identical to features/start/actions/begin.ts's
 * beginDraftAction (creates a draft, redirects into the wizard's first
 * step), but also reads an optional `promoCode` field (so the Free
 * tier's CTA can carry "FREE" all the way through) and a `planId` field
 * that sets this new draft's real AI credit limits.
 *
 * The AI image/slideshow generation caps are the one real, enforced
 * difference between /pricing tiers today — checked against usage in
 * features/admin/ai-image/actions.ts and
 * features/admin/slideshow/actions.ts (client-role admins are blocked
 * once they hit their event's limit; the owner is exempt). Every other
 * dashboard feature (Templates, Gallery, Timeline, Memories, Domain
 * Search, RSVP, guest uploads) is available on every event regardless
 * of plan. The actual numbers live in the pricing_plan_settings table
 * (see services/pricing-settings.ts's getPlanAiLimits), editable at
 * /admin/pricing-settings with no code deploy — this used to be a
 * hardcoded PLAN_AI_LIMITS map here, moved to the DB so the owner can
 * tune credit allowances the same way they already tune prices.
 */
export async function beginDraftWithPlanAction(formData: FormData): Promise<void> {
  const rawPromoCode = formData.get("promoCode");
  const promoCode = typeof rawPromoCode === "string" ? rawPromoCode.trim() : "";
  const rawPlanId = formData.get("planId");
  const planId = typeof rawPlanId === "string" ? rawPlanId : "";

  const draft = await createDraftEvent();

  const limits = await getPlanAiLimits(planId);
  if (limits) {
    await updateEvent(draft.id, limits);
  }

  if (promoCode) {
    const jar = await cookies();
    jar.set(PROMO_COOKIE, promoCode.toUpperCase(), {
      maxAge: 60 * 60, // 1 hour — comfortably longer than a first wizard pass, short enough not to linger
      path: "/start",
      httpOnly: true,
      sameSite: "lax",
    });
  }

  redirect(wizardStepHref(draft.token, "occasion"));
}
