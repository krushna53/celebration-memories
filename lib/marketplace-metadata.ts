import type { Metadata } from "next";

import { getCategoryBySlug, getCityBySlug } from "@/services/marketplace-categories";
import { SITE_NAME } from "@/lib/constants";

/**
 * Builds per-page metadata for the three Marketplace directory URL
 * depths (/[category], /[category]/[city], /[category]/[city]/[subcategory]
 * — see app/(marketplace)/[category]/**\/page.tsx, all three rendered by
 * the same features/discover/category-directory.tsx). Mirrors
 * lib/event-metadata.ts's buildEventMetadata in spirit: never throws
 * (an unknown/renamed slug just falls back to a generic title rather
 * than breaking the page), and every one of these pages gets a unique,
 * keyword-specific title/description instead of sharing the platform's
 * generic root layout fallback — these directory pages are exactly the
 * kind of long-tail ("wedding photographers in mumbai") page a search
 * engine can actually send new traffic to, so a shared generic title
 * across all of them would waste that.
 */
export async function buildMarketplaceDirectoryMetadata(
  categorySlug: string,
  citySlug?: string,
  subcategorySlug?: string,
): Promise<Metadata> {
  try {
    const [category, subcategory, city] = await Promise.all([
      getCategoryBySlug(categorySlug),
      subcategorySlug ? getCategoryBySlug(subcategorySlug) : Promise.resolve(null),
      citySlug ? getCityBySlug(citySlug) : Promise.resolve(null),
    ]);

    const categoryName = subcategory?.name ?? category?.name ?? "Event Vendors";
    const cityName = city?.name;

    const title = cityName
      ? `${categoryName} in ${cityName} | ${SITE_NAME} Discover`
      : `${categoryName} | ${SITE_NAME} Discover`;

    const description = cityName
      ? `Browse and compare ${categoryName.toLowerCase()} in ${cityName}. Real profiles, galleries, and pricing — contact vendors directly, no commission.`
      : `Browse and compare ${categoryName.toLowerCase()} for your next celebration. Real profiles, galleries, and pricing — contact vendors directly, no commission.`;

    return {
      title,
      description,
      openGraph: { title, description, type: "website" },
      twitter: { card: "summary", title, description },
    };
  } catch (err) {
    console.error("buildMarketplaceDirectoryMetadata failed:", err);
    return {
      title: `Event Vendors | ${SITE_NAME} Discover`,
      description: `Browse and compare event vendors on ${SITE_NAME} Discover.`,
    };
  }
}
