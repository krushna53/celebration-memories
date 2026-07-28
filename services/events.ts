import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
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
  visibility: "public" | "private";
  short_description: string | null;
  occasion_date: string | null;
  template_slug: string | null;
  invite_message_template: string | null;
  public_rsvp_enabled: boolean;
  share_image_path: string | null;
  share_video_path: string | null;
  section_config: SectionConfigItem[] | null;
  ai_image_generation_limit: number;
  ai_css_generation_limit: number;
  slideshow_video_generation_limit: number;
  additional_notes: string | null;
  wish_message: string | null;
  custom_css: string | null;
  wizard_goals: string[] | null;
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
    visibility: row.visibility,
    shortDescription: row.short_description,
    occasionDate: row.occasion_date,
    templateSlug: row.template_slug ?? "royal-gold",
    inviteMessageTemplate: row.invite_message_template,
    publicRsvpEnabled: row.public_rsvp_enabled ?? false,
    shareImagePath: row.share_image_path,
    shareVideoPath: row.share_video_path,
    sectionConfig: row.section_config,
    aiImageGenerationLimit: row.ai_image_generation_limit ?? 5,
    aiCssGenerationLimit: row.ai_css_generation_limit ?? 20,
    slideshowVideoGenerationLimit: row.slideshow_video_generation_limit ?? 3,
    additionalNotes: row.additional_notes,
    wishMessage: row.wish_message,
    customCss: row.custom_css,
    wizardGoals: row.wizard_goals,
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

export interface EventUpdateInput {
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
  visibility?: "public" | "private";
  shortDescription?: string | null;
  occasionDate?: string | null;
  templateSlug?: string;
  inviteMessageTemplate?: string | null;
  publicRsvpEnabled?: boolean;
  shareImagePath?: string | null;
  shareVideoPath?: string | null;
  sectionConfig?: SectionConfigItem[] | null;
  additionalNotes?: string | null;
  wishMessage?: string | null;
  customCss?: string | null;
  wizardGoals?: string[] | null;
}

/** Admin-facing update for the event settings form. */
export async function updateEvent(id: string, input: EventUpdateInput): Promise<void> {
  const patch: Record<string, unknown> = {};
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
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.shortDescription !== undefined) patch.short_description = input.shortDescription;
  if (input.occasionDate !== undefined) patch.occasion_date = input.occasionDate;
  if (input.templateSlug !== undefined) patch.template_slug = input.templateSlug;
  if (input.inviteMessageTemplate !== undefined)
    patch.invite_message_template = input.inviteMessageTemplate;
  if (input.publicRsvpEnabled !== undefined) patch.public_rsvp_enabled = input.publicRsvpEnabled;
  if (input.shareImagePath !== undefined) patch.share_image_path = input.shareImagePath;
  if (input.shareVideoPath !== undefined) patch.share_video_path = input.shareVideoPath;
  if (input.sectionConfig !== undefined) patch.section_config = input.sectionConfig;
  if (input.additionalNotes !== undefined) patch.additional_notes = input.additionalNotes;
  if (input.wishMessage !== undefined) patch.wish_message = input.wishMessage;
  if (input.customCss !== undefined) patch.custom_css = input.customCss;
  if (input.wizardGoals !== undefined) patch.wizard_goals = input.wizardGoals;

  const { error } = await supabaseAdmin().from("events").update(patch).eq("id", id);
  if (error) throw new Error(`Failed to update event: ${error.message}`);
}
