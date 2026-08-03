import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { CategoryDirectory } from "@/features/discover/category-directory";
import { buildMarketplaceDirectoryMetadata } from "@/lib/marketplace-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; city: string }>;
}): Promise<Metadata> {
  const { category, city } = await params;
  return buildMarketplaceDirectoryMetadata(category, city);
}

/** E.g. /photographers/mumbai. */
export default async function CategoryCityPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category, city } = await params;
  const sp = await searchParams;

  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <CategoryDirectory categorySlug={category} citySlug={city} searchParams={sp} />
    </SiteShell>
  );
}
