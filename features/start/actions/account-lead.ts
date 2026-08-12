"use server";

import { recordWizardAccountLead } from "@/services/wizard-leads";

/**
 * Fire-and-forget notification that a wizard visitor's Create Account
 * attempt didn't go through cleanly (features/start/account-form.tsx) —
 * see services/wizard-leads.ts's recordWizardAccountLead for the shared
 * insert-plus-email logic and the sibling Route Handler
 * (app/api/wizard/account-lead/route.ts) used for the "left the page
 * entirely" case, where a Server Action call isn't guaranteed to survive
 * page teardown the way navigator.sendBeacon is.
 *
 * Deliberately returns nothing and never throws to the caller — this is
 * a background signal, not something that should ever block or surface
 * as an error on top of the signup failure the visitor already hit.
 */
export async function reportAccountCreationErrorAction(input: {
  eventId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  errorMessage: string;
}): Promise<void> {
  await recordWizardAccountLead({
    draftEventId: input.eventId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    reason: "error",
    errorMessage: input.errorMessage,
  });
}
