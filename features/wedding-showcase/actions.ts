"use server";

import { redirect } from "next/navigation";

import { startWeddingDraftAction } from "@/features/sacred-garden/actions";
import { cleanDesign } from "@/features/sacred-garden/lib/design";
import { resolveWizardSteps, wizardStepHref } from "@/features/start/wizard-steps";
import { getDraftEventByToken } from "@/services/event-drafts";
import { updateEvent } from "@/services/events";
import { showcaseSite } from "@/features/wedding-showcase/showcase-sites";
import { REELS, TEMPLATE_STORE_URL } from "@/features/wedding-showcase/reels/reel-templates";

/*
 * "Create your own" from the wedding galleries. Each press starts a fresh wedding draft (the draft token is the
 * credential, as everywhere in the wizard) and opens it on the right wizard step, so no two visitors ever share one.
 */

/**
 * A sample website (/wedding/webpages/<slug>): a new draft whose design is that sample — its opening, page design,
 * colours, fonts and sample text (design_config.showcase keeps which sample) — opened on the wizard's Design step,
 * where the couple edit it with the live preview.
 */
export async function startFromShowcaseAction(formData: FormData): Promise<void> {
  const site = showcaseSite(String(formData.get("slug") ?? ""));
  if (!site) redirect("/wedding/webpages");
  const started = await startWeddingDraftAction(null);
  if (!started.success) redirect("/wedding-websites/create");
  const { token } = started.data;
  const draft = await getDraftEventByToken(token);
  if (draft) {
    try {
      await updateEvent(draft.id, { designConfig: cleanDesign({ ...site.form, showcase: site.slug }, draft.id) });
    } catch {
      // the sample didn't pass the design checks: the Design step still opens, with the default design
    }
  }
  redirect(wizardStepHref(token, "design"));
}

/** True once the wizard has the AI reel step (it arrives with the AI reel work; until then reels use the template store). */
function hasAiReelStep(): boolean {
  return resolveWizardSteps(["website"], "wedding").some((step) => step.slug === "ai-reel");
}

/**
 * A sample reel (/wedding/reels): a new wedding draft opened on the wizard's AI Reel step, with the chosen reel in
 * ?reel= for the studio to start from. Where that step doesn't exist yet, the wedding template store instead.
 */
export async function startReelAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("reel") ?? "");
  const reel = REELS.find((r) => r.slug === slug);
  if (!reel || !hasAiReelStep()) redirect(TEMPLATE_STORE_URL);
  const started = await startWeddingDraftAction(null);
  if (!started.success) redirect(TEMPLATE_STORE_URL);
  redirect(`${wizardStepHref(started.data.token, "ai-reel")}?reel=${encodeURIComponent(reel.slug)}`);
}
