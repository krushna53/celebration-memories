import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface DashboardStats {
  invitations: {
    total: number;
    opened: number;
    pending: number;
    coming: number;
    maybe: number;
    declined: number;
    checkedIn: number;
  };
  uploads: {
    photos: number;
    videos: number;
    audio: number;
    messages: number;
    pendingApproval: number;
  };
  mostActiveGuests: Array<{ id: string; name: string; visitCount: number }>;
}

async function countRows(table: string, eventId: string, filters?: Record<string, unknown>) {
  let query = supabaseAdmin()
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  for (const [key, value] of Object.entries(filters ?? {})) {
    query = query.eq(key, value);
  }

  const { count, error } = await query;
  if (error) {
    console.error(`countRows(${table}) failed:`, error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getDashboardStats(eventId: string): Promise<DashboardStats> {
  const [
    total,
    opened,
    pending,
    coming,
    maybe,
    declined,
    checkedIn,
    photos,
    videos,
    audio,
    messages,
    pendingPhotos,
    pendingVideos,
    pendingAudio,
    pendingMessages,
    activeGuests,
  ] = await Promise.all([
    countRows("invitees", eventId),
    supabaseAdmin()
      .from("invitees")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .not("opened_at", "is", null)
      .then((r) => r.count ?? 0),
    countRows("invitees", eventId, { rsvp_status: "pending" }),
    countRows("invitees", eventId, { rsvp_status: "coming" }),
    countRows("invitees", eventId, { rsvp_status: "maybe" }),
    countRows("invitees", eventId, { rsvp_status: "not_coming" }),
    countRows("invitees", eventId, { checked_in: true }),
    countRows("photos", eventId),
    countRows("videos", eventId),
    countRows("audio", eventId),
    countRows("guestbook", eventId),
    countRows("photos", eventId, { approved: false }),
    countRows("videos", eventId, { approved: false }),
    countRows("audio", eventId, { approved: false }),
    countRows("guestbook", eventId, { approved: false }),
    supabaseAdmin()
      .from("invitees")
      .select("id, name, visit_count")
      .eq("event_id", eventId)
      .order("visit_count", { ascending: false })
      .limit(5)
      .then((r) => r.data ?? []),
  ]);

  return {
    invitations: { total, opened, pending, coming, maybe, declined, checkedIn },
    uploads: {
      photos,
      videos,
      audio,
      messages,
      pendingApproval: pendingPhotos + pendingVideos + pendingAudio + pendingMessages,
    },
    mostActiveGuests: (
      activeGuests as Array<{ id: string; name: string; visit_count: number }>
    ).map((g) => ({ id: g.id, name: g.name, visitCount: g.visit_count })),
  };
}
