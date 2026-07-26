import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  PaymentSettingsRecord,
  PaymentSubmissionRecord,
  PaymentSubmissionStatus,
} from "@/types/payment";

interface PaymentSettingsRow {
  qr_image_path: string | null;
  upi_id: string | null;
  bank_details: string | null;
  instructions: string | null;
  updated_at: string;
}

function mapSettings(row: PaymentSettingsRow): PaymentSettingsRecord {
  return {
    qrImagePath: row.qr_image_path,
    upiId: row.upi_id,
    bankDetails: row.bank_details,
    instructions: row.instructions,
    updatedAt: row.updated_at,
  };
}

/** Reads the one settings row, creating it on first access rather than requiring a manual seed. */
export async function getPaymentSettings(): Promise<PaymentSettingsRecord> {
  const client = supabaseAdmin();
  const { data, error } = await client
    .from("payment_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle<PaymentSettingsRow>();

  if (error) throw new Error(`Failed to load payment settings: ${error.message}`);
  if (data) return mapSettings(data);

  const { data: created, error: insertError } = await client
    .from("payment_settings")
    .insert({ id: true })
    .select("*")
    .single<PaymentSettingsRow>();

  if (insertError) throw new Error(`Failed to initialize payment settings: ${insertError.message}`);
  return mapSettings(created);
}

export async function updatePaymentSettings(input: {
  qrImagePath?: string | null;
  upiId?: string | null;
  bankDetails?: string | null;
  instructions?: string | null;
}): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.qrImagePath !== undefined) patch.qr_image_path = input.qrImagePath;
  if (input.upiId !== undefined) patch.upi_id = input.upiId;
  if (input.bankDetails !== undefined) patch.bank_details = input.bankDetails;
  if (input.instructions !== undefined) patch.instructions = input.instructions;

  // Ensure the row exists first (see getPaymentSettings) so this update
  // is never a silent no-op on a fresh database.
  await getPaymentSettings();

  const { error } = await supabaseAdmin().from("payment_settings").update(patch).eq("id", true);
  if (error) throw new Error(`Failed to update payment settings: ${error.message}`);
}

interface PaymentSubmissionRow {
  id: string;
  payer_name: string;
  payer_email: string | null;
  payer_phone: string | null;
  amount: string | number;
  purpose: string | null;
  reference_note: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

function mapSubmission(row: PaymentSubmissionRow): PaymentSubmissionRecord {
  return {
    id: row.id,
    payerName: row.payer_name,
    payerEmail: row.payer_email,
    payerPhone: row.payer_phone,
    amount: typeof row.amount === "string" ? parseFloat(row.amount) : row.amount,
    purpose: row.purpose,
    referenceNote: row.reference_note,
    status: row.status as PaymentSubmissionStatus,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

export async function createPaymentSubmission(input: {
  payerName: string;
  payerEmail?: string | null;
  payerPhone?: string | null;
  amount: number;
  purpose?: string | null;
  referenceNote?: string | null;
}): Promise<PaymentSubmissionRecord> {
  const { data, error } = await supabaseAdmin()
    .from("payment_submissions")
    .insert({
      payer_name: input.payerName,
      payer_email: input.payerEmail || null,
      payer_phone: input.payerPhone || null,
      amount: input.amount,
      purpose: input.purpose || null,
      reference_note: input.referenceNote || null,
    })
    .select("*")
    .single<PaymentSubmissionRow>();

  if (error) throw new Error(`Failed to submit payment: ${error.message}`);
  return mapSubmission(data);
}

export async function listPaymentSubmissions(
  status?: PaymentSubmissionStatus,
): Promise<PaymentSubmissionRecord[]> {
  let query = supabaseAdmin().from("payment_submissions").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query.returns<PaymentSubmissionRow[]>();
  if (error) throw new Error(`Failed to list payment submissions: ${error.message}`);
  return (data ?? []).map(mapSubmission);
}

export async function setPaymentSubmissionStatus(
  id: string,
  status: PaymentSubmissionStatus,
  adminNote?: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("payment_submissions")
    .update({ status, admin_note: adminNote ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Failed to update payment status: ${error.message}`);
}
