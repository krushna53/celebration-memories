"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createDraftEvent } from "@/services/event-drafts";
import { wizardStepHref } from "@/features/start/wizard-steps";
import { REF_COOKIE } from "@/lib/constants";
import { parseEventSegment } from "@/lib/event-segment";

/**
 * Entry point for the self-serve onboarding wizard (app/start/page.tsx).
 * Creates a brand-new draft event and immediately redirects into the
 * Occasion step — always first, regardless of goals (which haven't
 * been chosen yet) — bound directly as a <form action={beginDraftAction}>,
 * so it works even before any client JS has hydrated.
 *
 * An optional `segment` field ("family" | "corporate", from the submit
 * button the host pressed on /start) picks which side of the Occasion
 * step opens first; forms without it behave exactly as before.
 */
export async function beginDraftAction(formData?: FormData): Promise<void> {
  const jar = await cookies();
  const referredByCode = jar.get(REF_COOKIE)?.value ?? null;

  const draft = await createDraftEvent(referredByCode, parseEventSegment(formData?.get("segment")));
  redirect(wizardStepHref(draft.token, "occasion"));
}
