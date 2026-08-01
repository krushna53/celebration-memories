import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateDraftToken } from "@/lib/tokens";
import { listInvitees } from "@/services/admin-invitees";
import type { MenuDietaryTag, MenuItemRecord, ScheduleItemRecord } from "@/types/content";

/**
 * Backing service for the event-day "Schedule + Menu" feature — a
 * time-blocked run-of-show (e.g. "11:00 AM–12:00 PM — Cake Cutting") plus
 * a categorized menu list, admin-managed at /admin/event-day and shown to
 * guests per `events.event_day_mode` (see types/event.ts's doc comment on
 * that field for the "off" / "public" / "private" behavior).
 *
 * Private mode reuses the exact "phone number stands in for a login"
 * pattern already used by Games (see services/public-rsvp.ts's
 * findOrCreateSelfInvitee) — but check-only here, never creating a new
 * invitee, since this is view access, not an RSVP or a game entry.
 */

interface ScheduleItemRow {
  id: string;
  event_id: string;
  start_label: string;
  end_label: string | null;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

interface MenuItemRow {
  id: string;
  event_id: string;
  category: string;
  name: string;
  description: string | null;
  dietary_tag: MenuDietaryTag | null;
  sort_order: number;
  created_at: string;
}

function mapScheduleItem(row: ScheduleItemRow): ScheduleItemRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    startLabel: row.start_label,
    endLabel: row.end_label,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mapMenuItem(row: MenuItemRow): MenuItemRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    category: row.category,
    name: row.name,
    description: row.description,
    dietaryTag: row.dietary_tag,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------

export async function listScheduleItems(eventId: string): Promise<ScheduleItemRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("event_schedule_items")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to load schedule: ${error.message}`);
  return (data as ScheduleItemRow[]).map(mapScheduleItem);
}

/** Used to verify a schedule item belongs to the caller's event before modifying it. */
export async function getScheduleItemById(id: string): Promise<ScheduleItemRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("event_schedule_items")
    .select("*")
    .eq("id", id)
    .maybeSingle<ScheduleItemRow>();

  if (error) throw new Error(`Failed to look up schedule item: ${error.message}`);
  return data ? mapScheduleItem(data) : null;
}

export async function createScheduleItem(input: {
  eventId: string;
  startLabel: string;
  endLabel?: string | null;
  title: string;
  description?: string | null;
  sortOrder?: number;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("event_schedule_items").insert({
    event_id: input.eventId,
    start_label: input.startLabel,
    end_label: input.endLabel ?? null,
    title: input.title,
    description: input.description ?? null,
    sort_order: input.sortOrder ?? 0,
  });
  if (error) throw new Error(`Failed to add schedule item: ${error.message}`);
}

export async function updateScheduleItem(
  id: string,
  input: {
    startLabel?: string;
    endLabel?: string | null;
    title?: string;
    description?: string | null;
    sortOrder?: number;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.startLabel !== undefined) patch.start_label = input.startLabel;
  if (input.endLabel !== undefined) patch.end_label = input.endLabel;
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const { error } = await supabaseAdmin().from("event_schedule_items").update(patch).eq("id", id);
  if (error) throw new Error(`Failed to update schedule item: ${error.message}`);
}

export async function deleteScheduleItem(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("event_schedule_items").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete schedule item: ${error.message}`);
}

// ---------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------

export async function listMenuItems(eventId: string): Promise<MenuItemRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("event_menu_items")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to load menu: ${error.message}`);
  return (data as MenuItemRow[]).map(mapMenuItem);
}

export async function getMenuItemById(id: string): Promise<MenuItemRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("event_menu_items")
    .select("*")
    .eq("id", id)
    .maybeSingle<MenuItemRow>();

  if (error) throw new Error(`Failed to look up menu item: ${error.message}`);
  return data ? mapMenuItem(data) : null;
}

export async function createMenuItem(input: {
  eventId: string;
  category: string;
  name: string;
  description?: string | null;
  dietaryTag?: MenuDietaryTag | null;
  sortOrder?: number;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("event_menu_items").insert({
    event_id: input.eventId,
    category: input.category,
    name: input.name,
    description: input.description ?? null,
    dietary_tag: input.dietaryTag ?? null,
    sort_order: input.sortOrder ?? 0,
  });
  if (error) throw new Error(`Failed to add menu item: ${error.message}`);
}

export async function updateMenuItem(
  id: string,
  input: {
    category?: string;
    name?: string;
    description?: string | null;
    dietaryTag?: MenuDietaryTag | null;
    sortOrder?: number;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.category !== undefined) patch.category = input.category;
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.dietaryTag !== undefined) patch.dietary_tag = input.dietaryTag;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const { error } = await supabaseAdmin().from("event_menu_items").update(patch).eq("id", id);
  if (error) throw new Error(`Failed to update menu item: ${error.message}`);
}

export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("event_menu_items").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete menu item: ${error.message}`);
}

// ---------------------------------------------------------------------
// Private-mode share link + guest verification
// ---------------------------------------------------------------------

/** Returns the event's existing event-day share token, generating and saving one on first use. Mirrors ensurePlannerShareToken. */
export async function ensureEventDayShareToken(eventId: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("event_day_share_token")
    .eq("id", eventId)
    .maybeSingle<{ event_day_share_token: string | null }>();

  if (error) throw new Error(`Failed to load event-day link: ${error.message}`);
  if (data?.event_day_share_token) return data.event_day_share_token;

  const token = generateDraftToken();
  const { error: updateError } = await supabaseAdmin()
    .from("events")
    .update({ event_day_share_token: token })
    .eq("id", eventId);
  if (updateError) throw new Error(`Failed to create event-day link: ${updateError.message}`);
  return token;
}

/** Issues a fresh token, invalidating the old link. */
export async function regenerateEventDayShareToken(eventId: string): Promise<string> {
  const token = generateDraftToken();
  const { error } = await supabaseAdmin()
    .from("events")
    .update({ event_day_share_token: token })
    .eq("id", eventId);
  if (error) throw new Error(`Failed to regenerate event-day link: ${error.message}`);
  return token;
}

/** Resolves an event by its event-day share link token (private-mode access only). */
export async function getEventByEventDayToken(
  token: string,
): Promise<{ id: string; slug: string; honoreeName: string; eventTitle: string; menuStyle: "buffet" | "a_la_carte" } | null> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("id, slug, honoree_name, event_title, menu_style")
    .eq("event_day_share_token", token)
    .eq("event_day_mode", "private")
    .maybeSingle<{ id: string; slug: string; honoree_name: string; event_title: string; menu_style: "buffet" | "a_la_carte" }>();

  if (error) {
    console.error("getEventByEventDayToken failed:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    honoreeName: data.honoree_name,
    eventTitle: data.event_title,
    menuStyle: data.menu_style,
  };
}

/** Strips everything but digits, so "+91 98765 43210" and "9876543210" match — same normalization as services/public-rsvp.ts. */
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

/**
 * Check-only guest verification for private-mode event-day access: does
 * this phone number belong to a real invitee on this event? Unlike
 * findOrCreateSelfInvitee (used by RSVP/Games), this never creates a new
 * invitee — a guest who isn't found is simply denied, since there's
 * nothing here for them to "join."
 */
export async function verifyInviteeByPhone(eventId: string, phone: string): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 7) return false;

  const invitees = await listInvitees(eventId);
  return invitees.some((inv) => inv.phone && normalizePhone(inv.phone) === normalized);
}
