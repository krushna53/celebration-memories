"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  createCategoryAction,
  setCategoryActiveAction,
  deleteCategoryAction,
  createCityAction,
  deleteCityAction,
} from "@/features/admin/marketplace/actions";
import type { MarketplaceCategory, MarketplaceCity } from "@/types/marketplace";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CategoriesManager({
  initialCategories,
  initialCities,
}: {
  initialCategories: MarketplaceCategory[];
  initialCities: MarketplaceCity[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CategoriesSection initialCategories={initialCategories} />
      <CitiesSection initialCities={initialCities} />
    </div>
  );
}

function CategoriesSection({ initialCategories }: { initialCategories: MarketplaceCategory[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const topLevel = categories.filter((c) => !c.parentId);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createCategoryAction({ slug: slugify(name), name, parentId: parentId || null });
    setPending(false);
    if (!result.success) return setError(result.error);
    setCategories((c) => [...c, result.data]);
    setName("");
    setParentId("");
  }

  function toggleActive(cat: MarketplaceCategory) {
    const next = !cat.isActive;
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, isActive: next } : c)));
    startTransition(async () => {
      await setCategoryActiveAction(cat.id, next);
    });
  }

  function remove(cat: MarketplaceCategory) {
    if (!confirm(`Delete "${cat.name}"? This can't be undone.`)) return;
    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    startTransition(async () => {
      await deleteCategoryAction(cat.id);
    });
  }

  return (
    <div className="rounded-2xl border border-navy-950/10 bg-white p-5">
      <p className="font-display text-lg text-navy-950">Categories</p>
      <div className="mt-4 grid gap-2">
        {topLevel.map((top) => (
          <div key={top.id}>
            <CategoryRow category={top} onToggle={toggleActive} onDelete={remove} />
            <div className="ml-5 mt-1 grid gap-1 border-l border-navy-950/10 pl-3">
              {categories
                .filter((c) => c.parentId === top.id)
                .map((sub) => (
                  <CategoryRow key={sub.id} category={sub} onToggle={toggleActive} onDelete={remove} />
                ))}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="mt-5 grid gap-2 border-t border-navy-950/10 pt-5">
        <input required placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} />
        <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputClasses}>
          <option value="">Top-level category</option>
          {topLevel.map((top) => (
            <option key={top.id} value={top.id}>
              Subcategory of {top.name}
            </option>
          ))}
        </select>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <button
          disabled={pending || !name.trim()}
          className="flex items-center justify-center gap-1.5 rounded-full bg-navy-950 px-4 py-2 text-sm font-medium text-gold-300 hover:brightness-110 disabled:opacity-60 sm:justify-self-start"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Category
        </button>
      </form>
    </div>
  );
}

function CategoryRow({
  category,
  onToggle,
  onDelete,
}: {
  category: MarketplaceCategory;
  onToggle: (c: MarketplaceCategory) => void;
  onDelete: (c: MarketplaceCategory) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-navy-950/10 px-3 py-2">
      <span className={`text-sm ${category.isActive ? "text-navy-950" : "text-navy-700/40 line-through"}`}>{category.name}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggle(category)}
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
            category.isActive ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-navy-950/15 text-navy-700/60"
          }`}
        >
          {category.isActive ? "Active" : "Inactive"}
        </button>
        <button onClick={() => onDelete(category)} className="text-navy-700/40 hover:text-red-600">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function CitiesSection({ initialCities }: { initialCities: MarketplaceCity[] }) {
  const [cities, setCities] = useState(initialCities);
  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createCityAction({ slug: slugify(name), name, state });
    setPending(false);
    if (!result.success) return setError(result.error);
    setCities((c) => [...c, result.data]);
    setName("");
    setState("");
  }

  function remove(city: MarketplaceCity) {
    if (!confirm(`Delete "${city.name}"? This can't be undone.`)) return;
    setCities((prev) => prev.filter((c) => c.id !== city.id));
    startTransition(async () => {
      await deleteCityAction(city.id);
    });
  }

  return (
    <div className="rounded-2xl border border-navy-950/10 bg-white p-5">
      <p className="font-display text-lg text-navy-950">Cities</p>
      <div className="mt-4 grid gap-2">
        {cities.map((city) => (
          <div key={city.id} className="flex items-center justify-between gap-2 rounded-lg border border-navy-950/10 px-3 py-2">
            <span className="text-sm text-navy-950">
              {city.name}
              {city.state ? `, ${city.state}` : ""}
            </span>
            <button onClick={() => remove(city)} className="text-navy-700/40 hover:text-red-600">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {cities.length === 0 ? <p className="text-sm text-navy-700/60">No cities added yet.</p> : null}
      </div>

      <form onSubmit={handleAdd} className="mt-5 grid gap-2 border-t border-navy-950/10 pt-5">
        <input required placeholder="City name" value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} />
        <input placeholder="State (optional)" value={state} onChange={(e) => setState(e.target.value)} className={inputClasses} />
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <button
          disabled={pending || !name.trim()}
          className="flex items-center justify-center gap-1.5 rounded-full bg-navy-950 px-4 py-2 text-sm font-medium text-gold-300 hover:brightness-110 disabled:opacity-60 sm:justify-self-start"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add City
        </button>
      </form>
    </div>
  );
}
