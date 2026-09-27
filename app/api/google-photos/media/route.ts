import { NextResponse } from "next/server";

import { assertSameOrigin, googleToken, GooglePhotosError, isGoogleMediaUrl } from "@/lib/google-photos-api";

export const dynamic = "force-dynamic";

/** Hard ceiling on one downloaded photo — a 2560px JPEG is normally 0.5–3 MB. */
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Downloads one picked photo from Google (with the user's bearer token)
 * and hands the bytes back to our page, which then uploads it through
 * the normal upload pipeline (compression, validation, moderation).
 * POST { baseUrl }.
 *
 * `=w2560-h2560` asks Google for a JPEG no larger than 2560px on its
 * long side — skips HEIC/huge originals and keeps phones' data use sane.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const token = googleToken(request);
    const { baseUrl, thumbnail } = (await request.json().catch(() => ({}))) as { baseUrl?: string; thumbnail?: boolean };
    if (!baseUrl || !isGoogleMediaUrl(baseUrl)) throw new GooglePhotosError("Invalid photo.", 400);

    // A video's baseUrl with =w/=h returns a still frame — used as the upload-queue thumbnail.
    const res = await fetch(`${baseUrl}=${thumbnail ? "w480-h480" : "w2560-h2560"}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) {
      const expired = res.status === 401 || res.status === 403;
      throw new GooglePhotosError(
        expired ? "Google sign-in expired — please connect again." : `Couldn't download a photo (${res.status}).`,
        expired ? 401 : 502,
      );
    }
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new GooglePhotosError("That photo is too large.", 413);
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) throw new GooglePhotosError("That photo is too large.", 413);

    return new NextResponse(bytes, {
      headers: { "Content-Type": res.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const status = err instanceof GooglePhotosError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status });
  }
}
