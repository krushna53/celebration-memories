import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";
import type { AiImageJobRecord, AiImageJobStatus } from "@/types/ai-image-job";

interface AiImageJobRow {
  id: string;
  status: AiImageJobStatus;
  result_path: string | null;
  error_message: string | null;
  created_at: string;
}

/**
 * How long a job can sit at "pending"/"processing" before we give up on
 * it ourselves rather than let the client poll forever. In the normal
 * case the Background Function flips status within a minute or so; this
 * threshold is a safety net for cases like the background trigger fetch
 * never reaching the function at all (e.g. a misconfigured site origin —
 * see resolveSiteOrigin() in features/admin/ai-image/actions.ts) or the
 * function crashing before it could write its own "error" status.
 */
const STALE_AFTER_MS = 3 * 60 * 1000;

function mapRow(row: AiImageJobRow): AiImageJobRecord {
  return {
    id: row.id,
    status: row.status,
    resultPath: row.result_path,
    resultUrl: row.result_path ? publicMediaUrl("gallery", row.result_path) : null,
    errorMessage: row.error_message,
  };
}

/**
 * Creates a pending job row for the Netlify Background Function to pick
 * up (see netlify/functions/generate-ai-image-background.mts). This is
 * the only thing the Server Action does synchronously — actually
 * calling OpenAI happens entirely outside this request/response cycle.
 */
export async function createAiImageJob(params: {
  eventId: string;
  adminId: string;
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

export async function getAiImageJob(id: string): Promise<AiImageJobRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("ai_image_jobs")
    .select("id, status, result_path, error_message, created_at")
    .eq("id", id)
    .maybeSingle<AiImageJobRow>();

  if (error) throw new Error(`Failed to load AI image job: ${error.message}`);
  if (!data) return null;

  if (
    (data.status === "pending" || data.status === "processing") &&
    Date.now() - new Date(data.created_at).getTime() > STALE_AFTER_MS
  ) {
    const message = "This generation timed out. Please try again — if it keeps happening, contact your site admin.";
    const { error: updateError } = await supabaseAdmin()
      .from("ai_image_jobs")
      .update({ status: "error", error_message: message, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) {
      console.error("Failed to mark stale AI image job as errored:", updateError.message);
    } else {
      data.status = "error";
      data.error_message = message;
    }
  }

  return mapRow(data);
}
