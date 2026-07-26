import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { EventRecord } from "@/types/event";

interface EventRow {
  id: string;
  slug: string;
  category: EventRecord["category"];
  honoree_name: string;
  event_title: string;
  hosted_by: string;
  venue_name: string | null;
  venue_address: string | null;
  maps_url: string | null;
  start_at: string;
  end_at: string;
  dress_code: string | null;
  hero_video_url: string | null;
  created_at: string;
  updated_at: string;
}

function mapEvent(row: EventRow): EventRecord {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    honoreeName: row.honoree_name,
    eventTitle: row.event_title,
    hostedBy: row.hosted_by,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    mapsUrl: row.maps_url,
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
