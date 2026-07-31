import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MarketplaceCategory, CategoryWithChildren, MarketplaceCity } from "@/types/marketplace";

/**
 * Categories/cities are the generic backbone of the whole Marketplace
 * module — one self-referencing table (`parent_id`) covers both
 * top-level categories (Photography) and subcategories (Wedding
 * Photographer), so adding a new category or subcategory later is a
 * data change, never a schema change. See supabase migration
 * add_marketplace_module.
 */

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

interface CityRow {
  id: string;
  slug: string;
  name: string;
  state: string | null;
  country: string;
}

function mapCategory(row: CategoryRow): MarketplaceCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    parentId: row.parent_id,
    description: row.description,
    icon: row.icon,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

function mapCity(row: CityRow): MarketplaceCity {
  return { id: row.id, slug: row.slug, name: row.name, state: row.state, country: row.country };
}

/** Every active category, top-level and sub, ordered for stable display. Callers that need the tree shape should use listCategoryTree() instead. */
export async function listAllCategories(): Promise<MarketplaceCategory[]> {
  const { data, error } = await supabaseAdmin()
    .from("marketplace_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return (data ?? []).map(mapCategory);
}

/** Top-level categories with their subcategories nested — what the Discover nav/hub renders. Only returns top-level categories that have at least one active subcategory or are themselves bookable (i.e. every top-level row currently seeded), so an empty aspirational category never shows up with nothing under it. */
export async function listCategoryTree(): Promise<CategoryWithChildren[]> {
  const all = await listAllCategories();
  const topLevel = all.filter((c) => c.parentId === null);
  const byParent = new Map<string, MarketplaceCategory[]>();
  for (const c of all) {
    if (!c.parentId) continue;
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  return topLevel.map((top) => ({ ...top, children: byParent.get(top.id) ?? [] }));
}

export async function getCategoryBySlug(slug: string): Promise<MarketplaceCategory | null> {
  const { data, error } = await supabaseAdmin()
    .from("marketplace_categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle<CategoryRow>();
  if (error) throw new Error(`Failed to load category: ${error.message}`);
  return data ? mapCategory(data) : null;
}

export async function getCategoryById(id: string): Promise<MarketplaceCategory | null> {
  const { data, error } = await supabaseAdmin()
    .from("marketplace_categories")
    .select("*")
    .eq("id", id)
    .maybeSingle<CategoryRow>();
  if (error) throw new Error(`Failed to load category: ${error.message}`);
  return data ? mapCategory(data) : null;
}

export async function listAllCities(): Promise<MarketplaceCity[]> {
  const { data, error } = await supabaseAdmin().from("marketplace_cities").select("*").order("name", { ascending: true });
  if (error) throw new Error(`Failed to load cities: ${error.message}`);
  return (data ?? []).map(mapCity);
}

export async function getCityBySlug(slug: string): Promise<MarketplaceCity | null> {
  const { data, error } = await supabaseAdmin()
    .from("marketplace_cities")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<CityRow>();
  if (error) throw new Error(`Failed to load city: ${error.message}`);
  return data ? mapCity(data) : null;
}

// --- Admin management (owner-only; gated by the caller, see features/admin/marketplace/actions.ts) ---

export async function createCategory(input: {
  slug: string;
  name: string;
  parentId: string | null;
  description?: string;
  icon?: string;
  sortOrder?: number;
}): Promise<MarketplaceCategory> {
  const { data, error } = await supabaseAdmin()
    .from("marketplace_categories")
    .insert({
      slug: input.slug,
      name: input.name,
      parent_id: input.parentId,
      description: input.description || null,
      icon: input.icon || null,
      sort_order: input.sortOrder ?? 0,
    })
    .select("*")
    .single<CategoryRow>();
  if (error || !data) throw new Error(`Failed to create category: ${error?.message}`);
  return mapCategory(data);
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("marketplace_categories")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Failed to update category: ${error.message}`);
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("marketplace_categories").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete category: ${error.message}`);
}

export async function createCity(input: { slug: string; name: string; state?: string; country?: string }): Promise<MarketplaceCity> {
  const { data, error } = await supabaseAdmin()
    .from("marketplace_cities")
    .insert({ slug: input.slug, name: input.name, state: input.state || null, country: input.country || "India" })
    .select("*")
    .single<CityRow>();
  if (error || !data) throw new Error(`Failed to create city: ${error?.message}`);
  return mapCity(data);
}

export async function deleteCity(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("marketplace_cities").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete city: ${error.message}`);
}
