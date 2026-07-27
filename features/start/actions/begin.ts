"use server";

import { redirect } from "next/navigation";

import { createDraftEvent } from "@/services/event-drafts";
import { WIZARD_STEPS, wizardStepHref } from "@/features/start/wizard-steps";

/**
 * Entry point for the self-serve onboarding wizard (app/start/page.tsx).
 * Creates a brand-new draft event and immediately redirects into its
 * first step — bound directly as a <form action={beginDraftAction}>, so
 * it works even before any client JS has hydrated.
 */
export async function beginDraftAction(): Promise<void> {
  const draft = await createDraftEvent();
  const firstStep = WIZARD_STEPS[0]!;
  redirect(wizardStepHref(draft.token, firstStep.slug));
}
