import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendWizardAccountLeadNotification } from "@/lib/email";

/**
 * Records + notifies on a "reached Create Account but didn't make it
 * through" moment in the self-serve wizard (features/start/account-
 * form.tsx) — either a hard failure (Supabase Auth's signUp() call
 * itself errored) or a soft drop-off (they typed an email/phone in and
 * left the page without ever submitting successfully). Two call sites:
 *
 * - features/start/actions/account-lead.ts's reportAccountCreationErrorAction
 *   — called directly by the form right after a signUp() error, while
 *   the page is still fully alive.
 * - app/api/wizard/account-lead/route.ts — a plain Route Handler (not a
 *   Server Action) hit via navigator.sendBeacon/fetch(keepalive) on
 *   beforeunload/pagehide, since a Server Action invocation isn't
 *   guaranteed to complete once the browser starts tearing the page
 *   down — sendBeacon is the one API designed to survive that.
 *
 * Deliberately best-effort: swallows its own errors (logs, doesn't
 * throw) since this is a background notification, never something that
 * should surface as a user-facing failure on top of whatever already
 * went wrong with their signup.
 */
export async function recordWizardAccountLead(input: {
  draftEventId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  reason: "error" | "abandoned";
  errorMessage?: string | null;
}): Promise<void> {
  // Nothing worth recording or notifying about if we have no way to
  // reach this person at all.
  if (!input.email?.trim() && !input.phone?.trim()) return;

  try {
    const client = supabaseAdmin();

    const { error: insertError } = await client.from("wizard_account_leads").insert({
      draft_event_id: input.draftEventId,
      name: input.name?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      reason: input.reason,
      error_message: input.errorMessage?.trim() || null,
    });
    if (insertError) {
      console.error("Failed to record wizard account lead:", insertError.message);
    }

    let eventTitle: string | null = null;
    if (input.draftEventId) {
      const { data: event } = await client
        .from("events")
        .select("honoree_name, event_title")
        .eq("id", input.draftEventId)
        .maybeSingle<{ honoree_name: string; event_title: string }>();
      eventTitle = event ? `${event.honoree_name} — ${event.event_title}` : null;
    }

    await sendWizardAccountLeadNotification({
      name: input.name?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      reason: input.reason,
      errorMessage: input.errorMessage?.trim() || null,
      eventTitle,
    });
  } catch (err) {
    console.error("recordWizardAccountLead failed:", err instanceof Error ? err.message : err);
  }
}
