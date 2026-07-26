import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

export interface EventUpdateInput {
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
}

/** Admin-facing update for the event settings form. */
export async function updateEvent(id: string, input: EventUpdateInput): Promise<void> {
  const patch: Record<string, unknown> = {};
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

  const { error } = await supabaseAdmin().from("events").update(patch).eq("id", id);
  if (error) throw new Error(`Failed to update event: ${error.message}`);
}
