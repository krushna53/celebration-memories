"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createDraftEvent } from "@/services/event-drafts";
import { wizardStepHref } from "@/features/start/wizard-steps";
import { REF_COOKIE } from "@/lib/constants";

/**
 * Entry point for the self-serve onboarding wizard (app/start/page.tsx).
 * Creates a brand-new draft event and immediately redirects into the
 * Occasion step — always first, regardless of goals (which haven't
 * been chosen yet) — bound directly as a <form action={beginDraftAction}>,
 * so it works even before any client JS has hydrated.
 */
export async function beginDraftAction(): Promise<void> {
  const jar = await cookies();
  const referredByCode = jar.get(REF_COOKIE)?.value ?? null;

  const draft = await createDraftEvent(referredByCode);
  redirect(wizardStepHref(draft.token, "occasion"));
}
