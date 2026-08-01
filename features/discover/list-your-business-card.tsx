import Link from "next/link";
import { Plus } from "lucide-react";

/**
 * A dummy "join the directory" tile slotted into every listing grid on
 * the public Discover pages — same card footprint as ListingCard, but
 * always present regardless of how many real listings exist, so every
 * visitor (including vendors casually browsing their own category) sees
 * an obvious path to sign up. Links straight into the vendor onboarding
 * flow (features/business).
 */
export function ListYourBusinessCard({ categoryName }: { categoryName?: string }) {
  return (
    <Link
      href="/business"
      className="group flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-gold-500/40 bg-gold-500/5 p-6 text-center transition-luxury duration-200 hover:border-gold-500 hover:bg-gold-500/10"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-700 transition-luxury duration-200 group-hover:bg-gold-500/25">
        <Plus size={22} />
      </div>
      <p className="mt-4 font-display text-base text-navy-950">
        {categoryName ? `Are you a ${categoryName.toLowerCase()}?` : "Want your business listed here?"}
      </p>
      <p className="mt-1.5 text-sm text-navy-700/70">
        Create your free listing and get discovered by hosts planning their next event.
      </p>
      <span className="mt-4 rounded-full bg-gold-500 px-4 py-1.5 text-xs font-semibold text-navy-950 transition-luxury duration-200 group-hover:brightness-110">
        Click here to get listed
      </span>
    </Link>
  );
}
