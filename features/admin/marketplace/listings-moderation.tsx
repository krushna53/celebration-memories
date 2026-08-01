"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, Check, ExternalLink, Star, X } from "lucide-react";

import {
  setListingStatusAction,
  setListingVerifiedAction,
  setListingFeaturedAction,
} from "@/features/admin/marketplace/actions";
import type { BusinessListing, ListingStatus, MarketplaceCategory } from "@/types/marketplace";

const STATUS_FILTERS: { value: ListingStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "draft", label: "Draft" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_STYLES: Record<ListingStatus, string> = {
  draft: "bg-navy-950/10 text-navy-700",
  pending: "bg-gold-500/15 text-gold-700",
  approved: "bg-emerald-500/15 text-emerald-700",
  rejected: "bg-red-500/10 text-red-700",
};

export function ListingsModeration({
  initialListings,
  categories,
}: {
  initialListings: BusinessListing[];
  categories: MarketplaceCategory[];
}) {
  const [listings, setListings] = useState(initialListings);
  const [filter, setFilter] = useState<ListingStatus | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Uncategorized") : "Uncategorized");
  }, [categories]);

  const filtered = filter === "all" ? listings : listings.filter((l) => l.status === filter);

  function patch(id: string, next: Partial<BusinessListing>) {
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...next } : l)));
  }

  function changeStatus(listing: BusinessListing, status: ListingStatus) {
    setError(null);
    setBusyId(listing.id);
    startTransition(async () => {
      const result = await setListingStatusAction(listing.id, status);
      setBusyId(null);
      if (result.success) patch(listing.id, { status });
      else setError(result.error);
    });
  }

  function toggleVerified(listing: BusinessListing) {
    setError(null);
    setBusyId(listing.id);
    const next = !listing.isVerified;
    startTransition(async () => {
      const result = await setListingVerifiedAction(listing.id, next);
      setBusyId(null);
      if (result.success) patch(listing.id, { isVerified: next });
      else setError(result.error);
    });
  }

  function toggleFeatured(listing: BusinessListing) {
    setError(null);
    setBusyId(listing.id);
    const next = !listing.isFeatured;
    startTransition(async () => {
      const result = await setListingFeaturedAction(listing.id, next);
      setBusyId(null);
      if (result.success) patch(listing.id, { isFeatured: next });
      else setError(result.error);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === f.value ? "border-navy-950 bg-navy-950 text-gold-300" : "border-navy-950/15 text-navy-700/60 hover:border-navy-950/30"
            }`}
          >
            {f.label} ({f.value === "all" ? listings.length : listings.filter((l) => l.status === f.value).length})
          </button>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 grid gap-3">
        {filtered.length === 0 ? <p className="text-sm text-navy-700/60">No listings in this view.</p> : null}
        {filtered.map((listing) => (
          <div key={listing.id} className="rounded-xl border border-navy-950/10 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-navy-950">{listing.displayName}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[listing.status]}`}>{listing.status}</span>
                  {listing.isVerified ? <BadgeCheck size={14} className="text-emerald-600" /> : null}
                  {listing.isFeatured ? <Star size={14} className="fill-gold-500 text-gold-500" /> : null}
                </div>
                <p className="mt-1 text-xs text-navy-700/60">{categoryName(listing.primaryCategoryId)}</p>
                {listing.tagline ? <p className="mt-1 text-sm text-navy-700/75">{listing.tagline}</p> : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {listing.status === "approved" ? (
                  <Link
                    href={`/listing/${listing.slug}`}
                    target="_blank"
                    className="flex items-center gap-1 rounded-full border border-navy-950/15 px-2.5 py-1 text-xs text-navy-700/70 hover:border-navy-950/30"
                  >
                    <ExternalLink size={12} /> View
                  </Link>
                ) : null}

                <button
                  disabled={busyId === listing.id}
                  onClick={() => toggleVerified(listing)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                    listing.isVerified ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-navy-950/15 text-navy-700/60 hover:border-navy-950/30"
                  }`}
                >
                  {listing.isVerified ? "Verified" : "Verify"}
                </button>

                <button
                  disabled={busyId === listing.id}
                  onClick={() => toggleFeatured(listing)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                    listing.isFeatured ? "border-gold-500/50 bg-gold-500/10 text-gold-700" : "border-navy-950/15 text-navy-700/60 hover:border-navy-950/30"
                  }`}
                >
                  {listing.isFeatured ? "Featured" : "Feature"}
                </button>

                {listing.status !== "approved" ? (
                  <button
                    disabled={busyId === listing.id}
                    onClick={() => changeStatus(listing, "approved")}
                    className="flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
                  >
                    <Check size={12} /> Approve
                  </button>
                ) : null}

                {listing.status !== "rejected" ? (
                  <button
                    disabled={busyId === listing.id}
                    onClick={() => changeStatus(listing, "rejected")}
                    className="flex items-center gap-1 rounded-full border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <X size={12} /> Reject
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
