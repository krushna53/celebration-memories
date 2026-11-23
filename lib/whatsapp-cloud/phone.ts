/**
 * Phone numbers for the Cloud API: international format as bare digits
 * (country code + subscriber number, no "+"), e.g. "919987982969" —
 * that's the shape Meta's `to` field and webhook `wa_id`/`from` use, so
 * one normalised form works for sending, consent lookups and matching
 * inbound replies.
 */

export type PhoneResult = { ok: true; phone: string } | { ok: false; error: string };

/**
 * Normalises what a guest or host typed: strips spaces/dashes/brackets,
 * drops a leading "+" or "00", turns a national number with a trunk "0"
 * (e.g. "09987982969") or a bare 10-digit number into
 * `defaultCountryCode` + number. Rejects anything that isn't 8–15 digits
 * afterwards (E.164's limit) and, for India, mobile numbers that can't
 * exist (must start 6–9).
 */
export function normalizeWhatsAppPhone(input: string | null | undefined, defaultCountryCode = "91"): PhoneResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: "No phone number." };
  if (/[a-z]/i.test(raw)) return { ok: false, error: "Phone number contains letters." };

  const hasPlus = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");
  const cc = defaultCountryCode.replace(/\D/g, "");

  if (!hasPlus) {
    if (digits.startsWith("00")) {
      digits = digits.slice(2);
    } else if (digits.startsWith("0") && digits.length === 11) {
      digits = cc + digits.slice(1);
    } else if (digits.length === 10) {
      digits = cc + digits;
    }
  }

  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) {
    return { ok: false, error: "Enter a full phone number with its country code." };
  }
  if (digits.startsWith("91") && digits.length === 12 && !/^91[6-9]/.test(digits)) {
    return { ok: false, error: "That isn't a valid Indian mobile number." };
  }
  return { ok: true, phone: digits };
}

/** "919987982969" → "+91 ••••• •2969" — enough for an admin to tell numbers apart without exposing them in full. */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  const countryCode = phone.length > 10 ? phone.slice(0, phone.length - 10) : "";
  return `${countryCode ? `+${countryCode} ` : ""}•••••${phone.slice(-4)}`;
}
