import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/services/admin-auth";
import { reviewRequestSchema, validRequestTransition } from "@/types/privacy-request";

export async function requirePrivacyReviewer() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") throw new Error("Platform administrator required.");
  return admin;
}
export async function listPrivacyRequests(page = 0) {
  await requirePrivacyReviewer();
  const { data, error } = await supabaseAdmin().from("privacy_requests")
    .select("id,email,event_label,kind,details,status,verification,review_note,created_at,updated_at,privacy_request_history(id,status,note,verification,actor_id,recorded_at)")
    .order("created_at", { ascending: false }).range(page * 25, page * 25 + 24);
  if (error) throw new Error("Privacy requests could not be loaded.");
  return data ?? [];
}
export async function reviewPrivacyRequest(input: unknown) {
  const admin = await requirePrivacyReviewer();
  const value = reviewRequestSchema.parse(input);
  if (!validRequestTransition(value.expectedStatus, value.status)) throw new Error("Invalid status transition.");
  if (["in_progress", "completed"].includes(value.status) && value.verification.length < 10) throw new Error("Record how identity and authority were verified first.");
  const { error } = await supabaseAdmin().rpc("review_privacy_request", {
    p_id: value.id, p_expected: value.expectedStatus, p_status: value.status,
    p_note: value.note, p_verification: value.verification, p_actor: admin.id,
  });
  if (error) throw new Error("Unable to update request. Refresh and check the current status.");
}
