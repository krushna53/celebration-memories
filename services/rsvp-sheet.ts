import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { generateDraftToken } from "@/lib/tokens";
import { getRsvpConfig } from "@/services/rsvp-config";
import { getRsvpExportRows } from "@/services/admin-invitees";
import { fieldLabel } from "@/lib/rsvp-config";
import { SITE_URL } from "@/lib/constants";
import type { RsvpStatus } from "@/types/event";

/**
 * Live RSVP sheet: a secret per-event link (events.rsvp_sheet_token) that
 * serves the guest list as CSV, so a host can keep a Google Sheet in their
 * own Drive with =IMPORTDATA("<link>") and share it with someone who has no
 * admin login. Google re-fetches it on its own schedule (roughly hourly),
 * so new replies appear without anyone touching the sheet.
 *
 * Possession of the token is the credential (same model as invite links);
 * regenerating it cuts off every sheet that used the old one.
 */

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function rsvpSheetUrl(token: string): string {
  return `${SITE_URL}/api/rsvp-sheet/${token}`;
}

export async function getRsvpSheetToken(eventId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin().from("events").select("rsvp_sheet_token").eq("id", eventId).maybeSingle<{ rsvp_sheet_token: string | null }>();
  if (error) throw new Error(`Failed to load the sheet link: ${error.message}`);
  return data?.rsvp_sheet_token ?? null;
}

/** Creates the link, or replaces it (cutting off the old one). */
export async function regenerateRsvpSheetToken(eventId: string): Promise<string> {
  const token = generateDraftToken();
  const { error } = await supabaseAdmin().from("events").update({ rsvp_sheet_token: token }).eq("id", eventId);
  if (error) throw new Error(`Failed to create the sheet link: ${error.message}`);
  return token;
}

export async function disableRsvpSheetToken(eventId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("events").update({ rsvp_sheet_token: null }).eq("id", eventId);
  if (error) throw new Error(`Failed to turn off the sheet link: ${error.message}`);
}

const STATUS_LABELS: Record<RsvpStatus, string> = {
  coming: "Coming",
  maybe: "Maybe",
  not_coming: "Not coming",
  pending: "No reply yet",
};

/**
 * "2026-11-19T09:00:00Z" in the event's timezone → "19 Nov 2026 · 2:30 PM". Kept as text on purpose:
 * IMPORTDATA turns anything that looks like a date into a bare serial number (46345.02) with no date format.
 */
function sheetDateTime(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day} ${p.month} ${p.year} · ${p.hour}:${p.minute} ${String(p.dayPeriod).toUpperCase()}`;
}

type SheetRow = Record<string, string | number | null>;

/** The CSV for a sheet token, or null when no event has it. Columns follow the event's RSVP form (hidden fields are left out). */
export async function buildRsvpSheetCsv(token: string): Promise<string | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const { data: event } = await supabaseAdmin()
    .from("events")
    .select("id, timezone")
    .eq("rsvp_sheet_token", token)
    .maybeSingle<{ id: string; timezone: string | null }>();
  if (!event) return null;

  const [config, rows] = await Promise.all([getRsvpConfig(event.id), getRsvpExportRows(event.id)]);
  const timeZone = event.timezone || "Asia/Kolkata";
  const f = config.fields;

  const columns: CsvColumn<SheetRow>[] = [
    { key: "name", label: "Name" },
    { key: "status", label: "RSVP" },
    ...(f.adults.visible ? [{ key: "adults", label: fieldLabel(config, "adults") }] : []),
    ...(f.children.visible ? [{ key: "children", label: fieldLabel(config, "children") }] : []),
    ...(f.phone.visible ? [{ key: "phone", label: fieldLabel(config, "phone") }] : []),
    ...(f.email.visible ? [{ key: "email", label: fieldLabel(config, "email") }] : []),
    ...(f.mealPreference.visible ? [{ key: "meal", label: fieldLabel(config, "mealPreference") }] : []),
    ...config.questions.map((q) => ({ key: `q:${q.id}`, label: q.label })),
    ...(f.comments.visible ? [{ key: "comments", label: fieldLabel(config, "comments") }] : []),
    { key: "repliedAt", label: "Replied at" },
    { key: "checkedIn", label: "Checked in" },
  ];

  // oldest first, so new guests land at the bottom of the sheet
  const sheetRows: SheetRow[] = [...rows].reverse().map((r) => ({
    name: r.name,
    status: STATUS_LABELS[r.rsvpStatus] ?? r.rsvpStatus,
    adults: r.adults,
    children: r.children,
    phone: r.phone,
    email: r.email,
    meal: r.mealPreference ? r.mealPreference.replace(/_/g, " ") : null,
    comments: r.comments,
    repliedAt: sheetDateTime(r.submittedAt, timeZone),
    checkedIn: r.checkedIn ? "Yes" : "",
    ...Object.fromEntries(config.questions.map((q) => [`q:${q.id}`, r.answers?.[q.id] ?? null])),
  }));

  return toCsv(sheetRows, columns);
}
