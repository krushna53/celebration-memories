"use client";

import { useRouter } from "next/navigation";

import { ListingProfileForm } from "@/features/business/listing-profile-form";
import { createListingAction } from "@/features/business/actions";
import type { MarketplaceCategory, MarketplaceCity } from "@/types/marketplace";

/** Shown to a vendor with a business account but no listing yet — the "create your first listing" flow. */
export function CreateListingForm({ categories, cities }: { categories: MarketplaceCategory[]; cities: MarketplaceCity[] }) {
  const router = useRouter();

  return (
    <div className="rounded-2xl border border-navy-950/10 bg-white p-5 sm:p-6">
      <p className="font-display text-xl text-navy-950">Create Your Listing</p>
      <p className="mt-1 text-sm text-navy-700/60">
        Tell hosts about your business. You can save this as a draft and come back — nothing goes live until you
        submit it for review.
      </p>
      <div className="mt-5">
        <ListingProfileForm
          categories={categories}
          cities={cities}
          submitLabel="Create Listing"
          onSubmit={(values) => createListingAction(values)}
          onSuccess={() => router.refresh()}
        />
      </div>
    </div>
  );
}
