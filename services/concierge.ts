/**
 * Concierge inquiry service — stores phone numbers from the site-wide
 * "Need help?" banner so the owner can follow up via WhatsApp.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface ConciergeInquiry {
  id: string;
  phone: string;
  country_code: string;
  page_url: string | null;
  status: "new" | "contacted" | "closed";
  notes: string | null;
  created_at: string;
}

export async function submitConciergeInquiry(params: {
  phone: string;
  countryCode: string;
  pageUrl?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const phone = params.phone.replace(/\D/g, "").trim();
  if (!phone || phone.length < 7) {
    return { success: false, error: "Please enter a valid phone number." };
  }

  const { error } = await supabaseAdmin()
    .from("concierge_inquiries")
    .insert({
      phone,
      country_code: params.countryCode,
      page_url: params.pageUrl ?? null,
      status: "new",
    });

  if (error) return { success: false, error: "Could not save your number. Please try again." };
  return { success: true };
}

export async function listConciergeInquiries(): Promise<ConciergeInquiry[]> {
  const { data, error } = await supabaseAdmin()
    .from("concierge_inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ConciergeInquiry[];
}

export async function updateConciergeInquiryStatus(
  id: string,
  status: ConciergeInquiry["status"],
  notes?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (notes !== undefined) patch.notes = notes;
  const { error } = await supabaseAdmin()
    .from("concierge_inquiries")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
