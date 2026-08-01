import "server-only";
import { NextResponse } from "next/server";

import { requireMobileBusinessAccount } from "@/services/business-mobile-auth";
import { getPrimaryListingForAccount, setListingPaused } from "@/services/marketplace-listings";

export const dynamic = "force-dynamic";

/** Toggles the vendor's listing paused/live from the mobile app — same setListingPaused() the web dashboard's PauseToggleButton calls. Only meaningful once a listing is approved, but doesn't hard-block otherwise (pausing a draft is a harmless no-op). */
export async function PATCH(request: Request) {
  let account;
  try {
    account = await requireMobileBusinessAccount(request.headers.get("authorization"));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Not authorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { paused } = (body ?? {}) as { paused?: boolean };
  if (typeof paused !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const listing = await getPrimaryListingForAccount(account.id);
  if (!listing) {
    return NextResponse.json({ error: "You don't have a listing yet." }, { status: 404 });
  }

  try {
    await setListingPaused(listing.id, account.id, paused);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update listing." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
