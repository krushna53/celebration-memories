import "server-only";
import { CONSENT_VERSION } from "@/lib/privacy-consent";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { createInvitee, listInvitees } from "@/services/admin-invitees";
import { normaliseWhatsAppNumber } from "@/services/event-extras";
import { logActivity } from "@/services/tracking";
import type { AttendanceOption } from "@/types/rsvp";
import type { InviteeRecord } from "@/types/event";

/**
 * The 3-click public RSVP (features/rsvp/quick-rsvp.tsx): Yes → Confirm
 * with Google → done. The guest's identity is their Supabase Auth session
 * (Google sign-in), always read server-side here — never a name, email or
 * id the client sends. Maybe / No without signing in take a name only.
 */
export interface SignedInGuest {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
}

export async function getSignedInGuest(): Promise<SignedInGuest | null> {
  try {
    const { data } = await (await supabaseServer()).auth.getUser();
    const user = data.user;
    if (!user?.email || !user.email_confirmed_at) return null;
    const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
    const name = (meta.full_name || meta.name || user.email.split("@")[0] || "Guest").trim().slice(0, 120);
    return { userId: user.id, name, email: user.email.toLowerCase(), phone: user.phone_confirmed_at ? user.phone || null : null };
  } catch {
    return null;
  }
}

/** This event's invitee for a signed-in guest — matched by email, then by phone — or null. */
export async function findInviteeForGuest(eventId: string, guest: SignedInGuest): Promise<InviteeRecord | null> {
  const invitees = await listInvitees(eventId);
  const byEmail = invitees.find((inv) => inv.email?.trim().toLowerCase() === guest.email);
  if (byEmail) return byEmail;
  const phone = guest.phone ? normaliseWhatsAppNumber(guest.phone) : null;
  if (!phone) return null;
  return invitees.find((inv) => inv.phone && normaliseWhatsAppNumber(inv.phone) === phone) ?? null;
}

export async function findOrCreateInviteeForGuest(eventId: string, guest: SignedInGuest): Promise<InviteeRecord> {
  const existing = await findInviteeForGuest(eventId, guest);
  if (existing) {
    // Fill in what the host didn't have, without overwriting what they typed.
    const patch: Record<string, string> = {};
    if (!existing.email) patch.email = guest.email;
    if (!existing.phone && guest.phone) patch.phone = guest.phone;
    if (Object.keys(patch).length > 0) {
      await supabaseAdmin().from("invitees").update(patch).eq("id", existing.id);
    }
    return existing;
  }
  return createInvitee(eventId, { name: guest.name, phone: guest.phone, email: guest.email, relationship: "Public RSVP" });
}

/** A name-only Maybe / No from someone who didn't sign in — always a new row, so typing a name can't change someone else's answer. */
export async function createNameOnlyInvitee(eventId: string, name: string): Promise<InviteeRecord> {
  return createInvitee(eventId, { name, phone: null, email: null, relationship: "Public RSVP" });
}

/**
 * Records just the attendance answer. An existing RSVP keeps its headcount,
 * meal and comments (only `coming` changes); a new one gets the table
 * defaults (1 adult, no children, no meal preference).
 */
export async function recordAttendance(inviteeId: string, coming: AttendanceOption, consentVersion: string): Promise<void> {
  if (consentVersion !== CONSENT_VERSION) throw new Error("Please refresh and review the current privacy notice.");
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await db
    .from("rsvps")
    .upsert({ invitee_id: inviteeId, coming, submitted_at: now, consent_at: now, consent_version: CONSENT_VERSION }, { onConflict: "invitee_id" });
  if (error) throw new Error(`Failed to save RSVP: ${error.message}`);

  const { error: inviteeError } = await db.from("invitees").update({ rsvp_status: coming }).eq("id", inviteeId);
  if (inviteeError) throw new Error(`Failed to update invitee status: ${inviteeError.message}`);

  await logActivity(inviteeId, "rsvp_submitted");
}

/** The answer this invitee already gave, if any — to show "You're on the list" when they come back. */
export async function getAttendance(inviteeId: string): Promise<AttendanceOption | null> {
  const { data } = await supabaseAdmin().from("rsvps").select("coming").eq("invitee_id", inviteeId).maybeSingle<{ coming: AttendanceOption }>();
  return data?.coming ?? null;
}
