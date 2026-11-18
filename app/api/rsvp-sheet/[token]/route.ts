import { NextResponse } from "next/server";

import { buildRsvpSheetCsv } from "@/services/rsvp-sheet";

export const dynamic = "force-dynamic";

/**
 * The live RSVP sheet feed (services/rsvp-sheet.ts) — fetched by Google
 * Sheets' =IMPORTDATA(...) in the host's Drive. The token is the only
 * credential; an unknown or turned-off token gets a plain 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const csv = await buildRsvpSheetCsv(token).catch((err) => {
    console.error("rsvp-sheet feed failed:", err);
    return undefined;
  });
  if (csv === undefined) return new NextResponse("Could not load RSVPs right now.", { status: 500 });
  if (csv === null) return new NextResponse("Not found.", { status: 404 });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}
