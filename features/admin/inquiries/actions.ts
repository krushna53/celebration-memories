"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import { markInquiryRead } from "@/services/inquiries";

export type AdminActionResult = { success: true } | { success: false; error: string };

// Inquiries is owner-only — re-check role here, independent of the
// page-level guard.
export async function markInquiryReadAction(id: string): Promise<AdminActionResult> {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    await markInquiryRead(id);
    revalidatePath("/admin/inquiries");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}
