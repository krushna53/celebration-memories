import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Config-driven registry of features to "subtly remind" an admin about
 * if they haven't tried them yet — one nudge per event per day (see
 * getNextFeatureNudge), in this order, skipping anything already used
 * or already nudged. Adding a feature to nudge about is additive: one
 * new entry here, no other code changes — same registry shape as
 * lib/template-catalog.ts / lib/event-category.ts elsewhere in this app.
 */
export interface FeatureNudgeDefinition {
  key: string;
  title: string;
  body: string;
  link: string;
  /** Cheap existence check — has this event ever used the feature at all. */
  checkUsed: (eventId: string) => Promise<boolean>;
}

async function tableHasRowForEvent(table: string, eventId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from(table).select("id").eq("event_id", eventId).limit(1);
  if (error) {
    console.error(`tableHasRowForEvent(${table}) failed:`, error.message);
    return true; // fail closed — skip nudging rather than risk a false "not used" on a query error
  }
  return (data?.length ?? 0) > 0;
}

export const FEATURE_NUDGES: FeatureNudgeDefinition[] = [
  {
    key: "gallery",
    title: "Have any new photos for the Gallery?",
    body: "Your event page's Gallery section is empty so far — add a few photos to bring it to life before guests start visiting.",
    link: "/admin/gallery",
    checkUsed: (eventId) => tableHasRowForEvent("gallery_photos", eventId),
  },
  {
    key: "planner",
    title: "Have any plans to note down for the event?",
    body: "The Planner is a simple checklist/notes board for everything you still need to sort out — vendors, seating, anything on your mind.",
    link: "/admin/planner",
    checkUsed: async (eventId) => {
      const [tasks, notes] = await Promise.all([
        tableHasRowForEvent("event_planner_tasks", eventId),
        tableHasRowForEvent("event_planner_notes", eventId),
      ]);
      return tasks || notes;
    },
  },
  {
    key: "video_editor",
    title: "Want to try the Video Editor?",
    body: "Trim clips, add transitions, and put together a short highlight video right from your gallery/guest uploads — no separate software needed.",
    link: "/admin/video-editor",
    checkUsed: (eventId) => tableHasRowForEvent("video_edit_jobs", eventId),
  },
  {
    key: "guest_list",
    title: "Have a look at your guest list",
    body: "Add your guests (or import a CSV) so they each get their own personal invitation link with RSVP tracking.",
    link: "/admin/invitees",
    checkUsed: (eventId) => tableHasRowForEvent("invitees", eventId),
  },
  {
    key: "ai_image",
    title: "Try generating an AI invitation card",
    body: "The AI Image tool can generate a polished invitation-card design from your event details in seconds.",
    link: "/admin/ai-image",
    checkUsed: (eventId) => tableHasRowForEvent("ai_image_generations", eventId),
  },
  {
    key: "ai_avatar",
    title: "Turn on the AI Avatar host?",
    body: "A small floating chat host on your public event page that greets guests and answers questions about venue, timing, and dress code — grounded only in your own event details.",
    link: "/admin/event-settings",
    checkUsed: async (eventId) => {
      const { data } = await supabaseAdmin().from("events").select("ai_avatar_enabled").eq("id", eventId).maybeSingle<{
        ai_avatar_enabled: boolean;
      }>();
      return data?.ai_avatar_enabled ?? false;
    },
  },
];
