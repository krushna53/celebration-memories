import { createClient } from "npm:@supabase/supabase-js@2";
export async function isEventClient(req: Request, eventId: string): Promise<boolean> {
  const bearer = req.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) return false;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error } = await db.auth.getUser(bearer.slice(7));
  if (error || !user) return false;
  const [{ data: admin }, { data: membership }] = await Promise.all([
    db.from("admins").select("role").eq("id", user.id).maybeSingle(),
    db.from("admin_event_memberships").select("role").eq("event_id", eventId).eq("admin_id", user.id).maybeSingle(),
  ]);
  return admin?.role !== "owner" && membership?.role === "client";
}
