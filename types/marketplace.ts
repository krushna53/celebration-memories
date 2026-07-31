import { z } from "zod";

/**
 * Discovery & Marketplace module types. Mirrors the Marketplace
 * CLAUDE.md spec's "Listing Structure"/"Listing Types"/"Database
 * Design" sections — see services/marketplace-*.ts for the backing
 * queries. Deliberately generic (one `marketplace_categories` table
 * with a self-referencing parent_id for both top-level categories and
 * subcategories) so new categories never require a schema change, per
 * the spec's own "Core Principles".
 */

export type ProfileType =
  | "personal"
  | "business"
  | "venue"
  | "organization"
  | "community"
  | "celebrity"
  | "influencer"
  | "sponsor";

export type ListingStatus = "draft" | "pending" | "approved" | "rejected";

export interface MarketplaceCategory {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** A top-level category with its subcategories nested — the shape the Discover nav/hub renders from. */
export interface CategoryWithChildren extends MarketplaceCategory {
  children: MarketplaceCategory[];
}

export interface MarketplaceCity {
  id: string;
  slug: string;
  name: string;
  state: string | null;
  country: string;
}

export interface BusinessGalleryPhoto {
  id: string;
  storagePath: string;
  caption: string | null;
  sortOrder: number;
}

export interface BusinessService {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  priceUnit: string | null;
  sortOrder: number;
}

export interface BusinessFaq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface BusinessListing {
  id: string;
  accountId: string;
  slug: string;
  profileType: ProfileType;
  displayName: string;
  tagline: string | null;
  description: string | null;
  aiSummary: string | null;
  profileImagePath: string | null;
  coverImagePath: string | null;
  primaryCategoryId: string | null;
  cityId: string | null;
  address: string | null;
  citiesServed: string[];
  languages: string[];
  tags: string[];
  startingPrice: number | null;
  priceUnit: string | null;
  website: string | null;
  whatsappNumber: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  youtubeUrl: string | null;
  linkedinUrl: string | null;
  isVerified: boolean;
  isFeatured: boolean;
  instantBooking: boolean;
  status: ListingStatus;
  ratingAvg: number;
  ratingCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Listing + the extra bits a directory/detail page needs to render — categories it belongs to, city, gallery, etc. */
export interface BusinessListingWithRelations extends BusinessListing {
  categories: MarketplaceCategory[];
  city: MarketplaceCity | null;
  gallery: BusinessGalleryPhoto[];
  services: BusinessService[];
  faqs: BusinessFaq[];
  reviews: Review[];
}

/** Trimmed shape for directory/search result cards — avoids shipping every field to a listing grid. */
export interface BusinessListingSummary {
  id: string;
  slug: string;
  displayName: string;
  tagline: string | null;
  profileImagePath: string | null;
  cityName: string | null;
  startingPrice: number | null;
  priceUnit: string | null;
  isVerified: boolean;
  isFeatured: boolean;
  ratingAvg: number;
  ratingCount: number;
}

export interface ListingSearchFilters {
  categorySlug?: string;
  citySlug?: string;
  budgetMax?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  featuredOnly?: boolean;
  languages?: string[];
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface ListingSearchResult {
  listings: BusinessListingSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export const businessSignupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  email: z.string().trim().email("Please enter a valid email."),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});
export type BusinessSignupValues = z.infer<typeof businessSignupSchema>;

export const listingProfileFormSchema = z.object({
  displayName: z.string().trim().min(1, "Please add a name.").max(150),
  profileType: z.enum([
    "personal",
    "business",
    "venue",
    "organization",
    "community",
    "celebrity",
    "influencer",
    "sponsor",
  ]),
  tagline: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  primaryCategoryId: z.string().trim().min(1, "Please pick a category."),
  cityId: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  citiesServed: z.array(z.string().trim().max(80)).max(30).optional(),
  languages: z.array(z.string().trim().max(40)).max(20).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  startingPrice: z.coerce.number().min(0).optional(),
  priceUnit: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  whatsappNumber: z.string().trim().max(20).optional().or(z.literal("")),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  contactPhone: z.string().trim().max(20).optional().or(z.literal("")),
  instagramUrl: z.string().trim().max(300).optional().or(z.literal("")),
  facebookUrl: z.string().trim().max(300).optional().or(z.literal("")),
  youtubeUrl: z.string().trim().max(300).optional().or(z.literal("")),
  linkedinUrl: z.string().trim().max(300).optional().or(z.literal("")),
});
export type ListingProfileFormValues = z.infer<typeof listingProfileFormSchema>;

export const businessServiceFormSchema = z.object({
  name: z.string().trim().min(1, "Please add a name.").max(150),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  price: z.coerce.number().min(0).optional(),
  priceUnit: z.string().trim().max(40).optional().or(z.literal("")),
});
export type BusinessServiceFormValues = z.infer<typeof businessServiceFormSchema>;

export const businessFaqFormSchema = z.object({
  question: z.string().trim().min(1, "Please add a question.").max(300),
  answer: z.string().trim().min(1, "Please add an answer.").max(2000),
});
export type BusinessFaqFormValues = z.infer<typeof businessFaqFormSchema>;

export const reviewFormSchema = z.object({
  reviewerName: z.string().trim().min(1, "Please add your name.").max(120),
  reviewerEmail: z.string().trim().email().optional().or(z.literal("")),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

export const businessLeadFormSchema = z.object({
  name: z.string().trim().min(1, "Please add your name.").max(120),
  email: z.string().trim().email("Please enter a valid email."),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  message: z.string().trim().min(1, "Please add a short message.").max(2000),
});
export type BusinessLeadFormValues = z.infer<typeof businessLeadFormSchema>;

export interface BusinessLead {
  id: string;
  businessId: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "new" | "contacted" | "closed";
  source: string | null;
  createdAt: string;
}

export interface CategorySuggestion {
  category: MarketplaceCategory;
}
