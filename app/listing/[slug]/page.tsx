import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { ListingDetail } from "@/features/discover/listing-detail";
import { getListingBySlug } from "@/services/marketplace-listings";

export const dynamic = "force-dynamic";

interface ListingPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) return { title: "Listing not found — Celebration Memories" };
  return {
    title: `${listing.displayName} — Celebration Memories Discover`,
    description: listing.tagline ?? listing.aiSummary ?? listing.description ?? undefined,
  };
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) notFound();

  return (
    <SiteShell honoreeName="Celebration Memories" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <ListingDetail listing={listing} />
    </SiteShell>
  );
}
