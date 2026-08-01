import "server-only";
import { randomBytes } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateDraftToken } from "@/lib/tokens";
import { mapEvent, type EventRow } from "@/services/events";
import type { EventRecord } from "@/types/event";

/**
 * Backing service for the no-login onboarding wizard (/start/[token]/...).
 * A draft is a completely ordinary `events` row — every existing
 * feature action (AI Image, Timeline, Gallery, Event Settings,
 * Slideshow, ...) already takes an `eventId` and works against it
 * unmodified. What's different is *who's allowed to call those actions*
 * for a draft: not a logged-in admin, but whoever holds the draft's
 * long random URL token. See features/start/actions.ts for the
 * draft-token-gated wrapper around each step's existing action.
 *
 * See supabase/migrations/*_draft_events_and_admin_scoping.sql for the
 * schema (`events.status`, `events.draft_token`, `admins.event_id`).
 */

function randomSlugSuffix(): string {
  return randomBytes(4).toString("hex");
}

/**
 * Creates a brand-new draft event with placeholder content — every field
 * here gets overwritten in the wizard's Event Settings step.
 *
 * `referredByCode` is the visitor's cm_ref_code cookie value, if any
 * (see middleware.ts) — passed in rather than read here, since this is a
 * plain service function with no request context. Stamped once at
 * creation and never overwritten; see services/referrals.ts for how the
 * admin Referrals dashboard surfaces events attributed this way.
 */
export async function createDraftEvent(referredByCode?: string | null): Promise<{ id: string; token: string; slug: string }> {
  const token = generateDraftToken();
  const slug = `draft-${randomSlugSuffix()}`;
  const now = new Date();
  const startAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days, placeholder
  const endAt = new Date(startAt.getTime() + 4 * 60 * 60 * 1000); // +4h, placeholder

  const { data, error } = await supabaseAdmin()
    .from("events")
    .insert({
      slug,
      status: "draft",
      draft_token: token,
      category: "birthday",
      honoree_name: "New Event",
      event_title: "My Celebration",
      hosted_by: "",
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      template_slug: "royal-gold",
      referred_by_code: referredByCode || null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) throw new Error(`Failed to create draft event: ${error?.message}`);
  return { id: data.id, token, slug };
}

/**
 * Resolves a draft event by its URL token — returns null if the token
 * doesn't match anything, OR if it matches an event that's already been
 * claimed (status is no longer 'draft'). That second case is
 * deliberate: once payment succeeds and the event goes live, the same
 * wizard link stops granting write access, even though the token value
 * itself is left in the row (see the migration's doc comment for why).
 */
export async function getDraftEventByToken(token: string): Promise<EventRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("*")
    .eq("draft_token", token)
    .eq("status", "draft")
    .maybeSingle<EventRow>();

  if (error) {
    console.error("getDraftEventByToken failed:", error.message);
    return null;
  }
  return data ? mapEvent(data) : null;
}

export interface DraftSummary {
  id: string;
  slug: string;
  honoreeName: string;
  eventTitle: string;
  createdAt: string;
}

/** For the owner-only draft management view (features/admin/drafts). */
export async function listDraftEvents(): Promise<DraftSummary[]> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("id, slug, honoree_name, event_title, created_at")
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list draft events: ${error.message}`);
  return (data as { id: string; slug: string; honoree_name: string; event_title: string; created_at: string }[]).map(
    (row) => ({
      id: row.id,
      slug: row.slug,
      honoreeName: row.honoree_name,
      eventTitle: row.event_title,
      createdAt: row.created_at,
    }),
  );
}

/** Permanently deletes a draft event and everything that cascades from it (photos, timeline entries, jobs, ...). Owner-only — see features/admin/drafts/actions.ts. */
export async function deleteDraftEvent(eventId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("events").delete().eq("id", eventId).eq("status", "draft");
  if (error) throw new Error(`Failed to delete draft event: ${error.message}`);
}

/**
 * Flips a draft to a real, live event and links it to the admin account
 * created for it — called by the Stripe webhook once payment succeeds
 * (see app/api/webhooks/stripe/route.ts). Not used anywhere in the
 * wizard itself.
 */
export async function claimDraftEvent(eventId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("events")
    .update({ status: "active" })
    .eq("id", eventId)
    .eq("status", "draft");
  if (error) throw new Error(`Failed to claim draft event: ${error.message}`);
}
