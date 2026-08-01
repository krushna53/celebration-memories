"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";

import type { BusinessListing, ListingProfileFormValues, MarketplaceCategory, MarketplaceCity, ProfileType } from "@/types/marketplace";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

const PROFILE_TYPE_LABELS: Record<ProfileType, string> = {
  personal: "Personal",
  business: "Business",
  venue: "Venue",
  organization: "Organization",
  community: "Community",
  celebrity: "Celebrity",
  influencer: "Influencer",
  sponsor: "Sponsor",
};

function flattenCategories(categories: MarketplaceCategory[]): { id: string; label: string }[] {
  const topLevel = categories.filter((c) => !c.parentId);
  const result: { id: string; label: string }[] = [];
  for (const top of topLevel) {
    result.push({ id: top.id, label: top.name });
    for (const sub of categories.filter((c) => c.parentId === top.id)) {
      result.push({ id: sub.id, label: `— ${sub.name}` });
    }
  }
  return result;
}

interface ListingProfileFormProps {
  initial?: BusinessListing;
  categories: MarketplaceCategory[];
  cities: MarketplaceCity[];
  submitLabel: string;
  onSubmit: (values: ListingProfileFormValues) => Promise<ActionResult<unknown>>;
  onSuccess?: () => void;
}

/** Shared create/edit form for a listing's core profile fields — used both for a brand-new listing and editing an existing one. */
export function ListingProfileForm({ initial, categories, cities, submitLabel, onSubmit, onSuccess }: ListingProfileFormProps) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [profileType, setProfileType] = useState<ProfileType>(initial?.profileType ?? "business");
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [primaryCategoryId, setPrimaryCategoryId] = useState(initial?.primaryCategoryId ?? "");
  const [cityId, setCityId] = useState(initial?.cityId ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [citiesServed, setCitiesServed] = useState((initial?.citiesServed ?? []).join(", "));
  const [languages, setLanguages] = useState((initial?.languages ?? []).join(", "));
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [startingPrice, setStartingPrice] = useState(initial?.startingPrice?.toString() ?? "");
  const [priceUnit, setPriceUnit] = useState(initial?.priceUnit ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(initial?.whatsappNumber ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [instagramUrl, setInstagramUrl] = useState(initial?.instagramUrl ?? "");
  const [facebookUrl, setFacebookUrl] = useState(initial?.facebookUrl ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = flattenCategories(categories);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await onSubmit({
      displayName,
      profileType,
      tagline,
      description,
      primaryCategoryId,
      cityId,
      address,
      citiesServed: citiesServed.split(",").map((s) => s.trim()).filter(Boolean),
      languages: languages.split(",").map((s) => s.trim()).filter(Boolean),
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      startingPrice: startingPrice ? Number(startingPrice) : undefined,
      priceUnit,
      website,
      whatsappNumber,
      contactEmail,
      contactPhone,
      instagramUrl,
      facebookUrl,
    });

    setSubmitting(false);
    if (result.success) {
      onSuccess?.();
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 sm:col-span-2">
        <span className="text-xs font-medium text-navy-700/60">Business / Display Name</span>
        <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClasses} />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">Profile Type</span>
        <select value={profileType} onChange={(e) => setProfileType(e.target.value as ProfileType)} className={inputClasses}>
          {(Object.keys(PROFILE_TYPE_LABELS) as ProfileType[]).map((t) => (
            <option key={t} value={t}>
              {PROFILE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">Category</span>
        <select required value={primaryCategoryId} onChange={(e) => setPrimaryCategoryId(e.target.value)} className={inputClasses}>
          <option value="">Select a category</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 sm:col-span-2">
        <span className="text-xs font-medium text-navy-700/60">Tagline</span>
        <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="A one-line hook for your listing" className={inputClasses} />
      </label>

      <label className="grid gap-1 sm:col-span-2">
        <span className="text-xs font-medium text-navy-700/60">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className={`${inputClasses} resize-none`}
        />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">City</span>
        <select value={cityId} onChange={(e) => setCityId(e.target.value)} className={inputClasses}>
          <option value="">Select a city</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">Address (optional)</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClasses} />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">Cities Served (comma-separated)</span>
        <input value={citiesServed} onChange={(e) => setCitiesServed(e.target.value)} placeholder="Mumbai, Pune, Thane" className={inputClasses} />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">Languages (comma-separated)</span>
        <input value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Hindi" className={inputClasses} />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">Starting Price (₹)</span>
        <input type="number" min={0} value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} className={inputClasses} />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">Price Unit</span>
        <input value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)} placeholder="per event" className={inputClasses} />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">Tags (comma-separated)</span>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="candid, outdoor" className={inputClasses} />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">Website</span>
        <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClasses} />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">WhatsApp Number</span>
        <input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} className={inputClasses} />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">Contact Email</span>
        <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClasses} />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">Contact Phone</span>
        <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClasses} />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">Instagram URL</span>
        <input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className={inputClasses} />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-navy-700/60">Facebook URL</span>
        <input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} className={inputClasses} />
      </label>

      {error ? <p className="text-xs text-red-600 sm:col-span-2">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting || !displayName.trim() || !primaryCategoryId}
        className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {submitLabel}
      </button>
    </form>
  );
}
