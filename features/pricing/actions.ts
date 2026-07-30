"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createDraftEvent } from "@/services/event-drafts";
import { wizardStepHref } from "@/features/start/wizard-steps";
import { PROMO_COOKIE } from "@/features/pricing/constants";

/**
 * Entry point used by every /pricing tier's "Get Started" button —
 * functionally identical to features/start/actions/begin.ts's
 * beginDraftAction (creates a draft, redirects into the wizard's first
 * step), but also reads an optional `promoCode` field off the submitted
 * form so the Free tier's CTA can carry "FREE" all the way through
 * without a separate code path.
 */
export async function beginDraftWithPlanAction(formData: FormData): Promise<void> {
  const rawPromoCode = formData.get("promoCode");
  const promoCode = typeof rawPromoCode === "string" ? rawPromoCode.trim() : "";

  const draft = await createDraftEvent();

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
