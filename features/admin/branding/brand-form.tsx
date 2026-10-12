"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  confirmBrandLogoAction,
  deleteBrandAction,
  requestBrandLogoUploadAction,
  saveBrandAction,
} from "@/features/admin/branding/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "grid gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

export interface BrandFormValues {
  displayName: string;
  websiteUrl: string;
  logoUrl: string | null;
  applyToEvents: boolean;
}

/** Organiser branding editor for /admin/branding — name, website, logo and whether it shows on every event this account owns. */
export function BrandForm({ initial, exists }: { initial: BrandFormValues; exists: boolean }) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(exists);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveBrandAction({
        displayName: values.displayName,
        websiteUrl: values.websiteUrl,
        applyToEvents: values.applyToEvents,
      });
      if (result.success) {
        setSaved(true);
        setMessage({ ok: true, text: "Branding saved." });
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  async function uploadLogo(file: File) {
    setMessage(null);
    setUploading(true);
    try {
      const prep = await requestBrandLogoUploadAction(file.type, file.size);
      if (!prep.success) throw new Error(prep.error);
      const put = await fetch(prep.data.signedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("The upload didn't go through — please try again.");
      const done = await confirmBrandLogoAction(prep.data.path);
      if (!done.success) throw new Error(done.error);
      setValues((v) => ({ ...v, logoUrl: done.data.logoUrl }));
      setMessage({ ok: true, text: "Logo updated." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeLogo() {
    startTransition(async () => {
      const result = await confirmBrandLogoAction(null);
      if (result.success) setValues((v) => ({ ...v, logoUrl: null }));
      else setMessage({ ok: false, text: result.error });
    });
  }

  function removeBrand() {
    if (!window.confirm("Remove your branding from all your events?")) return;
    startTransition(async () => {
      const result = await deleteBrandAction();
      if (result.success) {
        setValues({ displayName: "", websiteUrl: "", logoUrl: null, applyToEvents: true });
        setSaved(false);
        setMessage({ ok: true, text: "Branding removed." });
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClasses}>
            Business / organiser name
            <input
              className={inputClasses}
              value={values.displayName}
              maxLength={60}
              placeholder="e.g. Bright Events Co."
              onChange={(e) => setValues((v) => ({ ...v, displayName: e.target.value }))}
            />
          </label>
          <label className={labelClasses}>
            Website (optional)
            <input
              className={inputClasses}
              value={values.websiteUrl}
              maxLength={200}
              type="url"
              inputMode="url"
              placeholder="https://"
              onChange={(e) => setValues((v) => ({ ...v, websiteUrl: e.target.value }))}
            />
          </label>
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm text-navy-950">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-gold-500"
            checked={values.applyToEvents}
            onChange={(e) => setValues((v) => ({ ...v, applyToEvents: e.target.checked }))}
          />
          <span>
            Show &ldquo;Event powered by {values.displayName.trim() || "your business"}&rdquo; on every event I own
            <span className="block text-xs text-navy-700/60">
              An event can still show a different name from its own Event Settings → Co-branding card.
            </span>
          </span>
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? <Loader2 size={16} className="animate-spin" /> : null}
            Save branding
          </Button>
          {saved ? (
            <button
              type="button"
              onClick={removeBrand}
              disabled={pending}
              className="inline-flex items-center gap-1.5 text-sm text-navy-700/60 hover:text-red-600"
            >
              <Trash2 size={14} /> Remove branding
            </button>
          ) : null}
          {message ? (
            <p className={message.ok ? "text-sm text-green-700" : "text-sm text-red-600"} role="status">
              {message.text}
            </p>
          ) : null}
        </div>

        <div className="mt-6 border-t border-navy-950/10 pt-5">
          <h2 className="font-display text-lg text-navy-950">Logo</h2>
          <p className="mt-1 text-sm text-navy-700/65">
            PNG, JPG or WebP, up to 5MB. A wide logo on a transparent or white background works best.
            {saved ? "" : " Save your name first, then add a logo."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {values.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={values.logoUrl} alt="Your logo" className="h-14 w-auto max-w-[200px] rounded border border-navy-950/10 bg-white object-contain p-1" />
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadLogo(file);
              }}
            />
            <Button type="button" variant="outline" disabled={!saved || uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {values.logoUrl ? "Replace logo" : "Upload logo"}
            </Button>
            {values.logoUrl ? (
              <button type="button" onClick={removeLogo} disabled={pending} className="text-sm text-navy-700/60 hover:text-red-600">
                Remove logo
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <aside className="rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-navy-700/60">Preview — event site footer</p>
        <div className="mt-3 flex items-center justify-center gap-2.5 rounded-lg bg-navy-950 px-4 py-5 text-xs tracking-wide text-ivory-100/60">
          {values.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={values.logoUrl} alt="" className="h-7 w-auto max-w-[120px] rounded bg-white/90 object-contain p-0.5" />
          ) : null}
          <span>
            Event powered by{" "}
            <span className="font-medium text-gold-300">{values.displayName.trim() || "Your business"}</span>
          </span>
        </div>
        <p className="mt-3 text-xs text-navy-700/60">
          Your logo and name also appear in the dashboard header for everyone you add to your events — so the people
          you organise for see your brand while they manage their event.
        </p>
      </aside>
    </div>
  );
}
