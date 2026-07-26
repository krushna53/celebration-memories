"use server";

import { createInquiry } from "@/services/inquiries";
import { inquiryFormSchema, type InquiryFormValues } from "@/types/inquiry";

export type SubmitInquiryResult = { success: true } | { success: false; error: string };

export async function submitInquiryAction(values: InquiryFormValues): Promise<SubmitInquiryResult> {
  const parsed = inquiryFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Please check the form and try again." };
  }

  try {
    await createInquiry(parsed.data);
  } catch (err) {
    console.error("submitInquiryAction failed:", err);
    return { success: false, error: "Something went wrong sending your message. Please try again." };
  }

  return { success: true };
}
