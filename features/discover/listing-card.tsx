import Link from "next/link";
import { Star, ShieldCheck, Sparkles } from "lucide-react";

import { publicMediaUrl } from "@/services/uploads";
import type { BusinessListingSummary } from "@/types/marketplace";

export function ListingCard({ listing }: { listing: BusinessListingSummary }) {
  const imageUrl = listing.profileImagePath ? publicMediaUrl("business", listing.profileImagePath) : null;

  return (
    <Link
      href={`/listing/${listing.slug}`}
      className="group block overflow-hidden rounded-2xl border border-navy-950/10 bg-white transition-luxury duration-200 hover:border-gold-500/40 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-navy-950/5">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={listing.displayName}
            className="h-full w-full object-cover transition-luxury duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-navy-700/30">
            <Sparkles size={28} />
          </div>
        )}
        {listing.isFeatured ? (
          <span className="absolute left-3 top-3 rounded-full bg-gold-500 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-navy-950">
            Featured
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base text-navy-950">{listing.displayName}</h3>
          {listing.isVerified ? <ShieldCheck size={16} className="mt-0.5 shrink-0 text-gold-600" /> : null}
        </div>
        {listing.tagline ? <p className="mt-1 line-clamp-2 text-sm text-navy-700/70">{listing.tagline}</p> : null}
        <div className="mt-3 flex items-center justify-between text-xs text-navy-700/60">
          <span>{listing.cityName ?? "Multiple cities"}</span>
          {listing.ratingCount > 0 ? (
            <span className="flex items-center gap-1">
              <Star size={12} className="fill-gold-500 text-gold-500" />
              {listing.ratingAvg.toFixed(1)} ({listing.ratingCount})
            </span>
          ) : (
            <span className="text-navy-700/40">New</span>
          )}
        </div>
        {listing.startingPrice !== null ? (
          <p className="mt-2 text-sm font-medium text-navy-950">
            From ₹{listing.startingPrice.toLocaleString("en-IN")}
            {listing.priceUnit ? <span className="font-normal text-navy-700/60"> {listing.priceUnit}</span> : null}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
