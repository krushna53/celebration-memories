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

/**
 * The most recently completed AI *generation* for an event, if any — used
 * to re-hydrate the AiImageGenerator's "Generate with AI" preview slot on
 * page load/refresh. Without this, `result` in ai-image-generator.tsx was
 * purely in-memory client state: a freshly generated image would show
 * fine until the admin navigated away or reloaded, at which point the
 * preview reverted to empty even though the file was still sitting in
 * Storage. Filtered to `is_upload = false` so this never returns an
 * uploaded image — see getLatestUploadedAiImageJob for that counterpart.
 * Deliberately "most recent job", not "most recent generation the admin
 * explicitly saved somewhere" — ai_image_generations only tracks quota
 * usage and has no result_path at all, so this table is the only place
 * that actually links a completed image back to its Storage path.
 */
export async function getLatestCompletedAiImageJob(
  eventId: string,
): Promise<{ resultPath: string } | null> {
  const { data, error } = await supabaseAdmin()
    .from("ai_image_jobs")
    .select("result_path")
    .eq("event_id", eventId)
    .eq("status", "done")
    .eq("is_upload", false)
    .not("result_path", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ result_path: string }>();

  if (error) {
    console.error("getLatestCompletedAiImageJob failed:", error.message);
    return null;
  }
  return data ? { resultPath: data.result_path } : null;
}

/**
 * The counterpart to getLatestCompletedAiImageJob for the "Upload Your
 * Own" tab — an uploaded image never went through the OpenAI job flow,
 * so recordAiImageUpload below inserts an already-`done` row purely to
 * give it a place to persist. Reuses the same table (rather than a
 * separate one) so both tabs share one "latest result" mechanism.
 */
export async function getLatestUploadedAiImageJob(
  eventId: string,
): Promise<{ resultPath: string } | null> {
  const { data, error } = await supabaseAdmin()
    .from("ai_image_jobs")
    .select("result_path")
    .eq("event_id", eventId)
    .eq("status", "done")
    .eq("is_upload", true)
    .not("result_path", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ result_path: string }>();

  if (error) {
    console.error("getLatestUploadedAiImageJob failed:", error.message);
    return null;
  }
  return data ? { resultPath: data.result_path } : null;
}

/**
 * Records a completed "Upload Your Own" image as an already-`done` job
 * row (is_upload: true) — this is what lets the uploaded preview survive
 * a page reload, the same way generated images already do. Called right
 * after the browser finishes uploading the file to Storage (see
 * handleUpload in ai-image-generator.tsx); `prompt` has no real value for
 * an upload but the column is NOT NULL, hence the placeholder text.
 */
export async function recordAiImageUpload(params: {
  eventId: string;
  adminId: string | null;
  path: string;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("ai_image_jobs").insert({
    event_id: params.eventId,
    admin_id: params.adminId,
    prompt: "(uploaded image)",
    status: "done",
    result_path: params.path,
    is_upload: true,
  });

  if (error) throw new Error(`Failed to record uploaded image: ${error.message}`);
}
