import "server-only";
import { NextResponse } from "next/server";

import { searchListings } from "@/services/marketplace-listings";
import { publicMediaUrl } from "@/services/uploads";
import type { ListingSearchFilters } from "@/types/marketplace";

export const dynamic = "force-dynamic";

/**
 * Listing search for the mobile app's Discover grid — same filters as
 * the web CategoryDirectory (features/discover/category-directory.tsx),
 * just as GET query params instead of a Server Component's searchParams.
 * Public, no auth; only ever returns approved + non-paused listings
 * (see searchListings).
 *
 * Resolves `profileImagePath` to a ready-to-use `profileImageUrl` before
 * responding — same "mobile always gets full URLs, never raw storage
 * paths" convention as services/memory-wall.ts's MemoryItem.url, since
 * the web's own ListingCard resolves this at render time via a
 * server-only helper the mobile app has no equivalent for.
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
  const listings = results.listings.map(({ profileImagePath, ...rest }) => ({
    ...rest,
    profileImageUrl: profileImagePath ? publicMediaUrl("business", profileImagePath) : null,
  }));

  return NextResponse.json({ ...results, listings });
}
