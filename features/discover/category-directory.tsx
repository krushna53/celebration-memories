import Link from "next/link";

import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { ListingCard } from "@/features/discover/listing-card";
import { ListYourBusinessCard } from "@/features/discover/list-your-business-card";
import { getCategoryBySlug, listAllCategories, listAllCities } from "@/services/marketplace-categories";
import { searchListings } from "@/services/marketplace-listings";
import type { ListingSearchFilters } from "@/types/marketplace";

/**
 * Shared directory/search UI for all three SEO route levels
 * (/[category], /[category]/[city], /[category]/[city]/[subcategory]) —
 * one component, three thin page.tsx callers, per the module spec's
 * "reusable components" principle. Filters are plain GET query params
 * (budget, verified, featured, page) so the whole page stays a Server
 * Component — no client JS needed for filtering/pagination, and every
 * filtered view is itself a shareable, crawlable URL.
 */
export async function CategoryDirectory({
  categorySlug,
  citySlug,
  subcategorySlug,
  searchParams,
}: {
  categorySlug: string;
  citySlug?: string;
  subcategorySlug?: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const activeCategorySlug = subcategorySlug ?? categorySlug;
  const category = await getCategoryBySlug(activeCategorySlug);

  if (!category) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-32 text-center sm:px-6">
        <p className="font-display text-2xl text-navy-950">Category not found</p>
        <p className="mt-2 text-sm text-navy-700/70">
          <Link href="/discover" className="text-gold-600 underline underline-offset-2">
            Browse everything on Discover
          </Link>
        </p>
      </div>
    );
  }

  const [allCategories, allCities] = await Promise.all([listAllCategories(), listAllCities()]);
  const topLevel = category.parentId ? allCategories.find((c) => c.id === category.parentId) : category;
  const siblings = allCategories.filter((c) => c.parentId === topLevel?.id);

  const page = Number(searchParams.page) || 1;
  const budgetMax = searchParams.budget ? Number(searchParams.budget) : undefined;
  const verifiedOnly = searchParams.verified === "1";
  const featuredOnly = searchParams.featured === "1";

  const filters: ListingSearchFilters = {
    categorySlug: activeCategorySlug,
    citySlug,
    budgetMax,
    verifiedOnly,
    featuredOnly,
    page,
    pageSize: 12,
  };

  const results = await searchListings(filters);
  const totalPages = Math.max(1, Math.ceil(results.total / results.pageSize));

  function buildHref(overrides: Record<string, string | undefined>): string {
    const base = citySlug ? `/${categorySlug}/${citySlug}${subcategorySlug ? `/${subcategorySlug}` : ""}` : `/${categorySlug}`;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...searchParams, ...overrides })) {
      if (typeof value === "string" && value) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  return (
    <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-navy-700/50">
          <Link href="/discover" className="hover:text-gold-600">
            Discover
          </Link>
          <span>/</span>
          {topLevel && topLevel.id !== category.id ? (
            <>
              <Link href={`/${topLevel.slug}`} className="hover:text-gold-600">
                {topLevel.name}
              </Link>
              <span>/</span>
            </>
          ) : null}
          <span className="text-navy-700">{category.name}</span>
          {citySlug ? (
            <>
              <span>/</span>
              <span className="text-navy-700">{citySlug}</span>
            </>
          ) : null}
        </nav>

        <div className="mt-6">
          <SectionHeading
            eyebrow="Discover"
            title={`${category.name}${citySlug ? ` in ${allCities.find((c) => c.slug === citySlug)?.name ?? citySlug}` : ""}`}
            description={category.description ?? `Browse verified ${category.name.toLowerCase()} for your event.`}
          />
        </div>

        {siblings.length > 1 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {siblings.map((sib) => (
              <Link
                key={sib.id}
                href={`/${sib.slug}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-luxury duration-200 ${
                  sib.slug === activeCategorySlug
                    ? "border-gold-500 bg-gold-500/10 text-navy-950"
                    : "border-navy-950/10 text-navy-700/70 hover:border-gold-500/40"
                }`}
              >
                {sib.name}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <Link
            href="?"
            className={`rounded-full border px-3 py-1.5 text-xs ${!citySlug ? "border-gold-500 bg-gold-500/10 text-navy-950" : "border-navy-950/10 text-navy-700/70"}`}
          >
            All Cities
          </Link>
          {allCities.map((city) => (
            <Link
              key={city.id}
              href={`/${categorySlug}/${city.slug}${subcategorySlug ? `/${subcategorySlug}` : ""}`}
              className={`rounded-full border px-3 py-1.5 text-xs transition-luxury duration-200 ${
                city.slug === citySlug ? "border-gold-500 bg-gold-500/10 text-navy-950" : "border-navy-950/10 text-navy-700/70 hover:border-gold-500/40"
              }`}
            >
              {city.name}
            </Link>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={buildHref({ verified: verifiedOnly ? undefined : "1", page: undefined })}
            className={`rounded-full border px-3 py-1.5 text-xs ${verifiedOnly ? "border-gold-500 bg-gold-500/10 text-navy-950" : "border-navy-950/10 text-navy-700/70"}`}
          >
            Verified only
          </Link>
          <Link
            href={buildHref({ featured: featuredOnly ? undefined : "1", page: undefined })}
            className={`rounded-full border px-3 py-1.5 text-xs ${featuredOnly ? "border-gold-500 bg-gold-500/10 text-navy-950" : "border-navy-950/10 text-navy-700/70"}`}
          >
            Featured only
          </Link>
        </div>

        <div className="mt-10">
          {results.listings.length === 0 ? (
            <p className="text-sm text-navy-700/60">No listings here yet — be the first.</p>
          ) : null}
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.listings.map((listing) => (
              <Reveal key={listing.id}>
                <ListingCard listing={listing} />
              </Reveal>
            ))}
            <Reveal>
              <ListYourBusinessCard categoryName={category.name} />
            </Reveal>
          </div>
        </div>

        {totalPages > 1 ? (
          <div className="mt-10 flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={buildHref({ page: p === 1 ? undefined : String(p) })}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                  p === page ? "bg-gold-500 text-navy-950" : "border border-navy-950/10 text-navy-700/70 hover:border-gold-500/40"
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
