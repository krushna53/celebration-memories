"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import {
  listListingsForAdmin,
  setListingStatus,
  setListingVerified,
  setListingFeatured,
  listReviewsForAdmin,
  setReviewStatus,
  bulkImportListings,
} from "@/services/marketplace-listings";
import {
  listAllCategoriesForAdmin,
  listAllCities,
  createCategory,
  setCategoryActive,
  deleteCategory,
  createCity,
  deleteCity,
} from "@/services/marketplace-categories";
import type { BusinessListing, ListingStatus, MarketplaceCategory, MarketplaceCity, Review } from "@/types/marketplace";

export type AdminMpResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

/** Every listing, imported CSV rows go here too — see marketplace_module CLAUDE.md spec's "Admin Moderation" section. */
const SYSTEM_IMPORT_ACCOUNT_ID = "11111111-1111-1111-1111-111111111199";

export async function listListingsForAdminAction(status?: ListingStatus): Promise<AdminMpResult<BusinessListing[]>> {
  try {
    await requireOwner();
    const listings = await listListingsForAdmin(status);
    return { success: true, data: listings };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load listings." };
  }
}

export async function setListingStatusAction(listingId: string, status: ListingStatus): Promise<AdminMpResult<undefined>> {
  try {
    await requireOwner();
    await setListingStatus(listingId, status);
    revalidatePath("/admin/marketplace");
    revalidatePath("/discover");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update listing." };
  }
}

export async function setListingVerifiedAction(listingId: string, verified: boolean): Promise<AdminMpResult<undefined>> {
  try {
    await requireOwner();
    await setListingVerified(listingId, verified);
    revalidatePath("/admin/marketplace");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update listing." };
  }
}

export async function setListingFeaturedAction(listingId: string, featured: boolean): Promise<AdminMpResult<undefined>> {
  try {
    await requireOwner();
    await setListingFeatured(listingId, featured);
    revalidatePath("/admin/marketplace");
    revalidatePath("/discover");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update listing." };
  }
}

export async function listReviewsForAdminAction(
  status: Review["status"] = "pending",
): Promise<AdminMpResult<(Review & { businessId: string; businessName: string })[]>> {
  try {
    await requireOwner();
    const reviews = await listReviewsForAdmin(status);
    return { success: true, data: reviews };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load reviews." };
  }
}

export async function setReviewStatusAction(
  reviewId: string,
  businessId: string,
  status: Review["status"],
): Promise<AdminMpResult<undefined>> {
  try {
    await requireOwner();
    await setReviewStatus(reviewId, businessId, status);
    revalidatePath("/admin/marketplace");
    revalidatePath("/discover");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update review." };
  }
}

export async function listCategoriesForAdminAction(): Promise<AdminMpResult<MarketplaceCategory[]>> {
  try {
    await requireOwner();
    const categories = await listAllCategoriesForAdmin();
    return { success: true, data: categories };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load categories." };
  }
}

export async function createCategoryAction(input: {
  slug: string;
  name: string;
  parentId: string | null;
  description?: string;
  icon?: string;
}): Promise<AdminMpResult<MarketplaceCategory>> {
  try {
    await requireOwner();
    if (!input.slug.trim() || !input.name.trim()) {
      return { success: false, error: "Please add both a name and a slug." };
    }
    const category = await createCategory(input);
    revalidatePath("/admin/marketplace");
    revalidatePath("/discover");
    return { success: true, data: category };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create category." };
  }
}

export async function setCategoryActiveAction(id: string, isActive: boolean): Promise<AdminMpResult<undefined>> {
  try {
    await requireOwner();
    await setCategoryActive(id, isActive);
    revalidatePath("/admin/marketplace");
    revalidatePath("/discover");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update category." };
  }
}

export async function deleteCategoryAction(id: string): Promise<AdminMpResult<undefined>> {
  try {
    await requireOwner();
    await deleteCategory(id);
    revalidatePath("/admin/marketplace");
    revalidatePath("/discover");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete category." };
  }
}

export async function listCitiesForAdminAction(): Promise<AdminMpResult<MarketplaceCity[]>> {
  try {
    await requireOwner();
    const cities = await listAllCities();
    return { success: true, data: cities };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load cities." };
  }
}

export async function createCityAction(input: { slug: string; name: string; state?: string; country?: string }): Promise<AdminMpResult<MarketplaceCity>> {
  try {
    await requireOwner();
    if (!input.slug.trim() || !input.name.trim()) {
      return { success: false, error: "Please add both a name and a slug." };
    }
    const city = await createCity(input);
    revalidatePath("/admin/marketplace");
    revalidatePath("/discover");
    return { success: true, data: city };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create city." };
  }
}

export async function deleteCityAction(id: string): Promise<AdminMpResult<undefined>> {
  try {
    await requireOwner();
    await deleteCity(id);
    revalidatePath("/admin/marketplace");
    revalidatePath("/discover");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete city." };
  }
}

/**
 * CSV-imported listings all attach to one shared "Admin Bulk Import"
 * business_accounts row (business_profiles.account_id has a NOT NULL FK
 * to business_accounts, which itself FKs to a real auth.users row — see
 * the SQL that seeded SYSTEM_IMPORT_ACCOUNT_ID). They're auto-approved,
 * mirroring how an owner directly curating listings should behave.
 */
export async function bulkImportListingsAction(
  rows: { displayName: string; categorySlug?: string; citySlug?: string; description?: string; contactEmail?: string; contactPhone?: string }[],
): Promise<AdminMpResult<{ created: number; skipped: number }>> {
  try {
    await requireOwner();
    const result = await bulkImportListings(SYSTEM_IMPORT_ACCOUNT_ID, rows);
    revalidatePath("/admin/marketplace");
    revalidatePath("/discover");
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to import listings." };
  }
}
