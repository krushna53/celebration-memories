import "server-only";
import { randomBytes } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidSlug } from "@/lib/slug";
import { EVENT_SLUG } from "@/lib/constants";
import type { SectionConfigItem } from "@/lib/section-registry";
import type { EventRecord } from "@/types/event";

export interface EventRow {
  id: string;
  slug: string;
  category: EventRecord["category"];
  occasion: string | null;
  honoree_name: string;
  event_title: string;
  hosted_by: string;
  venue_name: string | null;
  venue_address: string | null;
  maps_url: string | null;
  maps_embed_url: string | null;
  parking_info: string | null;
  start_at: string;
  end_at: string;
  dress_code: string | null;
  hero_video_url: string | null;
  timezone: string;
  visibility: "public" | "private";
  short_description: string | null;
  occasion_date: string | null;
  template_slug: string | null;
  invite_message_template: string | null;
  public_rsvp_enabled: boolean;
  public_memories_enabled: boolean;
  share_image_path: string | null;
  share_video_path: string | null;
  highlight_reel_path: string | null;
  section_config: SectionConfigItem[] | null;
  ai_image_generation_limit: number;
  ai_css_generation_limit: number;
  slideshow_video_generation_limit: number;
  video_editor_generation_limit: number;
  additional_notes: string | null;
  wish_message: string | null;
  custom_css: string | null;
  wizard_goals: string[] | null;
  event_day_mode: "off" | "public" | "private";
  event_day_share_token: string | null;
  menu_style: "buffet" | "a_la_carte";
  ai_avatar_enabled: boolean;
  ai_avatar_daily_message_limit: number;
  created_at: string;
  updated_at: string;
}

export function mapEvent(row: EventRow): EventRecord {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    occasion: row.occasion,
    honoreeName: row.honoree_name,
    eventTitle: row.event_title,
    hostedBy: row.hosted_by,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    mapsUrl: row.maps_url,
    mapsEmbedUrl: row.maps_embed_url,
    parkingInfo: row.parking_info,
    startAt: row.start_at,
    endAt: row.end_at,
    dressCode: row.dress_code,
    heroVideoUrl: row.hero_video_url,
    timezone: row.timezone || "Asia/Kolkata",
    visibility: row.visibility,
    shortDescription: row.short_description,
    occasionDate: row.occasion_date,
    templateSlug: row.template_slug ?? "royal-gold",
    inviteMessageTemplate: row.invite_message_template,
    publicRsvpEnabled: row.public_rsvp_enabled ?? false,
    publicMemoriesEnabled: row.public_memories_enabled ?? false,
    shareImagePath: row.share_image_path,
    shareVideoPath: row.share_video_path,
    highlightReelPath: row.highlight_reel_path,
    sectionConfig: row.section_config,
    aiImageGenerationLimit: row.ai_image_generation_limit ?? 5,
    aiCssGenerationLimit: row.ai_css_generation_limit ?? 20,
    slideshowVideoGenerationLimit: row.slideshow_video_generation_limit ?? 3,
    videoEditorGenerationLimit: row.video_editor_generation_limit ?? 3,
    additionalNotes: row.additional_notes,
    wishMessage: row.wish_message,
    customCss: row.custom_css,
    wizardGoals: row.wizard_goals,
    eventDayMode: row.event_day_mode ?? "off",
    eventDayShareToken: row.event_day_share_token,
    menuStyle: row.menu_style ?? "buffet",
    aiAvatarEnabled: row.ai_avatar_enabled ?? false,
    aiAvatarDailyMessageLimit: row.ai_avatar_daily_message_limit ?? 150,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Used by resolveAdminEvent() for client-role admins scoped to one specific event (admins.event_id) — see services/event-drafts.ts and lib/admin-event.ts. */
export async function getEventById(id: string): Promise<EventRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle<EventRow>();

  if (error) {
    throw new Error(`Failed to look up event: ${error.message}`);
  }
  return data ? mapEvent(data) : null;
}

export async function getEventBySlug(slug: string): Promise<EventRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<EventRow>();

  if (error) {
    throw new Error(`Failed to look up event: ${error.message}`);
  }
  return data ? mapEvent(data) : null;
}

/**
 * Events opted into the public /events directory, newest-starting first.
 * Private events are never returned here — they're still reachable by
 * anyone with the direct /events/[slug] link, same as an invite link.
 */
export async function listPublicEvents(): Promise<EventRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("*")
    .eq("visibility", "public")
    .order("start_at", { ascending: true });

  if (error) throw new Error(`Failed to list public events: ${error.message}`);
  return (data as EventRow[]).map(mapEvent);
}

export interface EventSummary {
  id: string;
  slug: string;
  honoreeName: string;
  eventTitle: string;
  category: EventRecord["category"];
  visibility: "public" | "private";
  createdAt: string;
}

/**
 * Every live (status = 'active') event, newest first — powers the
 * owner-only "All Events" admin page (app/admin/(dashboard)/events),
 * which is how the owner reaches any client's dashboard (see
 * lib/admin-event.ts's resolveAdminEvent and
 * lib/admin-active-event.ts). Drafts (status = 'draft', still mid
 * wizard, unpaid) intentionally excluded — they already have their own
 * view at /admin/drafts (see listDraftEvents in services/event-drafts.ts).
 */
export async function listAllActiveEvents(): Promise<EventSummary[]> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("id, slug, honoree_name, event_title, category, visibility, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list events: ${error.message}`);
  return (
    data as {
      id: string;
      slug: string;
      honoree_name: string;
      event_title: string;
      category: EventRecord["category"];
      visibility: "public" | "private";
      created_at: string;
    }[]
  ).map((row) => ({
    id: row.id,
    slug: row.slug,
    honoreeName: row.honoree_name,
    eventTitle: row.event_title,
    category: row.category,
    visibility: row.visibility,
    createdAt: row.created_at,
  }));
}

function slugSuffix(): string {
  return randomBytes(4).toString("hex");
}

/**
 * Owner-initiated event creation (features/admin/events/actions.ts) —
 * for a client the owner is onboarding directly (e.g. over phone/email)
 * rather than through the self-serve /start wizard. Goes straight to
 * status='active' (no draft/payment step — the owner is vouching for
 * this client), with the same placeholder content the wizard's
 * createDraftEvent uses, so the owner lands on a normal Event Settings
 * page and fills in real details immediately after creating it.
 */
export async function createOwnerEvent(): Promise<{ id: string; slug: string }> {
  const slug = `event-${slugSuffix()}`;
  const now = new Date();
  const startAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const endAt = new Date(startAt.getTime() + 4 * 60 * 60 * 1000);

  const { data, error } = await supabaseAdmin()
    .from("events")
    .insert({
      slug,
      status: "active",
      category: "birthday",
      honoree_name: "New Event",
      event_title: "My Celebration",
      hosted_by: "",
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      template_slug: "royal-gold",
    })
    .select("id, slug")
    .single<{ id: string; slug: string }>();

  if (error || !data) throw new Error(`Failed to create event: ${error?.message}`);
  return data;
}

export interface EventUpdateInput {
  /**
   * Changing this changes the event's public URL — every already-shared
   * /events/{slug} or /events/{slug}/rsvp link breaks. Validated and
   * uniqueness-checked in updateEvent below; never set automatically —
   * see lib/slug.ts's buildEventSlugSuggestion, which only ever
   * populates a form field for the admin to review before saving.
   */
  slug?: string;
  category?: EventRecord["category"];
  occasion?: string | null;
  honoreeName?: string;
  eventTitle?: string;
  hostedBy?: string;
  venueName?: string | null;
  venueAddress?: string | null;
  mapsUrl?: string | null;
  mapsEmbedUrl?: string | null;
  parkingInfo?: string | null;
  startAt?: string;
  endAt?: string;
  dressCode?: string | null;
  timezone?: string;
  visibility?: "public" | "private";
  shortDescription?: string | null;
  occasionDate?: string | null;
  templateSlug?: string;
  inviteMessageTemplate?: string | null;
  publicRsvpEnabled?: boolean;
  publicMemoriesEnabled?: boolean;
  shareImagePath?: string | null;
  shareVideoPath?: string | null;
  highlightReelPath?: string | null;
  sectionConfig?: SectionConfigItem[] | null;
  additionalNotes?: string | null;
  wishMessage?: string | null;
  customCss?: string | null;
  wizardGoals?: string[] | null;
  /**
   * Per-event AI generation caps. Not currently owner-only-editable
   * from any admin UI — the one real setter today is
   * features/pricing/actions.ts's beginDraftWithPlanAction, which sets
   * these once at draft creation based on the pricing tier chosen on
   * /pricing, so a plan's "AI credits" claim is an enforced number
   * rather than marketing copy. See services/ai-image-generations.ts /
   * ai-css-generations.ts / slideshow-video-generations.ts for where
   * the limit is actually checked against usage.
   */
  aiImageGenerationLimit?: number;
  aiCssGenerationLimit?: number;
  slideshowVideoGenerationLimit?: number;
  videoEditorGenerationLimit?: number;
  eventDayMode?: "off" | "public" | "private";
  eventDayShareToken?: string | null;
  menuStyle?: "buffet" | "a_la_carte";
  aiAvatarEnabled?: boolean;
  aiAvatarDailyMessageLimit?: number;
}

/** Admin-facing update for the event settings form. */
export async function updateEvent(id: string, input: EventUpdateInput): Promise<void> {
  const patch: Record<string, unknown> = {};

  if (input.slug !== undefined) {
    const slug = input.slug.trim().toLowerCase();
    if (!isValidSlug(slug)) {
      throw new Error(
        "URL slug must be 3-80 characters: lowercase letters, numbers, and hyphens only (no leading, trailing, or double hyphens).",
      );
    }

    // The flagship event is looked up by its hardcoded slug (EVENT_SLUG)
    // in a few places that need "the one original production event"
    // rather than a specific caller's eventId — the owner dashboard's
    // fallback (lib/admin-event.ts, services/admin-users.ts) and the
    // media export route. Changing that event's slug out from under
    // those would silently break owner access rather than just this
    // event's public link, so it's blocked here rather than left as a
    // trap. Every other (client-created) event has no such constraint.
    const { data: currentRow } = await supabaseAdmin()
      .from("events")
      .select("slug")
      .eq("id", id)
      .maybeSingle<{ slug: string }>();
    if (currentRow?.slug === EVENT_SLUG && slug !== EVENT_SLUG) {
      throw new Error(
        "This is the flagship event's address and can't be changed here — some parts of the platform still look it up by its original URL. Contact a developer if this needs to change.",
      );
    }

    // Case-insensitively unique across every other event — checked here
    // rather than relying solely on the DB's unique index so the admin
    // gets a clear message instead of a raw constraint-violation error;
    // the DB constraint (events_slug_key) remains the real backstop
    // against a race between this check and the insert below.
    const { data: existing } = await supabaseAdmin()
      .from("events")
      .select("id")
      .eq("slug", slug)
      .neq("id", id)
      .maybeSingle<{ id: string }>();
    if (existing) {
      throw new Error(`"${slug}" is already used by another event — try a different one.`);
    }
    patch.slug = slug;
  }

  if (input.category !== undefined) patch.category = input.category;
  if (input.occasion !== undefined) patch.occasion = input.occasion;
  if (input.honoreeName !== undefined) patch.honoree_name = input.honoreeName;
  if (input.eventTitle !== undefined) patch.event_title = input.eventTitle;
  if (input.hostedBy !== undefined) patch.hosted_by = input.hostedBy;
  if (input.venueName !== undefined) patch.venue_name = input.venueName;
  if (input.venueAddress !== undefined) patch.venue_address = input.venueAddress;
  if (input.mapsUrl !== undefined) patch.maps_url = input.mapsUrl;
  if (input.mapsEmbedUrl !== undefined) patch.maps_embed_url = input.mapsEmbedUrl;
  if (input.parkingInfo !== undefined) patch.parking_info = input.parkingInfo;
  if (input.startAt !== undefined) patch.start_at = input.startAt;
  if (input.endAt !== undefined) patch.end_at = input.endAt;
  if (input.dressCode !== undefined) patch.dress_code = input.dressCode;
  if (input.timezone !== undefined) patch.timezone = input.timezone;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.shortDescription !== undefined) patch.short_description = input.shortDescription;
  if (input.occasionDate !== undefined) patch.occasion_date = input.occasionDate;
  if (input.templateSlug !== undefined) patch.template_slug = input.templateSlug;
  if (input.inviteMessageTemplate !== undefined)
    patch.invite_message_template = input.inviteMessageTemplate;
  if (input.publicRsvpEnabled !== undefined) patch.public_rsvp_enabled = input.publicRsvpEnabled;
  if (input.publicMemoriesEnabled !== undefined)
    patch.public_memories_enabled = input.publicMemoriesEnabled;
  if (input.shareImagePath !== undefined) patch.share_image_path = input.shareImagePath;
  if (input.shareVideoPath !== undefined) patch.share_video_path = input.shareVideoPath;
  if (input.highlightReelPath !== undefined) patch.highlight_reel_path = input.highlightReelPath;
  if (input.sectionConfig !== undefined) patch.section_config = input.sectionConfig;
  if (input.additionalNotes !== undefined) patch.additional_notes = input.additionalNotes;
  if (input.wishMessage !== undefined) patch.wish_message = input.wishMessage;
  if (input.customCss !== undefined) patch.custom_css = input.customCss;
  if (input.wizardGoals !== undefined) patch.wizard_goals = input.wizardGoals;
  if (input.aiImageGenerationLimit !== undefined) patch.ai_image_generation_limit = input.aiImageGenerationLimit;
  if (input.aiCssGenerationLimit !== undefined) patch.ai_css_generation_limit = input.aiCssGenerationLimit;
  if (input.slideshowVideoGenerationLimit !== undefined)
    patch.slideshow_video_generation_limit = input.slideshowVideoGenerationLimit;
  if (input.videoEditorGenerationLimit !== undefined)
    patch.video_editor_generation_limit = input.videoEditorGenerationLimit;
  if (input.eventDayMode !== undefined) patch.event_day_mode = input.eventDayMode;
  if (input.eventDayShareToken !== undefined) patch.event_day_share_token = input.eventDayShareToken;
  if (input.menuStyle !== undefined) patch.menu_style = input.menuStyle;
  if (input.aiAvatarEnabled !== undefined) patch.ai_avatar_enabled = input.aiAvatarEnabled;
  if (input.aiAvatarDailyMessageLimit !== undefined)
    patch.ai_avatar_daily_message_limit = input.aiAvatarDailyMessageLimit;

  const { error } = await supabaseAdmin().from("events").update(patch).eq("id", id);
  if (error) throw new Error(`Failed to update event: ${error.message}`);
}
