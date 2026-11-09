import "server-only";
import { CONSENT_VERSION } from "@/lib/privacy-consent";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { GuestbookFormValues } from "@/types/guestbook";

export async function submitGuestbookEntry(params: {
  inviteeId: string;
  eventId: string;
  values: GuestbookFormValues;
  photoPath?: string | null;
}) {
  const { inviteeId, eventId, values, photoPath } = params;
  if (values.consent !== true) throw new Error("Guestbook consent is required.");

  if (values.consentVersion !== CONSENT_VERSION) throw new Error("Please refresh and review the current privacy notice.");
  const { error } = await supabaseAdmin().from("guestbook").insert({
    invitee_id: inviteeId,
    event_id: eventId,
    guest_name: values.guestName,
    message: values.message,
    country: values.country || null,
    photo_storage_path: photoPath || null,
    consent_at: new Date().toISOString(),
    consent_version: CONSENT_VERSION,
  });

  if (error) {
    throw new Error(`Failed to save guestbook entry: ${error.message}`);
  }
}
