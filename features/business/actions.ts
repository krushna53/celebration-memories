"use server";

import { revalidatePath } from "next/cache";

import { createBusinessAccount, requireBusinessAccount, updateBusinessAccount } from "@/services/business-auth";
import {
  createListing,
  updateListingProfile,
  setListingImages,
  submitListingForReview,
  listListingsForAccount,
  getOwnListingBySlug,
  addGalleryPhoto,
  deleteGalleryPhoto,
  addService,
  deleteService,
  addFaq,
  deleteFaq,
  assertOwnsListing,
} from "@/services/marketplace-listings";
import { createSignedBusinessImageUpload } from "@/services/uploads";
import { createLead } from "@/services/business-leads";
import { listLeadsForBusiness, setLeadStatus } from "@/services/business-leads";
import { submitReview } from "@/services/marketplace-listings";
import { generateBusinessSummary } from "@/lib/ai-business-summary";
import { getCategoryById } from "@/services/marketplace-categories";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  businessSignupSchema,
  listingProfileFormSchema,
  businessServiceFormSchema,
  businessFaqFormSchema,
  businessLeadFormSchema,
  reviewFormSchema,
  type BusinessListing,
  type BusinessGalleryPhoto,
  type BusinessService,
  type BusinessFaq,
  type BusinessLead,
} from "@/types/marketplace";

export type BizActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

/** Called right after a successful supabaseBrowser().auth.signUp() on the client — see features/business/signup-form.tsx. */
export async function completeBusinessSignupAction(
  userId: string,
  values: unknown,
): Promise<BizActionResult<undefined>> {
  try {
    const parsed = businessSignupSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "Please check the form and try again." };
    await createBusinessAccount(userId, parsed.data.email, parsed.data.name, parsed.data.phone || undefined);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create your account." };
  }
}

export async function updateBusinessAccountAction(values: {
  name?: string;
  phone?: string;
}): Promise<BizActionResult<undefined>> {
  try {
    const account = await requireBusinessAccount();
    await updateBusinessAccount(account.id, values);
    revalidatePath("/business/dashboard");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update account." };
  }
}

export async function createListingAction(values: unknown): Promise<BizActionResult<BusinessListing>> {
  try {
    const account = await requireBusinessAccount();
    const parsed = listingProfileFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
    }
    const listing = await createListing(account.id, parsed.data);
    revalidatePath("/business/dashboard");
    return { success: true, data: listing };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create your listing." };
  }
}

export async function updateListingProfileAction(listingId: string, values: unknown): Promise<BizActionResult<undefined>> {
  try {
    const account = await requireBusinessAccount();
    const parsed = listingProfileFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
    }
    await updateListingProfile(listingId, account.id, parsed.data);
    revalidatePath("/business/dashboard");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update your listing." };
  }
}

export async function submitListingForReviewAction(listingId: string): Promise<BizActionResult<undefined>> {
  try {
    const account = await requireBusinessAccount();
    await submitListingForReview(listingId, account.id);
    revalidatePath("/business/dashboard");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to submit your listing." };
  }
}

export async function listMyListingsAction(): Promise<BizActionResult<BusinessListing[]>> {
  try {
    const account = await requireBusinessAccount();
    const listings = await listListingsForAccount(account.id);
    return { success: true, data: listings };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load your listings." };
  }
}

export async function getMyListingBySlugAction(slug: string) {
  try {
    const account = await requireBusinessAccount();
    const listing = await getOwnListingBySlug(slug, account.id);
    if (!listing) return { success: false as const, error: "Listing not found." };
    return { success: true as const, data: listing };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed to load your listing." };
  }
}

export async function setListingImageAction(
  listingId: string,
  input: { profileImagePath?: string; coverImagePath?: string },
): Promise<BizActionResult<undefined>> {
  try {
    const account = await requireBusinessAccount();
    await setListingImages(listingId, account.id, input);
    revalidatePath("/business/dashboard");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update your image." };
  }
}

export async function requestBusinessImageUploadAction(
  listingId: string,
  input: { fileName: string; contentType: string; fileSize: number },
): Promise<BizActionResult<{ bucket: string; path: string; token: string; signedUrl: string }>> {
  try {
    const account = await requireBusinessAccount();
    await assertOwnsListing(listingId, account.id);
    const result = await createSignedBusinessImageUpload({ businessId: listingId, ...input });
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to prepare upload." };
  }
}

export async function addGalleryPhotoAction(listingId: string, storagePath: string, caption?: string): Promise<BizActionResult<BusinessGalleryPhoto>> {
  try {
    const account = await requireBusinessAccount();
    await assertOwnsListing(listingId, account.id);
    const photo = await addGalleryPhoto(listingId, storagePath, caption);
    revalidatePath("/business/dashboard");
    return { success: true, data: photo };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add photo." };
  }
}

export async function deleteGalleryPhotoAction(listingId: string, photoId: string): Promise<BizActionResult<undefined>> {
  try {
    const account = await requireBusinessAccount();
    await assertOwnsListing(listingId, account.id);
    await deleteGalleryPhoto(listingId, photoId);
    revalidatePath("/business/dashboard");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete photo." };
  }
}

export async function addServiceAction(listingId: string, values: unknown): Promise<BizActionResult<BusinessService>> {
  try {
    const account = await requireBusinessAccount();
    await assertOwnsListing(listingId, account.id);
    const parsed = businessServiceFormSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "Please check the form and try again." };
    const service = await addService(listingId, parsed.data);
    revalidatePath("/business/dashboard");
    return { success: true, data: service };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add service." };
  }
}

export async function deleteServiceAction(listingId: string, serviceId: string): Promise<BizActionResult<undefined>> {
  try {
    const account = await requireBusinessAccount();
    await assertOwnsListing(listingId, account.id);
    await deleteService(listingId, serviceId);
    revalidatePath("/business/dashboard");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete service." };
  }
}

export async function addFaqAction(listingId: string, values: unknown): Promise<BizActionResult<BusinessFaq>> {
  try {
    const account = await requireBusinessAccount();
    await assertOwnsListing(listingId, account.id);
    const parsed = businessFaqFormSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "Please check the form and try again." };
    const faq = await addFaq(listingId, parsed.data);
    revalidatePath("/business/dashboard");
    return { success: true, data: faq };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add FAQ." };
  }
}

export async function deleteFaqAction(listingId: string, faqId: string): Promise<BizActionResult<undefined>> {
  try {
    const account = await requireBusinessAccount();
    await assertOwnsListing(listingId, account.id);
    await deleteFaq(listingId, faqId);
    revalidatePath("/business/dashboard");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete FAQ." };
  }
}

/** Owner-triggered from the dashboard — reads the listing's own current fields rather than trusting client-supplied text. */
export async function generateAiSummaryAction(listingId: string): Promise<BizActionResult<string>> {
  try {
    const account = await requireBusinessAccount();
    const { data: row, error } = await supabaseAdmin()
      .from("business_profiles")
      .select("display_name, tagline, description, primary_category_id, cities_served, account_id")
      .eq("id", listingId)
      .single<{
        display_name: string;
        tagline: string | null;
        description: string | null;
        primary_category_id: string | null;
        cities_served: string[];
        account_id: string;
      }>();
    if (error || !row || row.account_id !== account.id) return { success: false, error: "Listing not found." };

    const category = row.primary_category_id ? await getCategoryById(row.primary_category_id) : null;
    const summary = await generateBusinessSummary({
      displayName: row.display_name,
      categoryName: category?.name ?? "event vendor",
      tagline: row.tagline ?? undefined,
      description: row.description ?? undefined,
      citiesServed: row.cities_served,
    });

    await supabaseAdmin().from("business_profiles").update({ ai_summary: summary }).eq("id", listingId);
    revalidatePath("/business/dashboard");
    return { success: true, data: summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to generate a summary." };
  }
}

export async function listLeadsForListingAction(listingId: string): Promise<BizActionResult<BusinessLead[]>> {
  try {
    const account = await requireBusinessAccount();
    await assertOwnsListing(listingId, account.id);
    const leads = await listLeadsForBusiness(listingId);
    return { success: true, data: leads };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load leads." };
  }
}

export async function setLeadStatusAction(
  listingId: string,
  leadId: string,
  status: BusinessLead["status"],
): Promise<BizActionResult<undefined>> {
  try {
    const account = await requireBusinessAccount();
    await assertOwnsListing(listingId, account.id);
    await setLeadStatus(leadId, listingId, status);
    revalidatePath("/business/dashboard");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update lead." };
  }
}

// --- Public actions (no business account required — a guest contacting a vendor, or leaving a review) ---

export async function submitLeadAction(businessId: string, values: unknown): Promise<BizActionResult<undefined>> {
  try {
    const parsed = businessLeadFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
    }
    await createLead(businessId, parsed.data);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send your message." };
  }
}

export async function submitReviewAction(businessId: string, values: unknown): Promise<BizActionResult<undefined>> {
  try {
    const parsed = reviewFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
    }
    await submitReview(businessId, parsed.data);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to submit your review." };
  }
}
