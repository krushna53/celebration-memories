import { NextResponse } from "next/server";

import { assertSameOrigin, googleToken, GooglePhotosError, listPickedItems } from "@/lib/google-photos-api";

export const dynamic = "force-dynamic";

/** The items the user picked: ?sessionId=… → { items: [{ id, type, baseUrl, mimeType, filename }] } */
export async function GET(request: Request) {
  try {
    assertSameOrigin(request);
    const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
    if (!sessionId) throw new GooglePhotosError("Missing session.", 400);
    const items = await listPickedItems(googleToken(request), sessionId);
    return NextResponse.json({
      items: items.map((i) => ({
        id: i.id,
        type: i.type,
        baseUrl: i.mediaFile.baseUrl,
        mimeType: i.mediaFile.mimeType,
        filename: i.mediaFile.filename ?? null,
      })),
    });
  } catch (err) {
    const status = err instanceof GooglePhotosError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status });
  }
}
