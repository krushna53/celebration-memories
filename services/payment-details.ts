import "server-only";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";

/**
 * Per-event payment details (events.payment_details_text /
 * payment_details_image_path, migration 20261014120000_payment_details.sql):
 * free text (packages, bank details — emojis and line breaks kept) and/or an
 * image (a UPI QR code, a bank-details screenshot). Shown in the "Payment
 * Details" homepage section; edited in Event Settings. Reads degrade to
 * null on any error so a page never breaks over them.
 */
export interface PaymentDetails {
  text: string | null;
  imagePath: string | null;
  imageUrl: string | null;
}

export const PAYMENT_TEXT_MAX = 4000;
const BUCKET = "gallery";
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const IMAGE_MAX_BYTES = 15 * 1024 * 1024;

export async function getPaymentDetails(eventId: string): Promise<PaymentDetails | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .select("payment_details_text, payment_details_image_path")
      .eq("id", eventId)
      .maybeSingle<{ payment_details_text: string | null; payment_details_image_path: string | null }>();
    if (error || !data) return null;
    const text = data.payment_details_text?.trim() || null;
    const imagePath = data.payment_details_image_path || null;
    if (!text && !imagePath) return null;
    return { text, imagePath, imageUrl: imagePath ? publicMediaUrl(BUCKET, imagePath) : null };
  } catch {
    return null;
  }
}

export async function savePaymentDetailsText(eventId: string, text: string): Promise<string | null> {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length > PAYMENT_TEXT_MAX) throw new Error(`Keep it under ${PAYMENT_TEXT_MAX} characters.`);
  const value = clean || null;
  const { error } = await supabaseAdmin().from("events").update({ payment_details_text: value }).eq("id", eventId);
  if (error) throw new Error(error.message);
  return value;
}

export async function createPaymentImageUpload(eventId: string, contentType: string, fileSize: number): Promise<{ path: string; signedUrl: string }> {
  const ext = IMAGE_TYPES[contentType];
  if (!ext) throw new Error("Use a JPG, PNG or WebP image.");
  if (fileSize > IMAGE_MAX_BYTES) throw new Error("That image is too large (max 15 MB).");
  const path = `${eventId}/payment/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error("Couldn't start the upload — please try again.");
  return { path, signedUrl: data.signedUrl };
}

async function currentImagePath(eventId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("events").select("payment_details_image_path").eq("id", eventId).maybeSingle<{ payment_details_image_path: string | null }>();
  return data?.payment_details_image_path ?? null;
}

/** Points the event at an uploaded image (must be in its own payment folder and actually exist), or clears it with null. */
export async function setPaymentImage(eventId: string, path: string | null): Promise<string | null> {
  const client = supabaseAdmin();
  if (path !== null) {
    const folder = `${eventId}/payment/`;
    if (!path.startsWith(folder) || path.includes("..") || path.slice(folder.length).includes("/")) {
      throw new Error("That upload doesn't belong to this event.");
    }
    const { data: listed, error: listError } = await client.storage.from(BUCKET).list(`${eventId}/payment`, { search: path.slice(folder.length) });
    if (listError || !listed?.some((f) => `${folder}${f.name}` === path)) throw new Error("The upload didn't finish — please try again.");
  }
  const previous = await currentImagePath(eventId);
  const { error } = await client.from("events").update({ payment_details_image_path: path }).eq("id", eventId);
  if (error) throw new Error(error.message);
  if (previous && previous !== path) await client.storage.from(BUCKET).remove([previous]);
  return path ? publicMediaUrl(BUCKET, path) : null;
}
