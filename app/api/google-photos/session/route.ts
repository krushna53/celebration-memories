import { NextResponse } from "next/server";

import { assertSameOrigin, createSession, deleteSession, getSession, googleToken, GooglePhotosError } from "@/lib/google-photos-api";

export const dynamic = "force-dynamic";

/** Picks per import — enough for a batch of memories, small enough to import quickly on a phone. */
const MAX_ITEMS = 30;

function errorResponse(err: unknown) {
  const status = err instanceof GooglePhotosError ? err.status : 500;
  return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status });
}

/** Start a picking session → { id, pickerUri, pollIntervalMs }. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await createSession(googleToken(request), MAX_ITEMS);
    return NextResponse.json({
      id: session.id,
      pickerUri: session.pickerUri,
      pollIntervalMs: Math.max(2000, Math.min(10000, (parseFloat(session.pollingConfig?.pollInterval ?? "4") || 4) * 1000)),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Has the user finished picking? ?id=… → { done } */
export async function GET(request: Request) {
  try {
    assertSameOrigin(request);
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!id) throw new GooglePhotosError("Missing session.", 400);
    const session = await getSession(googleToken(request), id);
    return NextResponse.json({ done: Boolean(session.mediaItemsSet) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Clean up once imported (Google recommends deleting finished sessions). ?id=… */
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (id) await deleteSession(googleToken(request), id).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
