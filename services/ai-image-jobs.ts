import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Creates a pending job row that the Supabase Edge Function
 * (supabase/functions/generate-ai-image/index.ts) picks up by id and
 * updates as it works — see the doc comment on generateAiImageAction in
 * features/admin/ai-image/actions.ts for the full flow. This insert is
 * the only thing that Server Action does synchronously; the browser
 * calls the Edge Function directly afterward and awaits its real
 * result, so there's no separate polling/status-lookup path anymore.
 *
 * adminId is nullable for jobs created by the self-serve wizard
 * (features/start/actions/ai-image.ts), where the draft event has no
 * admin yet — see the draft_events_and_admin_scoping /
 * nullable_admin_id_for_draft_jobs migrations.
 */
export async function createAiImageJob(params: {
  eventId: string;
  adminId: string | null;
  prompt: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("ai_image_jobs")
    .insert({
      event_id: params.eventId,
      admin_id: params.adminId,
      prompt: params.prompt.slice(0, 2000),
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) throw new Error(`Failed to create AI image job: ${error?.message}`);
  return data.id;
}
