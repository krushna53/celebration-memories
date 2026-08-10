// Recycle Bin auto-purge — permanently removes any gallery_photos /
// photos / videos / audio row whose deleted_at is older than
// TRASH_RETENTION_DAYS (30). Runs once a day via pg_cron (see migration
// 0039_media_recycle_bin_cron.sql), same shape as send-reminder-push's
// cron wiring. Mirrors services/recycle-bin.ts's purgeExpiredTrash —
// that TS module is server-only Next.js code and can't be imported
// directly into a Deno Edge Function, so the same logic is
// duplicated here; keep the two in sync if the retention window or
// table/bucket list ever changes.
//
// Same boilerplate shape as the other functions in this directory
// (corsHeaders, jsonResponse, Deno.serve) — see video-edit-status/
// index.ts for the fuller convention writeup.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TRASH_RETENTION_DAYS = 30;

const TABLE: Record<string, string> = {
  gallery: "gallery_photos",
  photo: "photos",
  video: "videos",
  audio: "audio",
};

const BUCKET: Record<string, string> = {
  gallery: "gallery",
  photo: "photos",
  video: "videos",
  audio: "audio",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("purge-expired-trash: missing Supabase env vars");
    return jsonResponse({ success: false, error: "Not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let purged = 0;
  const errors: string[] = [];

  for (const kind of Object.keys(TABLE)) {
    const table = TABLE[kind];
    const bucket = BUCKET[kind];

    const { data, error } = await supabase
      .from(table)
      .select("id, storage_path")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);

    if (error) {
      errors.push(`${kind}: list failed (${error.message})`);
      continue;
    }

    for (const row of (data ?? []) as { id: string; storage_path: string | null }[]) {
      try {
        if (row.storage_path) {
          await supabase.storage.from(bucket).remove([row.storage_path]);
        }
        const { error: deleteError } = await supabase.from(table).delete().eq("id", row.id);
        if (deleteError) throw new Error(deleteError.message);
        purged += 1;
      } catch (err) {
        errors.push(`${kind} ${row.id}: ${err instanceof Error ? err.message : "purge failed"}`);
      }
    }
  }

  return jsonResponse({ success: true, purged, errors }, 200);
});
