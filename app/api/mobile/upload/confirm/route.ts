import "server-only";
import { NextResponse } from "next/server";

import { confirmUpload } from "@/features/uploads/actions";

export const dynamic = "force-dynamic";

/** Step 2 of the mobile upload flow — see ../request/route.ts's comment. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { token, kind, path, caption } = (body ?? {}) as {
    token?: string;
    kind?: "photo" | "video" | "audio";
    path?: string;
    caption?: string;
  };

  if (!token || !kind || !path) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (kind !== "photo" && kind !== "video" && kind !== "audio") {
    return NextResponse.json({ error: "Invalid upload kind." }, { status: 400 });
  }

  const result = await confirmUpload(token, kind, path, caption ?? "");
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ success: true });
}
