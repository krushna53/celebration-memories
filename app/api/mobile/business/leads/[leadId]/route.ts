import "server-only";
import { NextResponse } from "next/server";

import { requireMobileBusinessAccount } from "@/services/business-mobile-auth";
import { getPrimaryListingForAccount } from "@/services/marketplace-listings";
import { setLeadStatus } from "@/services/business-leads";
import type { BusinessLead } from "@/types/marketplace";

export const dynamic = "force-dynamic";

const VALID_STATUSES: BusinessLead["status"][] = ["new", "contacted", "closed"];

/** Updates a lead's status (new/contacted/closed) — the vendor's own listing is resolved server-side, never trusted from the client, same ownership model as the web dashboard's setLeadStatusAction. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  let account;
  try {
    account = await requireMobileBusinessAccount(request.headers.get("authorization"));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Not authorized." }, { status: 401 });
  }

  const { leadId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { status } = (body ?? {}) as { status?: string };
  if (!status || !VALID_STATUSES.includes(status as BusinessLead["status"])) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const listing = await getPrimaryListingForAccount(account.id);
  if (!listing) {
    return NextResponse.json({ error: "You don't have a listing yet." }, { status: 404 });
  }

  try {
    await setLeadStatus(leadId, listing.id, status as BusinessLead["status"]);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update lead." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
