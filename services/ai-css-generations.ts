import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/** Total AI CSS generations recorded for an event (all admins combined). */
export async function countAiCssGenerations(eventId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("ai_css_generations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) {
    console.error("countAiCssGenerations failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function recordAiCssGeneration(params: {
  eventId: string;
  adminId: string;
  prompt: string;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("ai_css_generations").insert({
    event_id: params.eventId,
    admin_id: params.adminId,
    prompt: params.prompt.slice(0, 2000),
  });

  if (error) {
    console.error("recordAiCssGeneration failed:", error.message);
  }
}
