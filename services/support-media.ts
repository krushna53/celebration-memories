import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
export async function recordSupportMediaOutcome(eventId: string, path: string): Promise<boolean> {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  if (!user) return false;
  const { data, error } = await supabaseAdmin().rpc("record_support_media_issuance", { eid: eventId, media: path, actor: user.id });
  return !error && data === true;
}
