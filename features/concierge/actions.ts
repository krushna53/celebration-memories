"use server";

import { revalidatePath } from "next/cache";

import {
  submitConciergeInquiry,
  updateConciergeInquiryStatus,
  type ConciergeInquiry,
} from "@/services/concierge";

export async function submitConciergeInquiryAction(
  phone: string,
  countryCode: string,
  pageUrl?: string,
) {
  return submitConciergeInquiry({ phone, countryCode, pageUrl });
}

export async function updateConciergeStatusAction(
  id: string,
  status: ConciergeInquiry["status"],
  notes?: string,
) {
  await updateConciergeInquiryStatus(id, status, notes);
  revalidatePath("/admin/concierge-inquiries");
}
