"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp, hashIp } from "@/lib/ip-hash";
import { privacyRequestSchema } from "@/types/privacy-request";
import { reviewPrivacyRequest } from "@/services/privacy-requests";

export async function submitPrivacyRequestAction(input: unknown) {
  const parsed = privacyRequestSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Check your email, event and request details." };
  if (parsed.data.website) return { success: false as const, error: "Unable to submit this request. Please use the privacy contact." };
  try {
    const ip = getClientIp(await headers());
    if (ip === "unknown") throw new Error("Rate limit unavailable");
    const { data, error } = await supabaseAdmin().rpc("submit_privacy_request", {
      p_email: parsed.data.email, p_event: parsed.data.event, p_kind: parsed.data.kind,
      p_details: parsed.data.details, p_ip_hash: hashIp(ip),
    });
    if (error || typeof data !== "string") throw new Error("Request not saved");
    return { success: true as const, reference: data };
  } catch {
    return { success: false as const, error: "Unable to save your request or submission limit reached. Please use the privacy contact on this page." };
  }
}
export async function reviewPrivacyRequestAction(input: unknown) {
  try {
    await reviewPrivacyRequest(input);
    revalidatePath("/admin/privacy-requests");
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Unable to review request." };
  }
}
