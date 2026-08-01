import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCategoryBySlug, getCategoryById } from "@/services/marketplace-categories";
import type {
  BusinessListing,
  BusinessListingWithRelations,
  BusinessListingSummary,
  BusinessGalleryPhoto,
  BusinessService,
  BusinessFaq,
  Review,
  ListingSearchFilters,
  ListingSearchResult,
  ListingProfileFormValues,
  BusinessServiceFormValues,
  BusinessFaqFormValues,
  ReviewFormValues,
  ListingStatus,
  MarketplaceCategory,
  MarketplaceCity,
} from "@/types/marketplace";

/**
 * Core listing CRUD + search. A "listing" is a row in `business_profiles`
 * — one business can carry multiple categories via the `business_categories`
 * junction table (many-to-many), matching the spec's "One business can
 * belong to multiple categories" principle.
 */

interface ListingRow {
  id: string;
  account_id: string;
  slug: string;
  profile_type: BusinessListing["profileType"];
  display_name: string;
  tagline: string | null;
  description: string | null;
  ai_summary: string | null;
  profile_image_path: string | null;
  cover_image_path: string | null;
  primary_category_id: string | null;
  city_id: string | null;
  address: string | null;
  cities_served: string[];
  languages: string[];
  tags: string[];
  starting_price: number | string | null;
  price_unit: string | null;
  website: string | null;
  whatsapp_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
  is_verified: boolean;
  is_featured: boolean;
  is_paused: boolean;
  instant_booking: boolean;
  status: ListingStatus;
  rating_avg: number | string;
  rating_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

function mapListing(row: ListingRow): BusinessListing {
  return {
    id: row.id,
    accountId: row.account_id,
    slug: row.slug,
    profileType: row.profile_type,
    displayName: row.display_name,
    tagline: row.tagline,
    description: row.description,
    aiSummary: row.ai_summary,
    profileImagePath: row.profile_image_path,
    coverImagePath: row.cover_image_path,
    primaryCategoryId: row.primary_category_id,
    cityId: row.city_id,
    address: row.address,
    citiesServed: row.cities_served ?? [],
    languages: row.languages ?? [],
    tags: row.tags ?? [],
    startingPrice: row.starting_price === null ? null : Number(row.starting_price),
    priceUnit: row.price_unit,
    website: row.website,
    whatsappNumber: row.whatsapp_number,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    instagramUrl: row.instagram_url,
    facebookUrl: row.facebook_url,
    youtubeUrl: row.youtube_url,
    linkedinUrl: row.linkedin_url,
    isVerified: row.is_verified,
    isFeatured: row.is_featured,
    isPaused: row.is_paused,
    instantBooking: row.instant_booking,
    status: row.status,
    ratingAvg: Number(row.rating_avg),
    ratingCount: row.rating_count,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Generates a unique slug for a new listing, appending -2/-3/... on collision. */
async function generateUniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "listing";
  let candidate = root;
  for (let i = 2; i < 50; i++) {
    const { data } = await supabaseAdmin().from("business_profiles").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export async function createListing(accountId: string, input: ListingProfileFormValues): Promise<BusinessListing> {
  const slug = await generateUniqueSlug(input.displayName);
  const { data, error } = await supabaseAdmin()
    .from("business_profiles")
    .insert({
      account_id: accountId,
      slug,
      profile_type: input.profileType,
      display_name: input.displayName,
      tagline: input.tagline || null,
      description: input.description || null,
      primary_category_id: input.primaryCategoryId || null,
      city_id: input.cityId || null,
      address: input.address || null,
      cities_served: input.citiesServed ?? [],
      languages: input.languages ?? [],
      tags: input.tags ?? [],
      starting_price: input.startingPrice ?? null,
      price_unit: input.priceUnit || null,
      website: input.website || null,
      whatsapp_number: input.whatsappNumber || null,
      contact_email: input.contactEmail || null,
      contact_phone: input.contactPhone || null,
      instagram_url: input.instagramUrl || null,
      facebook_url: input.facebookUrl || null,
      youtube_url: input.youtubeUrl || null,
      linkedin_url: input.linkedinUrl || null,
      status: "draft",
    })
    .select("*")
    .single<ListingRow>();

  if (error || !data) throw new Error(`Failed to create listing: ${error?.message}`);

  if (input.primaryCategoryId) {
    await supabaseAdmin()
      .from("business_categories")
      .upsert({ business_id: data.id, category_id: input.primaryCategoryId }, { onConflict: "business_id,category_id" });
  }

  return mapListing(data);
}

export async function updateListingProfile(
  listingId: string,
  accountId: string,
  input: ListingProfileFormValues,
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("business_profiles")
    .update({
      profile_type: input.profileType,
      display_name: input.displayName,
      tagline: input.tagline || null,
      description: input.description || null,
      primary_category_id: input.primaryCategoryId || null,
      city_id: input.cityId || null,
      address: input.address || null,
      cities_served: input.citiesServed ?? [],
      languages: input.languages ?? [],
      tags: input.tags ?? [],
      starting_price: input.startingPrice ?? null,
      price_unit: input.priceUnit || null,
      website: input.website || null,
      whatsapp_number: input.whatsappNumber || null,
      contact_email: input.contactEmail || null,
      contact_phone: input.contactPhone || null,
      instagram_url: input.instagramUrl || null,
      facebook_url: input.facebookUrl || null,
      youtube_url: input.youtubeUrl || null,
      linkedin_url: input.linkedinUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)
    .eq("account_id", accountId);
  if (error) throw new Error(`Failed to update listing: ${error.message}`);

  if (input.primaryCategoryId) {
    await supabaseAdmin()
      .from("business_categories")
      .upsert({ business_id: listingId, category_id: input.primaryCategoryId }, { onConflict: "business_id,category_id" });
  }
}

export async function setListingImages(
  listingId: string,
  accountId: string,
  input: { profileImagePath?: string; coverImagePath?: string },
): Promise<void> {
  const patch: Record<string, string> = {};
  if (input.profileImagePath) patch.profile_image_path = input.profileImagePath;
  if (input.coverImagePath) patch.cover_image_path = input.coverImagePath;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabaseAdmin()
    .from("business_profiles")
    .update(patch)
    .eq("id", listingId)
    .eq("account_id", accountId);
  if (error) throw new Error(`Failed to update images: ${error.message}`);
}

/**
 * Vendor-controlled "pause" — hides an otherwise-approved listing from
 * Discover search and its own detail page without touching `status`
 * (so un-pausing doesn't require re-approval). Exposed on both the web
 * dashboard and the mobile app's lightweight vendor view (see
 * app/api/mobile/business/pause/route.ts) — same ownership check either
 * way via assertOwnsListing.
 */
export async function setListingPaused(listingId: string, accountId: string, paused: boolean): Promise<void> {
  await assertOwnsListing(listingId, accountId);
  const { error } = await supabaseAdmin()
    .from("business_profiles")
    .update({ is_paused: paused, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("account_id", accountId);
  if (error) throw new Error(`Failed to update listing: ${error.message}`);
}

/** Submits a draft listing for admin review — the only way a listing can move from draft into the public directory. */
export async function submitListingForReview(listingId: string, accountId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("business_profiles")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("account_id", accountId)
    .in("status", ["draft", "rejected"]);
  if (error) throw new Error(`Failed to submit listing: ${error.message}`);
}

/**
 * Resolves the one listing the mobile app's lightweight Vendor view
 * operates on — the same "first listing" simplification the web
 * dashboard already makes (app/business/dashboard/page.tsx), since
 * multi-listing vendor accounts aren't supported by either UI yet.
 */
export async function getPrimaryListingForAccount(accountId: string): Promise<BusinessListing | null> {
  const listings = await listListingsForAccount(accountId);
  return listings[0] ?? null;
}

export async function listListingsForAccount(accountId: string): Promise<BusinessListing[]> {
  const { data, error } = await supabaseAdmin()
    .from("business_profiles")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load listings: ${error.message}`);
  return (data ?? []).map(mapListing);
}

/** Throws unless `accountId` actually owns `listingId` — used by every business-dashboard sub-resource action (gallery/services/FAQs/leads/AI summary) that only receives a bare listingId, not the full listing object, so ownership must be re-checked server-side every time rather than trusted from the client. */
export async function assertOwnsListing(listingId: string, accountId: string): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from("business_profiles")
    .select("id")
    .eq("id", listingId)
    .eq("account_id", accountId)
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(`Failed to verify listing ownership: ${error.message}`);
  if (!data) throw new Error("You don't have access to this listing.");
}

export async function getListingById(listingId: string): Promise<BusinessListing | null> {
  const { data, error } = await supabaseAdmin()
    .from("business_profiles")
    .select("*")
    .eq("id", listingId)
    .maybeSingle<ListingRow>();
  if (error) throw new Error(`Failed to load listing: ${error.message}`);
  return data ? mapListing(data) : null;
}

async function attachRelations(row: ListingRow): Promise<BusinessListingWithRelations> {
  const listing = mapListing(row);

  const [{ data: catLinks }, { data: cityRow }, { data: galleryRows }, { data: serviceRows }, { data: faqRows }, { data: reviewRows }] =
    await Promise.all([
      supabaseAdmin().from("business_categories").select("category_id").eq("business_id", row.id),
      row.city_id
        ? supabaseAdmin().from("marketplace_cities").select("*").eq("id", row.city_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin().from("business_gallery").select("*").eq("business_id", row.id).order("sort_order", { ascending: true }),
      supabaseAdmin().from("business_services").select("*").eq("business_id", row.id).order("sort_order", { ascending: true }),
      supabaseAdmin().from("business_faqs").select("*").eq("business_id", row.id).order("sort_order", { ascending: true }),
      supabaseAdmin()
        .from("reviews")
        .select("*")
        .eq("business_id", row.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
    ]);

  const categories: MarketplaceCategory[] = [];
  for (const link of (catLinks as { category_id: string }[] | null) ?? []) {
    const cat = await getCategoryById(link.category_id);
    if (cat) categories.push(cat);
  }

  const city: MarketplaceCity | null = cityRow
    ? {
        id: (cityRow as { id: string }).id,
        slug: (cityRow as { slug: string }).slug,
        name: (cityRow as { name: string }).name,
        state: (cityRow as { state: string | null }).state,
        country: (cityRow as { country: string }).country,
      }
    : null;

  const gallery: BusinessGalleryPhoto[] = ((galleryRows as
    | { id: string; storage_path: string; caption: string | null; sort_order: number }[]
    | null) ?? []).map((g) => ({ id: g.id, storagePath: g.storage_path, caption: g.caption, sortOrder: g.sort_order }));

  const services: BusinessService[] = ((serviceRows as
    | { id: string; name: string; description: string | null; price: number | string | null; price_unit: string | null; sort_order: number }[]
    | null) ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    price: s.price === null ? null : Number(s.price),
    priceUnit: s.price_unit,
    sortOrder: s.sort_order,
  }));

  const faqs: BusinessFaq[] = ((faqRows as
    | { id: string; question: string; answer: string; sort_order: number }[]
    | null) ?? []).map((f) => ({ id: f.id, question: f.question, answer: f.answer, sortOrder: f.sort_order }));

  const reviews: Review[] = ((reviewRows as
    | { id: string; reviewer_name: string; rating: number; comment: string | null; status: Review["status"]; created_at: string }[]
    | null) ?? []).map((r) => ({
    id: r.id,
    reviewerName: r.reviewer_name,
    rating: r.rating,
    comment: r.comment,
    status: r.status,
    createdAt: r.created_at,
  }));

  return { ...listing, categories, city, gallery, services, faqs, reviews };
}

/** Full listing detail page data — only resolves approved listings (draft/pending/rejected are never publicly reachable). */
export async function getListingBySlug(slug: string): Promise<BusinessListingWithRelations | null> {
  const { data, error } = await supabaseAdmin()
    .from("business_profiles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "approved")
    .eq("is_paused", false)
    .maybeSingle<ListingRow>();
  if (error) throw new Error(`Failed to load listing: ${error.message}`);
  if (!data) return null;

  // Fire-and-forget view count bump — best-effort, never blocks the page.
  void supabaseAdmin()
    .from("business_profiles")
    .update({ view_count: data.view_count + 1 })
    .eq("id", data.id)
    .then(() => undefined);

  return attachRelations(data);
}

/** Same as getListingBySlug but for the business's own dashboard preview — returns any status, scoped to the owning account. */
export async function getOwnListingBySlug(slug: string, accountId: string): Promise<BusinessListingWithRelations | null> {
  const { data, error } = await supabaseAdmin()
    .from("business_profiles")
    .select("*")
    .eq("slug", slug)
    .eq("account_id", accountId)
    .maybeSingle<ListingRow>();
  if (error) throw new Error(`Failed to load listing: ${error.message}`);
  return data ? attachRelations(data) : null;
}

function toSummary(row: ListingRow, cityName: string | null): BusinessListingSummary {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    tagline: row.tagline,
    profileImagePath: row.profile_image_path,
    cityName,
    startingPrice: row.starting_price === null ? null : Number(row.starting_price),
    priceUnit: row.price_unit,
    isVerified: row.is_verified,
    isFeatured: row.is_featured,
    ratingAvg: Number(row.rating_avg),
    ratingCount: row.rating_count,
  };
}

/**
 * Directory/search query — powers /[category], /[category]/[city], and
 * /[category]/[city]/[subcategory]. Only ever returns status='approved'
 * listings; category filtering goes through the business_categories
 * junction so a listing tagged under a subcategory also surfaces under
 * its parent category page.
 */
export async function searchListings(filters: ListingSearchFilters): Promise<ListingSearchResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, filters.pageSize ?? 12));

  let categoryIds: string[] | null = null;
  if (filters.categorySlug) {
    const category = await getCategoryBySlug(filters.categorySlug);
    if (!category) return { listings: [], total: 0, page, pageSize };
    // Include the category itself plus every subcategory under it, so /photographers
    // also surfaces listings tagged only under "Wedding Photographer".
    const all = await supabaseAdmin().from("marketplace_categories").select("id, parent_id").eq("is_active", true);
    const rows = (all.data as { id: string; parent_id: string | null }[] | null) ?? [];
    categoryIds = [category.id, ...rows.filter((r) => r.parent_id === category.id).map((r) => r.id)];
  }

  let cityId: string | null = null;
  if (filters.citySlug) {
    const { data: cityRow } = await supabaseAdmin()
      .from("marketplace_cities")
      .select("id")
      .eq("slug", filters.citySlug)
      .maybeSingle<{ id: string }>();
    if (!cityRow) return { listings: [], total: 0, page, pageSize };
    cityId = cityRow.id;
  }

  let matchingBusinessIds: string[] | null = null;
  if (categoryIds) {
    const { data: links } = await supabaseAdmin()
      .from("business_categories")
      .select("business_id")
      .in("category_id", categoryIds);
    matchingBusinessIds = Array.from(new Set((links as { business_id: string }[] | null)?.map((l) => l.business_id) ?? []));
    if (matchingBusinessIds.length === 0) return { listings: [], total: 0, page, pageSize };
  }

  let query = supabaseAdmin()
    .from("business_profiles")
    .select("*", { count: "exact" })
    .eq("status", "approved")
    .eq("is_paused", false);
  if (matchingBusinessIds) query = query.in("id", matchingBusinessIds);
  if (cityId) query = query.eq("city_id", cityId);
  if (filters.budgetMax !== undefined) query = query.lte("starting_price", filters.budgetMax);
  if (filters.minRating !== undefined) query = query.gte("rating_avg", filters.minRating);
  if (filters.verifiedOnly) query = query.eq("is_verified", true);
  if (filters.featuredOnly) query = query.eq("is_featured", true);
  if (filters.query) query = query.ilike("display_name", `%${filters.query}%`);
  if (filters.languages && filters.languages.length > 0) query = query.overlaps("languages", filters.languages);

  query = query
    .order("is_featured", { ascending: false })
    .order("rating_avg", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`Search failed: ${error.message}`);

  const rows = (data as ListingRow[] | null) ?? [];
  const cityIds = Array.from(new Set(rows.map((r) => r.city_id).filter((id): id is string => !!id)));
  const cityMap = new Map<string, string>();
  if (cityIds.length > 0) {
    const { data: cities } = await supabaseAdmin().from("marketplace_cities").select("id, name").in("id", cityIds);
    for (const c of (cities as { id: string; name: string }[] | null) ?? []) cityMap.set(c.id, c.name);
  }

  return {
    listings: rows.map((r) => toSummary(r, r.city_id ? (cityMap.get(r.city_id) ?? null) : null)),
    total: count ?? rows.length,
    page,
    pageSize,
  };
}

/** A handful of other approved listings sharing a category — "Related Listings" on the detail page. */
export async function getRelatedListings(listingId: string, categoryId: string | null, limit = 4): Promise<BusinessListingSummary[]> {
  if (!categoryId) return [];
  const { data: links } = await supabaseAdmin()
    .from("business_categories")
    .select("business_id")
    .eq("category_id", categoryId);
  const ids = ((links as { business_id: string }[] | null) ?? []).map((l) => l.business_id).filter((id) => id !== listingId);
  if (ids.length === 0) return [];

  const { data, error } = await supabaseAdmin()
    .from("business_profiles")
    .select("*")
    .in("id", ids)
    .eq("status", "approved")
    .eq("is_paused", false)
    .order("rating_avg", { ascending: false })
    .limit(limit);
  if (error) return [];

  const rows = (data as ListingRow[] | null) ?? [];
  return rows.map((r) => toSummary(r, null));
}

// --- Gallery / Services / FAQs (business-owner-managed sub-resources) ---

export async function addGalleryPhoto(businessId: string, storagePath: string, caption?: string): Promise<BusinessGalleryPhoto> {
  const { data, error } = await supabaseAdmin()
    .from("business_gallery")
    .insert({ business_id: businessId, storage_path: storagePath, caption: caption || null })
    .select("*")
    .single<{ id: string; storage_path: string; caption: string | null; sort_order: number }>();
  if (error || !data) throw new Error(`Failed to add photo: ${error?.message}`);
  return { id: data.id, storagePath: data.storage_path, caption: data.caption, sortOrder: data.sort_order };
}

export async function deleteGalleryPhoto(businessId: string, photoId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("business_gallery").delete().eq("id", photoId).eq("business_id", businessId);
  if (error) throw new Error(`Failed to delete photo: ${error.message}`);
}

export async function addService(businessId: string, input: BusinessServiceFormValues): Promise<BusinessService> {
  const { data, error } = await supabaseAdmin()
    .from("business_services")
    .insert({
      business_id: businessId,
      name: input.name,
      description: input.description || null,
      price: input.price ?? null,
      price_unit: input.priceUnit || null,
    })
    .select("*")
    .single<{ id: string; name: string; description: string | null; price: number | string | null; price_unit: string | null; sort_order: number }>();
  if (error || !data) throw new Error(`Failed to add service: ${error?.message}`);
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    price: data.price === null ? null : Number(data.price),
    priceUnit: data.price_unit,
    sortOrder: data.sort_order,
  };
}

export async function deleteService(businessId: string, serviceId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("business_services").delete().eq("id", serviceId).eq("business_id", businessId);
  if (error) throw new Error(`Failed to delete service: ${error.message}`);
}

export async function addFaq(businessId: string, input: BusinessFaqFormValues): Promise<BusinessFaq> {
  const { data, error } = await supabaseAdmin()
    .from("business_faqs")
    .insert({ business_id: businessId, question: input.question, answer: input.answer })
    .select("*")
    .single<{ id: string; question: string; answer: string; sort_order: number }>();
  if (error || !data) throw new Error(`Failed to add FAQ: ${error?.message}`);
  return { id: data.id, question: data.question, answer: data.answer, sortOrder: data.sort_order };
}

export async function deleteFaq(businessId: string, faqId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("business_faqs").delete().eq("id", faqId).eq("business_id", businessId);
  if (error) throw new Error(`Failed to delete FAQ: ${error.message}`);
}

/** Public review submission — starts as "pending" (see the `reviews` table default) so it never shows up until an admin (or, future work, the business itself) approves it. */
export async function submitReview(businessId: string, input: ReviewFormValues): Promise<void> {
  const { error } = await supabaseAdmin().from("reviews").insert({
    business_id: businessId,
    reviewer_name: input.reviewerName,
    reviewer_email: input.reviewerEmail || null,
    rating: input.rating,
    comment: input.comment || null,
  });
  if (error) throw new Error(`Failed to submit review: ${error.message}`);
  await recalculateRating(businessId);
}

async function recalculateRating(businessId: string): Promise<void> {
  const { data } = await supabaseAdmin().from("reviews").select("rating").eq("business_id", businessId).eq("status", "approved");
  const ratings = (data as { rating: number }[] | null) ?? [];
  const count = ratings.length;
  const avg = count > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / count : 0;
  await supabaseAdmin()
    .from("business_profiles")
    .update({ rating_avg: Math.round(avg * 10) / 10, rating_count: count })
    .eq("id", businessId);
}

// --- Admin moderation (owner-only; gated by the caller) ---

export async function listListingsForAdmin(status?: ListingStatus): Promise<BusinessListing[]> {
  let query = supabaseAdmin().from("business_profiles").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load listings: ${error.message}`);
  return (data ?? []).map(mapListing);
}

export async function setListingStatus(listingId: string, status: ListingStatus): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("business_profiles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", listingId);
  if (error) throw new Error(`Failed to update listing status: ${error.message}`);
}

export async function setListingVerified(listingId: string, isVerified: boolean): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("business_profiles")
    .update({ is_verified: isVerified, updated_at: new Date().toISOString() })
    .eq("id", listingId);
  if (error) throw new Error(`Failed to update verification: ${error.message}`);
}

export async function setListingFeatured(listingId: string, isFeatured: boolean): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("business_profiles")
    .update({ is_featured: isFeatured, updated_at: new Date().toISOString() })
    .eq("id", listingId);
  if (error) throw new Error(`Failed to update featured flag: ${error.message}`);
}

export async function listReviewsForAdmin(status: Review["status"] = "pending"): Promise<(Review & { businessId: string; businessName: string })[]> {
  const { data, error } = await supabaseAdmin()
    .from("reviews")
    .select("*, business_profiles(display_name)")
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load reviews: ${error.message}`);
  return ((data as unknown as {
    id: string;
    business_id: string;
    reviewer_name: string;
    rating: number;
    comment: string | null;
    status: Review["status"];
    created_at: string;
    business_profiles: { display_name: string } | null;
  }[] | null) ?? []).map((r) => ({
    id: r.id,
    businessId: r.business_id,
    businessName: r.business_profiles?.display_name ?? "Unknown",
    reviewerName: r.reviewer_name,
    rating: r.rating,
    comment: r.comment,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function setReviewStatus(reviewId: string, businessId: string, status: Review["status"]): Promise<void> {
  const { error } = await supabaseAdmin().from("reviews").update({ status }).eq("id", reviewId);
  if (error) throw new Error(`Failed to update review: ${error.message}`);
  await recalculateRating(businessId);
}

/** Bulk CSV import for the admin — mirrors bulkImportInvitees's simple sequential-insert approach (services/admin-invitees.ts). */
export async function bulkImportListings(
  accountId: string,
  rows: { displayName: string; categorySlug?: string; citySlug?: string; description?: string; contactEmail?: string; contactPhone?: string }[],
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.displayName?.trim()) {
      skipped++;
      continue;
    }
    const category = row.categorySlug ? await getCategoryBySlug(row.categorySlug) : null;
    const city = row.citySlug
      ? (await supabaseAdmin().from("marketplace_cities").select("id").eq("slug", row.citySlug).maybeSingle<{ id: string }>()).data
      : null;

    const listing = await createListing(accountId, {
      displayName: row.displayName,
      profileType: "business",
      primaryCategoryId: category?.id ?? "",
      description: row.description || "",
      contactEmail: row.contactEmail || "",
      contactPhone: row.contactPhone || "",
      cityId: city?.id ?? "",
    } as ListingProfileFormValues);

    await supabaseAdmin().from("business_profiles").update({ status: "approved" }).eq("id", listing.id);
    created++;
  }
  return { created, skipped };
}
