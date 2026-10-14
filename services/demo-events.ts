import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";

/** A public sample event (events.is_demo) for the website's showcase. */
export interface DemoEventSummary {
  slug: string;
  honoreeName: string;
  eventTitle: string;
  occasion: string | null;
  category: string;
  templateSlug: string;
  startAt: string;
  timezone: string;
  /** The event's link-preview photo, if it has one — used as the card image. */
  coverUrl: string | null;
}

/** Published, publicly viewable sample events, in the order they were created. Empty on any error. */
export async function listDemoEvents(): Promise<DemoEventSummary[]> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .select("slug, honoree_name, event_title, occasion, category, template_slug, start_at, timezone, share_image_path")
      .eq("is_demo", true)
      .eq("status", "active")
      .eq("page_status", "published")
      .eq("viewing_access", "public")
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return (data as {
      slug: string;
      honoree_name: string;
      event_title: string;
      occasion: string | null;
      category: string;
      template_slug: string;
      start_at: string;
      timezone: string;
      share_image_path: string | null;
    }[]).map((row) => ({
      slug: row.slug,
      honoreeName: row.honoree_name,
      eventTitle: row.event_title,
      occasion: row.occasion,
      category: row.category,
      templateSlug: row.template_slug,
      startAt: row.start_at,
      timezone: row.timezone,
      coverUrl: row.share_image_path ? publicMediaUrl("gallery", row.share_image_path) : null,
    }));
  } catch {
    return [];
  }
}
