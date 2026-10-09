import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export interface SupportRequest {
  id: string; event_id: string; admin_user_id: string; owner_user_id: string;
  reason: string; duration_minutes: number; status: string; created_at: string;
}
export interface SupportGrant {
  id: string; request_id: string; event_id: string; admin_user_id: string;
  starts_at: string; expires_at: string; status: string; revoked_at: string | null;
}
export interface SupportAudit { id: number; action: string; outcome: string; created_at: string; media_id: string | null }

export async function supportHistory(eventId: string) {
  const client = await supabaseServer();
  // RLS independently restricts every read to this owner or requesting admin.
  const [requests, grants, audit] = await Promise.all([
    client.from("support_access_requests").select("*").eq("event_id", eventId).order("created_at", { ascending: false }).limit(50),
    client.from("support_access_grants").select("*").eq("event_id", eventId).order("starts_at", { ascending: false }).limit(50),
    client.from("support_access_audit_log").select("id,action,outcome,created_at,media_id").eq("event_id", eventId).order("created_at", { ascending: false }).limit(50),
  ]);
  if (requests.error || grants.error || audit.error) throw new Error("Support history could not be loaded.");
  return { requests: requests.data as SupportRequest[], grants: grants.data as SupportGrant[], audit: audit.data as SupportAudit[] };
}
