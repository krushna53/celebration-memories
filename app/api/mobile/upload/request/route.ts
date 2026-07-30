import "server-only";
import { NextResponse } from "next/server";

import { requestUploadUrl } from "@/features/uploads/actions";

export const dynamic = "force-dynamic";

/**
 * Public, token-gated "step 1 of 2" upload endpoint for the companion
 * mobile app: mints a Supabase Storage signed upload URL. Thin wrapper
 * around requestUploadUrl (the same server action the web upload UI
 * calls) — kept as a plain function rather than duplicated here so the
 * validation/limits/per-invitee cap in services/uploads.ts can never
 * drift between the web and mobile clients.
 *
 * The mobile client PUTs the file bytes directly to Supabase Storage
 * using the returned {bucket, path, token, signedUrl} — via
 * @supabase/supabase-js's storage.from(bucket).uploadToSignedUrl(...) —
 * never through this Next.js server, so large video/audio files don't
 * have to pass through a serverless function's body/time limits. Once
 * that PUT succeeds, call ../confirm with the same path to record it.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { token, kind, fileName, contentType, fileSize } = (body ?? {}) as {
    token?: string;
    kind?: "photo" | "video" | "audio";
    fileName?: string;
    contentType?: string;
    fileSize?: number;
  };

  if (!token || !kind || !fileName || !contentType || typeof fileSize !== "number") {
    return NextResponse.json({ error: "Missing required upload fields." }, { status: 400 });
  }
  if (kind !== "photo" && kind !== "video" && kind !== "audio") {
    return NextResponse.json({ error: "Invalid upload kind." }, { status: 400 });
  }

  const result = await requestUploadUrl(token, kind, fileName, contentType, fileSize);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json(result.data);
}
