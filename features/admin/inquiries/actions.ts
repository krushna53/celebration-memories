"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/services/admin-auth";
import { markInquiryRead } from "@/services/inquiries";

export type AdminActionResult = { success: true } | { success: false; error: string };

export async function markInquiryReadAction(id: string): Promise<AdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    await markInquiryRead(id);
    revalidatePath("/admin/inquiries");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}
