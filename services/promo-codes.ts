import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface PromoCodeRecord {
  id: string;
  code: string;
  description: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  active: boolean;
  createdAt: string;
}

interface PromoCodeRow {
  id: string;
  code: string;
  description: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  active: boolean;
  created_at: string;
}

function mapRow(row: PromoCodeRow): PromoCodeRecord {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    maxRedemptions: row.max_redemptions,
    redemptionCount: row.redemption_count,
    active: row.active,
    createdAt: row.created_at,
  };
}

/** Owner-only listing for /admin/promo-codes. */
export async function listPromoCodes(): Promise<PromoCodeRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listPromoCodes failed:", error.message);
    return [];
  }
  return (data as PromoCodeRow[]).map(mapRow);
}

export async function createPromoCode(params: {
  code: string;
  description?: string | null;
  maxRedemptions?: number | null;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("promo_codes").insert({
    code: params.code.trim().toUpperCase(),
    description: params.description || null,
    max_redemptions: params.maxRedemptions ?? null,
  });
  if (error) throw new Error(`Failed to create promo code: ${error.message}`);
}

export async function setPromoCodeActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabaseAdmin().from("promo_codes").update({ active }).eq("id", id);
  if (error) throw new Error(`Failed to update promo code: ${error.message}`);
}

/**
 * Looks a code up without consuming it — used by the payment step to
 * show a friendly "not valid" message before attempting the atomic
 * redemption. Case-insensitive (codes are stored uppercased).
 */
export async function findActivePromoCode(code: string): Promise<PromoCodeRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("promo_codes")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle<PromoCodeRow>();

  if (error) {
    console.error("findActivePromoCode failed:", error.message);
    return null;
  }
  return data ? mapRow(data) : null;
}

/**
 * Atomically checks capacity and increments redemption_count in one
 * statement (see the redeem_promo_code Postgres function) so two
 * simultaneous redemptions of the last remaining slot can't both
 * succeed. Returns true only if the code was actually consumed.
 */
export async function redeemPromoCode(code: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("redeem_promo_code", {
    p_code: code.trim().toUpperCase(),
  });

  if (error) {
    console.error("redeemPromoCode failed:", error.message);
    return false;
  }
  return data === true;
}
