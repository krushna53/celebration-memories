import "server-only";
import { NextResponse } from "next/server";

import { requireMobileBusinessAccount } from "@/services/business-mobile-auth";
import { getPrimaryListingForAccount } from "@/services/marketplace-listings";
import { listLeadsForBusiness } from "@/services/business-leads";

export const dynamic = "force-dynamic";

/** Landing data for the mobile app's lightweight Vendor screen: account info, their listing's status/pause state, and a quick lead count. */
export async function GET(request: Request) {
  let account;
  try {
    account = await requireMobileBusinessAccount(request.headers.get("authorization"));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Not authorized." }, { status: 401 });
  }

  const listing = await getPrimaryListingForAccount(account.id);
  if (!listing) {
    return NextResponse.json({ account, listing: null, newLeadCount: 0 });
  }

  const leads = await listLeadsForBusiness(listing.id);
  const newLeadCount = leads.filter((l) => l.status === "new").length;

  return NextResponse.json({ account, listing, newLeadCount });
}
