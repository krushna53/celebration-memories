"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import {
  createTestimonial,
  setTestimonialApproved,
  setTestimonialFeatured,
  deleteTestimonial,
} from "@/services/testimonials";
import { createSignedTestimonialPhotoUpload, UploadValidationError } from "@/services/uploads";
import { testimonialFormSchema, type TestimonialFormValues } from "@/types/testimonial";

export type ActionResult<T = true> = { success: true; data: T } | { success: false; error: string };

/**
 * Step 1 of an optional testimonial photo: mints a signed Storage
 * upload URL the browser can PUT the file to directly, same two-step
 * shape as features/uploads/actions.ts's requestUploadUrl but without
 * an invitee token — anyone can submit a testimonial, same as the
 * Contact page.
 */
export async function requestTestimonialPhotoUploadAction(
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<ActionResult<{ bucket: string; path: string; token: string; signedUrl: string }>> {
  try {
    const upload = await createSignedTestimonialPhotoUpload({ fileName, contentType, fileSize });
    return { success: true, data: upload };
  } catch (err) {
    const message =
      err instanceof UploadValidationError ? err.message : "Could not prepare the upload. Please try again.";
    if (!(err instanceof UploadValidationError)) console.error("requestTestimonialPhotoUploadAction failed:", err);
    return { success: false, error: message };
  }
}

export type SubmitTestimonialResult = { success: true } | { success: false; error: string };

/** Public submission from /testimonials/share — see services/testimonials.ts's createTestimonial for why this always lands unapproved. */
export async function submitTestimonialAction(
  values: TestimonialFormValues,
  photoPath: string | null,
): Promise<SubmitTestimonialResult> {
  const parsed = testimonialFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Please check the form and try again." };
  }

  try {
    await createTestimonial(parsed.data, photoPath);
  } catch (err) {
    console.error("submitTestimonialAction failed:", err);
    return { success: false, error: "Something went wrong saving your story. Please try again." };
  }

  return { success: true };
}

export type AdminActionResult = { success: true } | { success: false; error: string };

/** Owner-only — approves/unapproves a testimonial for the public homepage carousel. */
export async function setTestimonialApprovedAction(id: string, approved: boolean): Promise<AdminActionResult> {
  try {
    await requireOwner();
    await setTestimonialApproved(id, approved);
    revalidatePath("/admin/testimonials");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update." };
  }
}

/** Owner-only — pins a testimonial to the front of the carousel. */
export async function setTestimonialFeaturedAction(id: string, featured: boolean): Promise<AdminActionResult> {
  try {
    await requireOwner();
    await setTestimonialFeatured(id, featured);
    revalidatePath("/admin/testimonials");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update." };
  }
}

/** Owner-only — permanently removes a testimonial (e.g. spam or a removal request). */
export async function deleteTestimonialAction(id: string): Promise<AdminActionResult> {
  try {
    await requireOwner();
    await deleteTestimonial(id);
    revalidatePath("/admin/testimonials");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete." };
  }
}
