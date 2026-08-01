import "server-only";
import { NextResponse } from "next/server";

import { getListingBySlug, getRelatedListings } from "@/services/marketplace-listings";

export const dynamic = "force-dynamic";

/** Full listing detail (gallery, services, FAQs, reviews) + a few related listings — mirrors app/listing/[slug]/page.tsx. Public, no auth. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);

  if (!listing) {
    return NextResponse.json({ error: "That listing could not be found." }, { status: 404 });
  }

  const related = await getRelatedListings(listing.id, listing.primaryCategoryId, 4);
  return NextResponse.json({ listing, related });
}
