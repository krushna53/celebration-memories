import "server-only";
import { NextResponse } from "next/server";

import { createLead } from "@/services/business-leads";
import { businessLeadFormSchema } from "@/types/marketplace";

export const dynamic = "force-dynamic";

/**
 * Sends an inquiry to a vendor from the mobile Discover listing detail
 * screen — same as the web's submitLeadAction (features/business/actions.ts).
 * Public, no auth (any guest/host can contact a vendor).
 *
 * Named `[slug]` to match the sibling detail route's dynamic segment
 * (Next.js requires matching param names across sibling routes at the
 * same path level), but the value passed here is actually the listing's
 * `id` — the same field the sibling GET /listing/[slug] route returns as
 * `listing.id`, since business_leads.business_id is an id, not a slug.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: listingId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = businessLeadFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please check your details and try again." },
      { status: 400 },
    );
  }

  try {
    await createLead(listingId, parsed.data, "mobile_app");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send your message." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
