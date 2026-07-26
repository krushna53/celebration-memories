import { z } from "zod";

export interface PaymentSettingsRecord {
  qrImagePath: string | null;
  upiId: string | null;
  bankDetails: string | null;
  instructions: string | null;
  updatedAt: string;
}

export type PaymentSubmissionStatus = "pending" | "confirmed" | "rejected";

export interface PaymentSubmissionRecord {
  id: string;
  payerName: string;
  payerEmail: string | null;
  payerPhone: string | null;
  amount: number;
  purpose: string | null;
  referenceNote: string | null;
  status: PaymentSubmissionStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export const paymentSubmissionFormSchema = z.object({
  payerName: z.string().trim().min(2, "Please enter your name.").max(120),
  payerEmail: z.string().trim().email("Please enter a valid email address.").max(160).optional().or(z.literal("")),
  payerPhone: z.string().trim().max(20).optional().or(z.literal("")),
  amount: z.coerce.number().positive("Enter the amount you sent."),
  purpose: z.string().trim().max(200).optional().or(z.literal("")),
  referenceNote: z.string().trim().max(200).optional().or(z.literal("")),
});

export type PaymentSubmissionFormValues = z.infer<typeof paymentSubmissionFormSchema>;
