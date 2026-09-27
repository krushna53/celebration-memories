// Supabase Edge Function — streams one video picked in Google Photos
// (Picker API) straight into Supabase Storage, for "Upload a video →
// Google Photos". Videos can be hundreds of MB, far past what a
// Netlify function can proxy, so the bytes go Google → here → Storage
// as a stream and are never held in memory.
//
// Trust model — this function holds no secrets and grants nothing new:
//   * The destination is a Storage *signed upload* (bucket + path +
//     token) that our Next.js server already minted after its normal
//     guest/admin checks (requestUploadUrl). Without a valid token the
//     PUT is simply rejected by Storage.
//   * The source must be an https *.googleusercontent.com URL, fetched
//     with the guest's own short-lived, picker-only Google token.
//   * The browser then calls confirmUpload as with any upload, so the
//     item still lands in moderation (approved = false).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface Body {
  sourceUrl: string;
  googleToken: string;
  bucket: string;
  path: string;
  uploadToken: string;
}

const ALLOWED_BUCKETS = new Set(["videos"]);
/** Matches the guest video limit (types/memory.ts UPLOAD_LIMITS.video). */
const MAX_BYTES = 1024 * 1024 * 1024;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function isGoogleMedia(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const { sourceUrl, googleToken, bucket, path, uploadToken } = body;
  if (!isGoogleMedia(sourceUrl ?? "")) return json({ error: "Invalid source." }, 400);
  if (!ALLOWED_BUCKETS.has(bucket) || !path || path.includes("..") || !uploadToken || !googleToken) {
    return json({ error: "Invalid destination." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return json({ error: "Not configured" }, 500);

  const source = await fetch(sourceUrl, { headers: { Authorization: `Bearer ${googleToken}` } });
  if (!source.ok || !source.body) {
    const expired = source.status === 401 || source.status === 403;
    return json({ error: expired ? "Google sign-in expired — please connect again." : `Couldn't download the video (${source.status}).` }, expired ? 401 : 502);
  }
  const declared = Number(source.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return json({ error: "That video is larger than 1GB." }, 413);

  // Count bytes as they pass and abort past the limit, even if Google sent no Content-Length.
  let seen = 0;
  const limited = source.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > MAX_BYTES) controller.error(new Error("too large"));
        else controller.enqueue(chunk);
      },
    }),
  );

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const destination = `${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${encodedPath}?token=${encodeURIComponent(uploadToken)}`;
  const contentType = (source.headers.get("content-type") ?? "video/mp4").split(";")[0].trim();
  const headers: Record<string, string> = { "Content-Type": contentType === "video/quicktime" ? contentType : "video/mp4", "x-upsert": "false" };
  if (declared) headers["Content-Length"] = String(declared);

  let upload: Response;
  try {
    upload = await fetch(destination, { method: "PUT", headers, body: limited, duplex: "half" } as RequestInit);
  } catch (err) {
    const tooLarge = err instanceof Error && err.message.includes("too large");
    return json({ error: tooLarge ? "That video is larger than 1GB." : "Couldn't save the video." }, tooLarge ? 413 : 502);
  }
  if (!upload.ok) {
    const text = await upload.text().catch(() => "");
    console.error(`google-photos-transfer: storage upload failed ${upload.status}: ${text.slice(0, 300)}`);
    return json({ error: "Couldn't save the video." }, 502);
  }
  return json({ ok: true, bytes: seen, contentType: headers["Content-Type"] }, 200);
});
