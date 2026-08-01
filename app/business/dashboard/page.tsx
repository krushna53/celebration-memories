import { getCurrentBusinessAccount } from "@/services/business-auth";
import { listListingsForAccount, getOwnListingBySlug } from "@/services/marketplace-listings";
import { listAllCategories, listAllCities } from "@/services/marketplace-categories";
import { CreateListingForm } from "@/features/business/create-listing-form";
import { BusinessDashboardClient } from "@/features/business/dashboard-client";

export const dynamic = "force-dynamic";

export default async function BusinessDashboardPage() {
  // Layout already redirects unauthenticated visitors — safe to assume an account here.
  const account = await getCurrentBusinessAccount();
  if (!account) return null;

  const [listings, categories, cities] = await Promise.all([
    listListingsForAccount(account.id),
    listAllCategories(),
    listAllCities(),
  ]);

  const [firstListing] = listings;
  if (!firstListing) {
    return <CreateListingForm categories={categories} cities={cities} />;
  }

  const listing = await getOwnListingBySlug(firstListing.slug, account.id);
  if (!listing) {
    return <CreateListingForm categories={categories} cities={cities} />;
  }

  return <BusinessDashboardClient listing={listing} categories={categories} cities={cities} />;
}
