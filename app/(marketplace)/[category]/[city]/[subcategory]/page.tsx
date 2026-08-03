import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { CategoryDirectory } from "@/features/discover/category-directory";
import { buildMarketplaceDirectoryMetadata } from "@/lib/marketplace-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; city: string; subcategory: string }>;
}): Promise<Metadata> {
  const { category, city, subcategory } = await params;
  return buildMarketplaceDirectoryMetadata(category, city, subcategory);
}

/** E.g. /photographers/mumbai/wedding-photographers. */
export default async function CategoryCitySubcategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; city: string; subcategory: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category, city, subcategory } = await params;
  const sp = await searchParams;

  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <CategoryDirectory categorySlug={category} citySlug={city} subcategorySlug={subcategory} searchParams={sp} />
    </SiteShell>
  );
}
