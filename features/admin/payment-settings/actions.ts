"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import { updatePaymentSettings } from "@/services/payments";
import { createSignedPaymentQrUpload } from "@/services/uploads";

export type PaymentSettingsActionResult = { success: true } | { success: false; error: string };

export async function requestPaymentQrUploadUrlAction(
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    const upload = await createSignedPaymentQrUpload({ fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function updatePaymentSettingsAction(input: {
  qrImagePath?: string | null;
  upiId?: string | null;
  bankDetails?: string | null;
  instructions?: string | null;
}): Promise<PaymentSettingsActionResult> {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    await updatePaymentSettings(input);
    revalidatePath("/admin/payment-settings");
    revalidatePath("/pay");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}
