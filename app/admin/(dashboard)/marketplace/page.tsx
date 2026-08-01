import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { listListingsForAdmin, listReviewsForAdmin } from "@/services/marketplace-listings";
import { listAllCategoriesForAdmin, listAllCities } from "@/services/marketplace-categories";
import { MarketplaceAdminClient } from "@/features/admin/marketplace/marketplace-admin-client";

export const dynamic = "force-dynamic";

/** Owner-only — not in CLIENT_ALLOWED_PATHS, so a "client" admin never sees this tab (see lib/admin-roles.ts). */
export default async function AdminMarketplacePage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const [listings, reviews, categories, cities] = await Promise.all([
    listListingsForAdmin(),
    listReviewsForAdmin("pending"),
    listAllCategoriesForAdmin(),
    listAllCities(),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Marketplace</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Moderate vendor listings and reviews, manage categories and cities, and bulk-import listings for the Discover
        directory.
      </p>
      <div className="mt-6">
        <MarketplaceAdminClient
          initialListings={listings}
          initialReviews={reviews}
          initialCategories={categories}
          initialCities={cities}
        />
      </div>
    </div>
  );
}
