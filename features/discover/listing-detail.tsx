import Link from "next/link";
import { Star, ShieldCheck, MapPin, Globe, Phone, MessageCircle, Instagram, Facebook, Youtube, Linkedin } from "lucide-react";

import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { ListingCard } from "@/features/discover/listing-card";
import { LeadForm } from "@/features/discover/lead-form";
import { ReviewForm } from "@/features/discover/review-form";
import { publicMediaUrl } from "@/services/uploads";
import { getRelatedListings } from "@/services/marketplace-listings";
import type { BusinessListingWithRelations } from "@/types/marketplace";

export async function ListingDetail({ listing }: { listing: BusinessListingWithRelations }) {
  const related = await getRelatedListings(listing.id, listing.primaryCategoryId, 4);
  const coverUrl = listing.coverImagePath ? publicMediaUrl("business", listing.coverImagePath) : null;
  const profileUrl = listing.profileImagePath ? publicMediaUrl("business", listing.profileImagePath) : null;

  return (
    <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
      <div className="relative h-56 w-full overflow-hidden bg-navy-950 sm:h-72">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-full w-full object-cover opacity-70" />
        ) : null}
      </div>

      <div className="mx-auto -mt-16 max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-navy-950/10 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:gap-6">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-navy-950/5 sm:h-28 sm:w-28">
            {profileUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profileUrl} alt={listing.displayName} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl text-navy-950">{listing.displayName}</h1>
              {listing.isVerified ? <ShieldCheck size={18} className="text-gold-600" /> : null}
            </div>
            {listing.tagline ? <p className="mt-1 text-sm text-navy-700/70">{listing.tagline}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-700/60">
              {listing.city ? (
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {listing.city.name}
                </span>
              ) : null}
              {listing.ratingCount > 0 ? (
                <span className="flex items-center gap-1">
                  <Star size={12} className="fill-gold-500 text-gold-500" /> {listing.ratingAvg.toFixed(1)} ({listing.ratingCount} reviews)
                </span>
              ) : null}
              {listing.categories.map((c) => (
                <Link key={c.id} href={`/${c.slug}`} className="rounded-full bg-navy-950/5 px-2 py-0.5 hover:bg-gold-500/10 hover:text-gold-700">
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            {listing.aiSummary ? (
              <Reveal>
                <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 text-sm italic text-navy-700/80">{listing.aiSummary}</div>
              </Reveal>
            ) : null}

            {listing.description ? (
              <Reveal>
                <div className="mt-6">
                  <h2 className="font-display text-lg text-navy-950">About</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-navy-700/80">{listing.description}</p>
                </div>
              </Reveal>
            ) : null}

            {listing.gallery.length > 0 ? (
              <Reveal>
                <div className="mt-8">
                  <h2 className="font-display text-lg text-navy-950">Gallery</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {listing.gallery.map((photo) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={photo.id}
                        src={publicMediaUrl("business", photo.storagePath)}
                        alt={photo.caption ?? ""}
                        className="aspect-square rounded-lg object-cover"
                      />
                    ))}
                  </div>
                </div>
              </Reveal>
            ) : null}

            {listing.services.length > 0 ? (
              <Reveal>
                <div className="mt-8">
                  <h2 className="font-display text-lg text-navy-950">Services & Pricing</h2>
                  <div className="mt-3 grid gap-2.5">
                    {listing.services.map((s) => (
                      <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-navy-950/10 bg-white p-3.5">
                        <div>
                          <p className="text-sm font-medium text-navy-950">{s.name}</p>
                          {s.description ? <p className="mt-0.5 text-xs text-navy-700/60">{s.description}</p> : null}
                        </div>
                        {s.price !== null ? (
                          <p className="shrink-0 text-sm font-medium text-navy-950">
                            ₹{s.price.toLocaleString("en-IN")}
                            {s.priceUnit ? <span className="font-normal text-navy-700/50"> {s.priceUnit}</span> : null}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ) : null}

            {listing.citiesServed.length > 0 ? (
              <div className="mt-8">
                <h2 className="font-display text-lg text-navy-950">Cities Served</h2>
                <p className="mt-2 text-sm text-navy-700/70">{listing.citiesServed.join(", ")}</p>
              </div>
            ) : null}

            {listing.languages.length > 0 ? (
              <div className="mt-4">
                <h2 className="font-display text-lg text-navy-950">Languages</h2>
                <p className="mt-2 text-sm text-navy-700/70">{listing.languages.join(", ")}</p>
              </div>
            ) : null}

            {listing.faqs.length > 0 ? (
              <Reveal>
                <div className="mt-8">
                  <h2 className="font-display text-lg text-navy-950">Frequently Asked Questions</h2>
                  <div className="mt-3 grid gap-3">
                    {listing.faqs.map((f) => (
                      <div key={f.id}>
                        <p className="text-sm font-medium text-navy-950">{f.question}</p>
                        <p className="mt-1 text-sm text-navy-700/70">{f.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ) : null}

            <div className="mt-10">
              <h2 className="font-display text-lg text-navy-950">Reviews</h2>
              <div className="mt-3 grid gap-3">
                {listing.reviews.length === 0 ? (
                  <p className="text-sm text-navy-700/50">No reviews yet — be the first!</p>
                ) : (
                  listing.reviews.map((r) => (
                    <div key={r.id} className="rounded-lg border border-navy-950/10 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-navy-950">{r.reviewerName}</p>
                        <span className="flex items-center gap-1 text-xs text-navy-700/60">
                          <Star size={12} className="fill-gold-500 text-gold-500" /> {r.rating}
                        </span>
                      </div>
                      {r.comment ? <p className="mt-1.5 text-sm text-navy-700/70">{r.comment}</p> : null}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4">
                <ReviewForm businessId={listing.id} />
              </div>
            </div>

            {related.length > 0 ? (
              <div className="mt-12">
                <SectionHeading eyebrow="You Might Also Like" title="Related Listings" description="" />
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {related.map((r) => (
                    <ListingCard key={r.id} listing={r} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="grid gap-4">
              <div className="rounded-xl border border-navy-950/10 bg-white p-5">
                {listing.startingPrice !== null ? (
                  <p className="font-display text-xl text-navy-950">
                    ₹{listing.startingPrice.toLocaleString("en-IN")}
                    {listing.priceUnit ? <span className="ml-1 text-sm font-normal text-navy-700/60">{listing.priceUnit}</span> : null}
                  </p>
                ) : null}
                <div className="mt-3 grid gap-2 text-sm">
                  {listing.whatsappNumber ? (
                    <a
                      href={`https://wa.me/${listing.whatsappNumber.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-navy-700 hover:text-gold-600"
                    >
                      <MessageCircle size={15} /> WhatsApp
                    </a>
                  ) : null}
                  {listing.contactPhone ? (
                    <a href={`tel:${listing.contactPhone}`} className="flex items-center gap-2 text-navy-700 hover:text-gold-600">
                      <Phone size={15} /> {listing.contactPhone}
                    </a>
                  ) : null}
                  {listing.website ? (
                    <a href={listing.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-navy-700 hover:text-gold-600">
                      <Globe size={15} /> Website
                    </a>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {listing.instagramUrl ? (
                    <a href={listing.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-navy-700/60 hover:text-gold-600">
                      <Instagram size={17} />
                    </a>
                  ) : null}
                  {listing.facebookUrl ? (
                    <a href={listing.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-navy-700/60 hover:text-gold-600">
                      <Facebook size={17} />
                    </a>
                  ) : null}
                  {listing.youtubeUrl ? (
                    <a href={listing.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-navy-700/60 hover:text-gold-600">
                      <Youtube size={17} />
                    </a>
                  ) : null}
                  {listing.linkedinUrl ? (
                    <a href={listing.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-navy-700/60 hover:text-gold-600">
                      <Linkedin size={17} />
                    </a>
                  ) : null}
                </div>
              </div>

              <LeadForm businessId={listing.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
