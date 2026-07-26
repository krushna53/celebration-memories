import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { GuestbookFormValues } from "@/types/guestbook";

export async function submitGuestbookEntry(params: {
  inviteeId: string;
  eventId: string;
  values: GuestbookFormValues;
  photoPath?: string | null;
}) {
  const { inviteeId, eventId, values, photoPath } = params;

  const { error } = await supabaseAdmin().from("guestbook").insert({
    invitee_id: inviteeId,
    event_id: eventId,
    guest_name: values.guestName,
    message: values.message,
    country: values.country || null,
    photo_storage_path: photoPath || null,
    consent_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to save guestbook entry: ${error.message}`);
  }
}
