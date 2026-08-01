"use client";

import { useState } from "react";

import { ListingsModeration } from "@/features/admin/marketplace/listings-moderation";
import { ReviewsModeration } from "@/features/admin/marketplace/reviews-moderation";
import { CategoriesManager } from "@/features/admin/marketplace/categories-manager";
import { CsvImport } from "@/features/admin/marketplace/csv-import";
import type { BusinessListing, MarketplaceCategory, MarketplaceCity, Review } from "@/types/marketplace";

const TABS = ["Listings", "Reviews", "Categories & Cities", "Bulk Import"] as const;
type Tab = (typeof TABS)[number];

export function MarketplaceAdminClient({
  initialListings,
  initialReviews,
  initialCategories,
  initialCities,
}: {
  initialListings: BusinessListing[];
  initialReviews: (Review & { businessId: string; businessName: string })[];
  initialCategories: MarketplaceCategory[];
  initialCities: MarketplaceCity[];
}) {
  const [tab, setTab] = useState<Tab>("Listings");

  return (
    <div>
      <div className="flex flex-wrap gap-1 rounded-full border border-navy-950/10 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              tab === t ? "bg-navy-950 text-gold-300" : "text-navy-700/70 hover:bg-navy-950/5"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "Listings" ? <ListingsModeration initialListings={initialListings} categories={initialCategories} /> : null}
        {tab === "Reviews" ? <ReviewsModeration initialReviews={initialReviews} /> : null}
        {tab === "Categories & Cities" ? <CategoriesManager initialCategories={initialCategories} initialCities={initialCities} /> : null}
        {tab === "Bulk Import" ? <CsvImport categories={initialCategories} cities={initialCities} /> : null}
      </div>
    </div>
  );
}
