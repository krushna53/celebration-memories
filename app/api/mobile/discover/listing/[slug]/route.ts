import "server-only";
import { NextResponse } from "next/server";

import { getListingBySlug, getRelatedListings } from "@/services/marketplace-listings";
import { publicMediaUrl } from "@/services/uploads";

export const dynamic = "force-dynamic";

/**
 * Full listing detail (gallery, services, FAQs, reviews) + a few related
 * listings — mirrors app/listing/[slug]/page.tsx. Public, no auth.
 * Resolves every image path to a ready-to-use URL, same convention as
 * the search route (see its doc comment).
 */
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
  const relatedResolved = related.map(({ profileImagePath, ...rest }) => ({
    ...rest,
    profileImageUrl: profileImagePath ? publicMediaUrl("business", profileImagePath) : null,
  }));

  const { profileImagePath, coverImagePath, gallery, ...restListing } = listing;
  const resolvedListing = {
    ...restListing,
    profileImageUrl: profileImagePath ? publicMediaUrl("business", profileImagePath) : null,
    coverImageUrl: coverImagePath ? publicMediaUrl("business", coverImagePath) : null,
    gallery: gallery.map(({ storagePath, ...photo }) => ({ ...photo, photoUrl: publicMediaUrl("business", storagePath) })),
  };

  return NextResponse.json({ listing: resolvedListing, related: relatedResolved });
}
