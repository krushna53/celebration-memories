import "server-only";
import { NextResponse } from "next/server";

import { searchListings } from "@/services/marketplace-listings";
import type { ListingSearchFilters } from "@/types/marketplace";

export const dynamic = "force-dynamic";

/**
 * Listing search for the mobile app's Discover grid — same filters as
 * the web CategoryDirectory (features/discover/category-directory.tsx),
 * just as GET query params instead of a Server Component's searchParams.
 * Public, no auth; only ever returns approved + non-paused listings
 * (see searchListings).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp = url.searchParams;

  const filters: ListingSearchFilters = {
    categorySlug: sp.get("category") || undefined,
    citySlug: sp.get("city") || undefined,
    budgetMax: sp.get("budget") ? Number(sp.get("budget")) : undefined,
    verifiedOnly: sp.get("verified") === "1",
    featuredOnly: sp.get("featured") === "1",
    query: sp.get("q") || undefined,
    page: sp.get("page") ? Number(sp.get("page")) : 1,
    pageSize: 20,
  };

  const results = await searchListings(filters);
  return NextResponse.json(results);
}
