import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCategoryById } from "@/services/marketplace-categories";
import type { MarketplaceCategory } from "@/types/marketplace";
import type { EventCategory } from "@/types/event";

/**
 * "AI Features" from the Marketplace spec — data-driven event-type ->
 * relevant-category mapping (birthday -> photographer/decorator/...,
 * corporate workshop -> conference hall/trainer/...), NOT a real ML
 * recommendation engine (that's explicitly "Future AI" in the spec).
 * Backed by event_category_suggestions so the owner can tune which
 * categories matter for which event type from the admin panel without
 * a code deploy — same philosophy as pricing_plan_settings.
 *
 * Deliberately NOT wired into the existing event dashboard or public
 * event pages yet — exposed only via the /discover hub's own "planning
 * a birthday?" picker for this first pass, per an explicit decision to
 * keep Discovery separate from the existing event workflow until it's
 * reviewed.
 */
export async function getSuggestedCategoriesForEventType(eventCategory: EventCategory | string): Promise<MarketplaceCategory[]> {
  const { data, error } = await supabaseAdmin()
    .from("event_category_suggestions")
    .select("category_id")
    .eq("event_category", eventCategory)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to load suggestions: ${error.message}`);

  const results: MarketplaceCategory[] = [];
  for (const row of (data as { category_id: string }[] | null) ?? []) {
    const category = await getCategoryById(row.category_id);
    if (category) results.push(category);
  }
  return results;
}

export async function setSuggestionsForEventType(eventCategory: string, categoryIds: string[]): Promise<void> {
  await supabaseAdmin().from("event_category_suggestions").delete().eq("event_category", eventCategory);
  if (categoryIds.length === 0) return;
  const rows = categoryIds.map((categoryId, index) => ({ event_category: eventCategory, category_id: categoryId, sort_order: index }));
  const { error } = await supabaseAdmin().from("event_category_suggestions").insert(rows);
  if (error) throw new Error(`Failed to save suggestions: ${error.message}`);
}

export async function listAllSuggestionMappings(): Promise<Record<string, MarketplaceCategory[]>> {
  const { data, error } = await supabaseAdmin()
    .from("event_category_suggestions")
    .select("event_category, category_id")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Failed to load suggestions: ${error.message}`);

  const byEvent: Record<string, MarketplaceCategory[]> = {};
  for (const row of (data as { event_category: string; category_id: string }[] | null) ?? []) {
    const category = await getCategoryById(row.category_id);
    if (!category) continue;
    if (!byEvent[row.event_category]) byEvent[row.event_category] = [];
    byEvent[row.event_category]!.push(category);
  }
  return byEvent;
}
