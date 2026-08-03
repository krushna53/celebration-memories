import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/constants";
import { listPublicEvents } from "@/services/events";
import { listAllPublicListingSlugs } from "@/services/marketplace-listings";
import { listAllCategories, listAllCities } from "@/services/marketplace-categories";

/**
 * Static routes + every public event + the whole Marketplace directory
 * (listings, categories, category/city, category/city/subcategory),
 * generated at request time (not cached at build time) so newly
 * approved events/listings/categories show up without a redeploy.
 * Private events and unapproved/paused listings are deliberately
 * excluded — see listPublicEvents() and listAllPublicListingSlugs()'s
 * doc comments for the exact visibility rules each mirrors.
 *
 * Category/city combinations are generated from whatever's actually
 * seeded in marketplace_categories/marketplace_cities (small numbers
 * today — 5 top-level categories, ~43 subcategories, 4 cities — so the
 * full cross-product is a few hundred URLs, well within a sitemap's
 * practical size). If this directory grows into many more cities, the
 * category+city+subcategory tier (the deepest, least-trafficked pages)
 * is the one to drop first or cap, rather than the category/category+city
 * tiers.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/events`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/discover`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/pricing`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/business`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/roles`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/guide`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/templates/submit`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/refund-policy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/shipping-policy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  let eventRoutes: MetadataRoute.Sitemap = [];
  try {
    const events = await listPublicEvents();
    eventRoutes = events.map((event) => ({
      url: `${SITE_URL}/events/${event.slug}`,
      lastModified: event.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch (err) {
    console.error("sitemap failed to load public events:", err);
  }

  let listingRoutes: MetadataRoute.Sitemap = [];
  try {
    const listings = await listAllPublicListingSlugs();
    listingRoutes = listings.map((listing) => ({
      url: `${SITE_URL}/listing/${listing.slug}`,
      lastModified: listing.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch (err) {
    console.error("sitemap failed to load public listings:", err);
  }

  const marketplaceRoutes: MetadataRoute.Sitemap = [];
  try {
    const [categories, cities] = await Promise.all([listAllCategories(), listAllCities()]);
    const topCategories = categories.filter((c) => c.parentId === null);
    const subcategoriesByParent = new Map<string, typeof categories>();
    for (const c of categories) {
      if (!c.parentId) continue;
      const list = subcategoriesByParent.get(c.parentId) ?? [];
      list.push(c);
      subcategoriesByParent.set(c.parentId, list);
    }

    for (const category of topCategories) {
      marketplaceRoutes.push({ url: `${SITE_URL}/${category.slug}`, changeFrequency: "weekly", priority: 0.5 });

      for (const city of cities) {
        marketplaceRoutes.push({
          url: `${SITE_URL}/${category.slug}/${city.slug}`,
          changeFrequency: "weekly",
          priority: 0.5,
        });

        for (const sub of subcategoriesByParent.get(category.id) ?? []) {
          marketplaceRoutes.push({
            url: `${SITE_URL}/${category.slug}/${city.slug}/${sub.slug}`,
            changeFrequency: "weekly",
            priority: 0.4,
          });
        }
      }
    }
  } catch (err) {
    console.error("sitemap failed to load marketplace categories/cities:", err);
  }

  return [...staticRoutes, ...eventRoutes, ...listingRoutes, ...marketplaceRoutes];
}
