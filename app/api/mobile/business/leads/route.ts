import "server-only";
import { NextResponse } from "next/server";

import { requireMobileBusinessAccount } from "@/services/business-mobile-auth";
import { getPrimaryListingForAccount } from "@/services/marketplace-listings";
import { listLeadsForBusiness } from "@/services/business-leads";

export const dynamic = "force-dynamic";

/** Full leads inbox for the vendor's listing — mirrors the web dashboard's Leads tab. */
export async function GET(request: Request) {
  let account;
  try {
    account = await requireMobileBusinessAccount(request.headers.get("authorization"));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Not authorized." }, { status: 401 });
  }

  const listing = await getPrimaryListingForAccount(account.id);
  if (!listing) {
    return NextResponse.json({ error: "You don't have a listing yet — create one from the website first." }, { status: 404 });
  }

  const leads = await listLeadsForBusiness(listing.id);
  return NextResponse.json({ leads });
}
