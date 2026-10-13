import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sanitizeCardTheme, type CardTheme } from "@/lib/card-theme";

/**
 * Two small per-event settings kept out of EventRecord and read only where
 * they're shown (migration 20261013120000_whatsapp_contact_and_card_theme.sql):
 *
 *  - WhatsApp contact: "Message us on WhatsApp" next to RSVP.
 *  - Card theme: colours read off the invitation card, for the
 *    "Matched to your card" template (lib/card-theme.ts).
 *
 * Reads degrade to null on any error so a page never breaks over them.
 */
export interface EventWhatsAppContact {
  /** Digits only, with country code, e.g. "917022642121". */
  number: string;
  label: string | null;
}

export async function getEventWhatsAppContact(eventId: string): Promise<EventWhatsAppContact | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .select("whatsapp_contact, whatsapp_contact_label")
      .eq("id", eventId)
      .maybeSingle<{ whatsapp_contact: string | null; whatsapp_contact_label: string | null }>();
    if (error || !data?.whatsapp_contact) return null;
    return { number: data.whatsapp_contact, label: data.whatsapp_contact_label };
  } catch {
    return null;
  }
}

/**
 * Normalises a typed number to wa.me digits. A 10-digit number is assumed
 * Indian (+91) — the platform's default market — anything else must carry
 * its country code. Returns null for anything that can't be a phone number.
 */
export function normaliseWhatsAppNumber(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return /^[0-9]{11,15}$/.test(digits) ? digits : null;
}

export async function saveEventWhatsAppContact(eventId: string, number: string | null, label: string | null): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("events")
    .update({ whatsapp_contact: number, whatsapp_contact_label: number ? label : null })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
}

export async function getEventCardTheme(eventId: string): Promise<CardTheme | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .select("card_theme")
      .eq("id", eventId)
      .maybeSingle<{ card_theme: unknown }>();
    if (error || !data) return null;
    return sanitizeCardTheme(data.card_theme);
  } catch {
    return null;
  }
}

export async function saveEventCardTheme(eventId: string, theme: CardTheme | null): Promise<void> {
  const { error } = await supabaseAdmin().from("events").update({ card_theme: theme }).eq("id", eventId);
  if (error) throw new Error(error.message);
}
