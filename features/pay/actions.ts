"use server";

import { createPaymentSubmission } from "@/services/payments";
import { sendPaymentSubmissionNotification } from "@/lib/email";
import { paymentSubmissionFormSchema, type PaymentSubmissionFormValues } from "@/types/payment";

export type SubmitPaymentResult = { success: true } | { success: false; error: string };

export async function submitPaymentAction(
  values: PaymentSubmissionFormValues,
): Promise<SubmitPaymentResult> {
  const parsed = paymentSubmissionFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Please check the form and try again." };
  }

  try {
    await createPaymentSubmission({
      payerName: parsed.data.payerName,
      payerEmail: parsed.data.payerEmail || null,
      payerPhone: parsed.data.payerPhone || null,
      amount: parsed.data.amount,
      purpose: parsed.data.purpose || null,
      referenceNote: parsed.data.referenceNote || null,
    });
  } catch (err) {
    console.error("submitPaymentAction failed:", err);
    return { success: false, error: "Could not save your confirmation. Please try again." };
  }

  // Best-effort receipt notification to the admin — the submission is
  // already saved above regardless of whether this succeeds (sendEmail
  // itself never throws; see lib/email.ts).
  await sendPaymentSubmissionNotification({
    payerName: parsed.data.payerName,
    payerEmail: parsed.data.payerEmail || null,
    payerPhone: parsed.data.payerPhone || null,
    amount: parsed.data.amount,
    purpose: parsed.data.purpose || null,
    referenceNote: parsed.data.referenceNote || null,
  });

  return { success: true };
}
