import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";
import type { Testimonial, TestimonialFormValues } from "@/types/testimonial";

interface TestimonialRow {
  id: string;
  name: string;
  role: string | null;
  rating: number;
  message: string;
  photo_storage_path: string | null;
  approved: boolean;
  featured: boolean;
  created_at: string;
}

function mapRow(row: TestimonialRow): Testimonial {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    rating: row.rating,
    message: row.message,
    photoUrl: row.photo_storage_path ? publicMediaUrl("gallery", row.photo_storage_path) : null,
    approved: row.approved,
    featured: row.featured,
    createdAt: row.created_at,
  };
}

/**
 * Approved testimonials for the homepage carousel
 * (features/testimonials/testimonials-section.tsx) — featured ones
 * first, then newest first. Submissions start unapproved (see
 * createTestimonial below) so nothing shows publicly until the owner
 * reviews it at /admin/testimonials.
 */
export async function getApprovedTestimonials(limit = 12): Promise<Testimonial[]> {
  const { data, error } = await supabaseAdmin()
    .from("testimonials")
    .select("*")
    .eq("approved", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getApprovedTestimonials failed:", error.message);
    return [];
  }
  return (data as TestimonialRow[]).map(mapRow);
}

/** Owner-only — every testimonial regardless of approval, newest first, for the /admin/testimonials moderation queue. */
export async function listAllTestimonials(): Promise<Testimonial[]> {
  const { data, error } = await supabaseAdmin()
    .from("testimonials")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list testimonials: ${error.message}`);
  return (data as TestimonialRow[]).map(mapRow);
}

/**
 * Public submission from /testimonials/share — always lands unapproved.
 * No event/invitee scoping since this is about the platform as a whole,
 * not any one host's event (same "platform-level, anyone can submit"
 * shape as features/contact's inquiry form).
 */
export async function createTestimonial(
  values: TestimonialFormValues,
  photoPath: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin().from("testimonials").insert({
    name: values.name,
    role: values.role || null,
    rating: values.rating,
    message: values.message,
    photo_storage_path: photoPath,
    approved: false,
    featured: false,
  });

  if (error) throw new Error(`Failed to save testimonial: ${error.message}`);
}

export async function setTestimonialApproved(id: string, approved: boolean): Promise<void> {
  const { error } = await supabaseAdmin().from("testimonials").update({ approved }).eq("id", id);
  if (error) throw new Error(`Failed to update testimonial: ${error.message}`);
}

export async function setTestimonialFeatured(id: string, featured: boolean): Promise<void> {
  const { error } = await supabaseAdmin().from("testimonials").update({ featured }).eq("id", id);
  if (error) throw new Error(`Failed to update testimonial: ${error.message}`);
}

export async function deleteTestimonial(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("testimonials").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete testimonial: ${error.message}`);
}
