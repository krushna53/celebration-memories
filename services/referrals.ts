import "server-only";
import { randomBytes } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface ReferralConversion {
  id: string;
  note: string;
  rewardAmount: number | null;
  payoutStatus: "pending" | "paid";
  createdAt: string;
}

/** An event whose draft was created while the visitor's browser carried this code's cookie — see middleware.ts and services/event-drafts.ts's createDraftEvent. Automatic; not the same as a manually-logged conversion below (which still requires the owner to decide on and log an actual reward). */
export interface AttributedSignup {
  eventId: string;
  slug: string;
  honoreeName: string;
  eventTitle: string;
  status: string;
  createdAt: string;
}

export interface ReferralCode {
  id: string;
  code: string;
  label: string;
  whatsapp: string | null;
  visitCount: number;
  createdAt: string;
  conversions: ReferralConversion[];
  attributedSignups: AttributedSignup[];
}

function randomCode(): string {
  return randomBytes(4).toString("hex"); // 8 chars, URL-safe
}

export async function listReferralCodes(): Promise<ReferralCode[]> {
  const client = supabaseAdmin();

  const { data: codes, error } = await client
    .from("referral_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list referral codes: ${error.message}`);

  const { data: conversions, error: convError } = await client
    .from("referral_conversions")
    .select("*")
    .order("created_at", { ascending: false });
  if (convError) throw new Error(`Failed to list conversions: ${convError.message}`);

  const { data: attributedEvents, error: eventsError } = await client
    .from("events")
    .select("id, slug, honoree_name, event_title, status, created_at, referred_by_code")
    .not("referred_by_code", "is", null)
    .order("created_at", { ascending: false });
  if (eventsError) throw new Error(`Failed to list attributed signups: ${eventsError.message}`);

  return (codes ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    whatsapp: row.whatsapp,
    visitCount: row.visit_count,
    createdAt: row.created_at,
    conversions: (conversions ?? [])
      .filter((c) => c.referral_code_id === row.id)
      .map((c) => ({
        id: c.id,
        note: c.note,
        rewardAmount: c.reward_amount !== null ? Number(c.reward_amount) : null,
        payoutStatus: c.payout_status,
        createdAt: c.created_at,
      })),
    attributedSignups: (attributedEvents ?? [])
      .filter((e) => e.referred_by_code === row.code)
      .map((e) => ({
        eventId: e.id,
        slug: e.slug,
        honoreeName: e.honoree_name,
        eventTitle: e.event_title,
        status: e.status,
        createdAt: e.created_at,
      })),
  }));
}

export async function createReferralCode(input: {
  label: string;
  whatsapp?: string | null;
}): Promise<ReferralCode> {
  const code = randomCode();
  const { data, error } = await supabaseAdmin()
    .from("referral_codes")
    .insert({ code, label: input.label, whatsapp: input.whatsapp || null })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create referral code: ${error.message}`);
  return {
    id: data.id,
    code: data.code,
    label: data.label,
    whatsapp: data.whatsapp,
    visitCount: data.visit_count,
    createdAt: data.created_at,
    conversions: [],
    attributedSignups: [],
  };
}

/**
 * Best-effort visit counter — called from public pages when a `?ref=`
 * query param is present. Silently no-ops on an unknown code (don't let
 * a mistyped/expired referral code break the page for a real visitor).
 */
export async function logReferralVisit(code: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin()
      .from("referral_codes")
      .select("id, visit_count")
      .eq("code", code)
      .maybeSingle();

    if (!data) return;

    await supabaseAdmin()
      .from("referral_codes")
      .update({ visit_count: data.visit_count + 1 })
      .eq("id", data.id);
  } catch (err) {
    console.error("logReferralVisit failed:", err);
  }
}

export async function addReferralConversion(input: {
  referralCodeId: string;
  note: string;
  rewardAmount: number | null;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("referral_conversions").insert({
    referral_code_id: input.referralCodeId,
    note: input.note,
    reward_amount: input.rewardAmount,
  });
  if (error) throw new Error(`Failed to log conversion: ${error.message}`);
}

export async function setConversionPayoutStatus(
  conversionId: string,
  status: "pending" | "paid",
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("referral_conversions")
    .update({ payout_status: status })
    .eq("id", conversionId);
  if (error) throw new Error(`Failed to update payout status: ${error.message}`);
}
