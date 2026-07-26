import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";
import type { AiImageJobRecord, AiImageJobStatus } from "@/types/ai-image-job";

interface AiImageJobRow {
  id: string;
  status: AiImageJobStatus;
  result_path: string | null;
  error_message: string | null;
}

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
    .select("id, status, result_path, error_message")
    .eq("id", id)
    .maybeSingle<AiImageJobRow>();

  if (error) throw new Error(`Failed to load AI image job: ${error.message}`);
  return data ? mapRow(data) : null;
}
