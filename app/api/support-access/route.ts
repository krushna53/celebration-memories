import { NextResponse } from "next/server";
import { supportExpiry } from "@/services/event-access";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("event");
  const expiry = id ? await supportExpiry(id) : null;
  return NextResponse.json({ expiresAt: expiry }, { status: expiry ? 200 : 403, headers: { "Cache-Control": "private, no-store" } });
}
