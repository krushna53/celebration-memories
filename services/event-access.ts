import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export type ViewingAccess = "public" | "signed_in" | "invited_only";
export interface EventAccess {
  id: string; slug: string; status: string; page_status: string;
  public_access_pinned: boolean; viewing_access: ViewingAccess; owner_user_id: string | null;
}

export async function getEventAccess(eventId: string): Promise<EventAccess | null> {
  const { data, error } = await supabaseAdmin().from("events")
    .select("id,slug,status,page_status,viewing_access,owner_user_id,public_access_pinned").eq("id", eventId).maybeSingle<EventAccess>();
  if (error) throw new Error("Event privacy could not be checked.");
  return data;
}

export async function eventPermissions(eventId: string) {
  const event = await getEventAccess(eventId);
  if (!event) return { event, userId: null, view: false, manage: false, owner: false, platformAdmin: false };
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  let platformAdmin = false;
  let member = false;
  if (user) {
    const [{ data: admin, error: adminError }, { data: membership, error: memberError }] = await Promise.all([
      supabaseAdmin().from("admins").select("role").eq("id", user.id).maybeSingle(),
      supabaseAdmin().from("admin_event_memberships").select("role").eq("admin_id", user.id).eq("event_id", eventId).maybeSingle(),
    ]);
    if (adminError || memberError) throw new Error("Event permissions could not be checked.");
    platformAdmin = admin?.role === "owner";
    member = !!membership && membership.role !== "session_organizer" && !platformAdmin;
  }
  const owner = !!user && user.id === event.owner_user_id && !platformAdmin;
  // Support grants never make a user a manager, member, or owner.
  const manage = owner || member;
  let view = manage;
  if (!view && event.status === "active" && event.page_status === "published") {
    view = event.public_access_pinned || event.viewing_access === "public" || (event.viewing_access === "signed_in" && !!user && !user.is_anonymous);
    if (!event.public_access_pinned && event.viewing_access === "invited_only" && user?.email && user.email_confirmed_at && !user.is_anonymous) {
      const { data, error } = await supabaseAdmin().from("invitees").select("id")
        .eq("event_id", eventId).ilike("email", user.email.replace(/[\\%_]/g, "\\$&")).limit(1);
      if (error) throw new Error("Guest access could not be checked.");
      view = !!data?.length;
    }
  }
  return { event, userId: user?.id ?? null, view, manage, owner, platformAdmin };
}

export async function requireEventView(eventId: string): Promise<void> {
  if (!(await eventPermissions(eventId)).view) throw new Error("Sign in with an approved account to view this event.");
}

export async function requireEventMember(eventId: string): Promise<void> {
  if (!(await eventPermissions(eventId)).manage) throw new Error("Only this event's team can manage its content. Platform support access is read-only.");
}

export async function supportExpiry(eventId: string, mediaId?: string): Promise<number | null> {
  const { data, error } = await (await supabaseServer()).rpc("support_access_expiry", { eid: eventId, media: mediaId ?? null });
  if (error || !data) return null;
  const expiresAt = Date.parse(data as string);
  return Number.isFinite(expiresAt) && expiresAt > Date.now() ? expiresAt : null;
}

export async function canViewEvent(eventId: string): Promise<boolean> {
  return (await eventPermissions(eventId)).view;
}
