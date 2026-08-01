"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import Image from "next/image";
import {
  Loader2,
  Sparkles,
  Trash2,
  Plus,
  ImageIcon,
  Send,
  BadgeCheck,
  Clock,
  XCircle,
  Mail,
  Phone,
} from "lucide-react";

import { ListingProfileForm } from "@/features/business/listing-profile-form";
import {
  updateListingProfileAction,
  submitListingForReviewAction,
  requestBusinessImageUploadAction,
  setListingImageAction,
  addGalleryPhotoAction,
  deleteGalleryPhotoAction,
  addServiceAction,
  deleteServiceAction,
  addFaqAction,
  deleteFaqAction,
  generateAiSummaryAction,
  listLeadsForListingAction,
  setLeadStatusAction,
} from "@/features/business/actions";
import type { BusinessListingWithRelations, MarketplaceCategory, MarketplaceCity, BusinessLead } from "@/types/marketplace";

function storageUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/business/${path}` : null;
}

const STATUS_BADGE: Record<BusinessListingWithRelations["status"], { label: string; className: string; icon: typeof Clock }> = {
  draft: { label: "Draft", className: "bg-navy-950/10 text-navy-700", icon: Clock },
  pending: { label: "Pending Review", className: "bg-gold-500/15 text-gold-700", icon: Clock },
  approved: { label: "Live", className: "bg-emerald-500/15 text-emerald-700", icon: BadgeCheck },
  rejected: { label: "Rejected — please revise", className: "bg-red-500/10 text-red-700", icon: XCircle },
};

const TABS = ["Profile", "Photos", "Services", "FAQs", "Leads", "AI Summary"] as const;
type Tab = (typeof TABS)[number];

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

export function BusinessDashboardClient({
  listing,
  categories,
  cities,
}: {
  listing: BusinessListingWithRelations;
  categories: MarketplaceCategory[];
  cities: MarketplaceCity[];
}) {
  const [tab, setTab] = useState<Tab>("Profile");
  const badge = STATUS_BADGE[listing.status];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-950/10 bg-white p-5">
        <div>
          <p className="font-display text-xl text-navy-950">{listing.displayName}</p>
          <p className="mt-1 text-sm text-navy-700/60">celebrationmemories.com/listing/{listing.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}>
            <badge.icon size={13} /> {badge.label}
          </span>
          <SubmitForReviewButton listingId={listing.id} status={listing.status} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-1 rounded-full border border-navy-950/10 bg-white p-1">
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

      <div className="mt-6 rounded-2xl border border-navy-950/10 bg-white p-5 sm:p-6">
        {tab === "Profile" ? <ProfileTab listing={listing} categories={categories} cities={cities} /> : null}
        {tab === "Photos" ? <PhotosTab listing={listing} /> : null}
        {tab === "Services" ? <ServicesTab listing={listing} /> : null}
        {tab === "FAQs" ? <FaqsTab listing={listing} /> : null}
        {tab === "Leads" ? <LeadsTab listing={listing} /> : null}
        {tab === "AI Summary" ? <AiSummaryTab listing={listing} /> : null}
      </div>
    </div>
  );
}

function SubmitForReviewButton({ listingId, status }: { listingId: string; status: BusinessListingWithRelations["status"] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (status === "pending" || status === "approved") return null;

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await submitListingForReviewAction(listingId);
            if (!result.success) setError(result.error);
          })
        }
        className="flex items-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Submit for Review
      </button>
    </div>
  );
}

function ProfileTab({
  listing,
  categories,
  cities,
}: {
  listing: BusinessListingWithRelations;
  categories: MarketplaceCategory[];
  cities: MarketplaceCity[];
}) {
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<"profile" | "cover" | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(file: File, kind: "profile" | "cover") {
    setUploading(kind);
    setUploadError(null);
    try {
      const prep = await requestBusinessImageUploadAction(listing.id, {
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      });
      if (!prep.success) {
        setUploadError(prep.error);
        return;
      }
      const putRes = await fetch(prep.data.signedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!putRes.ok) {
        setUploadError("Upload failed. Please try again.");
        return;
      }
      const result = await setListingImageAction(
        listing.id,
        kind === "profile" ? { profileImagePath: prep.data.path } : { coverImagePath: prep.data.path },
      );
      if (!result.success) setUploadError(result.error);
    } finally {
      setUploading(null);
    }
  }

  const profileUrl = storageUrl(listing.profileImagePath);
  const coverUrl = storageUrl(listing.coverImagePath);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-navy-700/60">Profile Image</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ivory-100">
              {profileUrl ? (
                <Image src={profileUrl} alt="" width={64} height={64} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon size={20} className="text-navy-700/30" />
              )}
            </div>
            <input
              ref={profileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "profile")}
            />
            <button
              onClick={() => profileInputRef.current?.click()}
              disabled={uploading === "profile"}
              className="rounded-full border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-950/5 disabled:opacity-60"
            >
              {uploading === "profile" ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-navy-700/60">Cover Image</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ivory-100">
              {coverUrl ? (
                <Image src={coverUrl} alt="" width={96} height={64} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon size={20} className="text-navy-700/30" />
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "cover")}
            />
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={uploading === "cover"}
              className="rounded-full border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-950/5 disabled:opacity-60"
            >
              {uploading === "cover" ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </div>
      {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}

      <ListingProfileForm
        initial={listing}
        categories={categories}
        cities={cities}
        submitLabel="Save Changes"
        onSubmit={(values) => updateListingProfileAction(listing.id, values)}
        onSuccess={() => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        }}
      />
      {saved ? <p className="text-xs text-emerald-700">Saved.</p> : null}
    </div>
  );
}

function PhotosTab({ listing }: { listing: BusinessListingWithRelations }) {
  const [gallery, setGallery] = useState(listing.gallery);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const prep = await requestBusinessImageUploadAction(listing.id, {
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      });
      if (!prep.success) return setError(prep.error);
      const putRes = await fetch(prep.data.signedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!putRes.ok) return setError("Upload failed. Please try again.");
      const result = await addGalleryPhotoAction(listing.id, prep.data.path);
      if (!result.success) return setError(result.error);
      setGallery((g) => [...g, result.data]);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photoId: string) {
    setGallery((g) => g.filter((p) => p.id !== photoId));
    await deleteGalleryPhotoAction(listing.id, photoId);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-display text-lg text-navy-950">Gallery</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-full bg-gold-500 px-3.5 py-1.5 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Photo
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {gallery.length === 0 ? (
        <p className="mt-4 text-sm text-navy-700/60">No photos yet. Add a few to showcase your work.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {gallery.map((photo) => {
            const url = storageUrl(photo.storagePath);
            return (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg bg-ivory-100">
                {url ? <Image src={url} alt={photo.caption ?? ""} fill className="object-cover" /> : null}
                <button
                  onClick={() => handleDelete(photo.id)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-navy-950/70 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ServicesTab({ listing }: { listing: BusinessListingWithRelations }) {
  const [services, setServices] = useState(listing.services);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [priceUnit, setPriceUnit] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await addServiceAction(listing.id, { name, description, price: price || undefined, priceUnit });
    setPending(false);
    if (!result.success) return setError(result.error);
    setServices((s) => [...s, result.data]);
    setName("");
    setDescription("");
    setPrice("");
    setPriceUnit("");
  }

  async function handleDelete(id: string) {
    setServices((s) => s.filter((svc) => svc.id !== id));
    await deleteServiceAction(listing.id, id);
  }

  return (
    <div>
      <p className="font-display text-lg text-navy-950">Services</p>
      <div className="mt-4 grid gap-2">
        {services.map((s) => (
          <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-navy-950/10 p-3">
            <div>
              <p className="text-sm font-medium text-navy-950">{s.name}</p>
              {s.description ? <p className="mt-0.5 text-xs text-navy-700/60">{s.description}</p> : null}
              {s.price !== null ? (
                <p className="mt-0.5 text-xs text-gold-700">
                  ₹{s.price} {s.priceUnit}
                </p>
              ) : null}
            </div>
            <button onClick={() => handleDelete(s.id)} className="shrink-0 text-navy-700/40 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {services.length === 0 ? <p className="text-sm text-navy-700/60">No services added yet.</p> : null}
      </div>

      <form onSubmit={handleAdd} className="mt-5 grid gap-2 border-t border-navy-950/10 pt-5 sm:grid-cols-2">
        <input required placeholder="Service name" value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} />
        <input placeholder="Price unit (e.g. per event)" value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)} className={inputClasses} />
        <input placeholder="Price (₹)" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={inputClasses} />
        <input placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClasses} />
        {error ? <p className="text-xs text-red-600 sm:col-span-2">{error}</p> : null}
        <button
          disabled={pending || !name.trim()}
          className="flex items-center justify-center gap-1.5 rounded-full bg-navy-950 px-4 py-2 text-sm font-medium text-gold-300 hover:brightness-110 disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Service
        </button>
      </form>
    </div>
  );
}

function FaqsTab({ listing }: { listing: BusinessListingWithRelations }) {
  const [faqs, setFaqs] = useState(listing.faqs);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await addFaqAction(listing.id, { question, answer });
    setPending(false);
    if (!result.success) return setError(result.error);
    setFaqs((f) => [...f, result.data]);
    setQuestion("");
    setAnswer("");
  }

  async function handleDelete(id: string) {
    setFaqs((f) => f.filter((faq) => faq.id !== id));
    await deleteFaqAction(listing.id, id);
  }

  return (
    <div>
      <p className="font-display text-lg text-navy-950">Frequently Asked Questions</p>
      <div className="mt-4 grid gap-2">
        {faqs.map((f) => (
          <div key={f.id} className="flex items-start justify-between gap-3 rounded-lg border border-navy-950/10 p-3">
            <div>
              <p className="text-sm font-medium text-navy-950">{f.question}</p>
              <p className="mt-0.5 text-xs text-navy-700/60">{f.answer}</p>
            </div>
            <button onClick={() => handleDelete(f.id)} className="shrink-0 text-navy-700/40 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {faqs.length === 0 ? <p className="text-sm text-navy-700/60">No FAQs added yet.</p> : null}
      </div>

      <form onSubmit={handleAdd} className="mt-5 grid gap-2 border-t border-navy-950/10 pt-5">
        <input required placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} className={inputClasses} />
        <textarea required placeholder="Answer" rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} className={`${inputClasses} resize-none`} />
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <button
          disabled={pending || !question.trim() || !answer.trim()}
          className="flex items-center justify-center gap-1.5 rounded-full bg-navy-950 px-4 py-2 text-sm font-medium text-gold-300 hover:brightness-110 disabled:opacity-60 sm:justify-self-start"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add FAQ
        </button>
      </form>
    </div>
  );
}

const LEAD_STATUS_LABELS: Record<BusinessLead["status"], string> = { new: "New", contacted: "Contacted", closed: "Closed" };

function LeadsTab({ listing }: { listing: BusinessListingWithRelations }) {
  const [leads, setLeads] = useState<BusinessLead[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLeadsForListingAction(listing.id).then((result) => {
      setLoading(false);
      if (result.success) setLeads(result.data);
      else setError(result.error);
    });
  }, [listing.id]);

  async function handleStatusChange(leadId: string, status: BusinessLead["status"]) {
    setLeads((prev) => prev?.map((l) => (l.id === leadId ? { ...l, status } : l)) ?? null);
    await setLeadStatusAction(listing.id, leadId, status);
  }

  if (loading) return <Loader2 size={16} className="animate-spin text-navy-700/50" />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div>
      <p className="font-display text-lg text-navy-950">Leads</p>
      {!leads || leads.length === 0 ? (
        <p className="mt-3 text-sm text-navy-700/60">No leads yet — they&apos;ll appear here as hosts reach out from your listing.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {leads.map((lead) => (
            <div key={lead.id} className="rounded-lg border border-navy-950/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-navy-950">{lead.name}</p>
                <select
                  value={lead.status}
                  onChange={(e) => handleStatusChange(lead.id, e.target.value as BusinessLead["status"])}
                  className="rounded-full border border-navy-950/15 bg-white px-2.5 py-1 text-xs text-navy-700"
                >
                  {(Object.keys(LEAD_STATUS_LABELS) as BusinessLead["status"][]).map((s) => (
                    <option key={s} value={s}>
                      {LEAD_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-sm text-navy-700/80">{lead.message}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-navy-700/60">
                <span className="flex items-center gap-1">
                  <Mail size={12} /> {lead.email}
                </span>
                {lead.phone ? (
                  <span className="flex items-center gap-1">
                    <Phone size={12} /> {lead.phone}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AiSummaryTab({ listing }: { listing: BusinessListingWithRelations }) {
  const [summary, setSummary] = useState(listing.aiSummary);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setPending(true);
    setError(null);
    const result = await generateAiSummaryAction(listing.id);
    setPending(false);
    if (!result.success) return setError(result.error);
    setSummary(result.data);
  }

  return (
    <div>
      <p className="font-display text-lg text-navy-950">AI-Generated Summary</p>
      <p className="mt-1 text-sm text-navy-700/60">
        A short, polished blurb generated from your profile details — shown on your public listing page.
      </p>
      {summary ? (
        <div className="mt-4 rounded-lg border border-gold-500/20 bg-gold-500/5 p-4 text-sm text-navy-700/85">{summary}</div>
      ) : (
        <p className="mt-4 text-sm text-navy-700/60">No summary generated yet.</p>
      )}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <button
        onClick={handleGenerate}
        disabled={pending}
        className="mt-4 flex items-center gap-1.5 rounded-full bg-navy-950 px-4 py-2 text-sm font-medium text-gold-300 hover:brightness-110 disabled:opacity-60"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {summary ? "Regenerate" : "Generate"} Summary
      </button>
    </div>
  );
}
