"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";

import type { MailerBrandInput } from "@/types/mailer";
import {
  brandOf,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  defaultBrandInput,
  LOGO_ACCEPT,
  LOGO_ACCEPT_ATTR,
  LOGO_MAX_BYTES,
  LOGO_MAX_HEIGHT,
  LOGO_MAX_WIDTH,
  normalizeHex,
} from "@/lib/mailer/brand";
import { renderEmail } from "@/lib/mailer/email-html";
import { sampleTokenValues } from "@/lib/mailer/tokens";
import { cn } from "@/lib/utils";
import { useMailer } from "@/features/mailer/mailer-provider";
import { Card, ErrorText, inputClasses, labelClasses, primaryButton, secondaryButton } from "@/features/mailer/components/ui";

/**
 * Brand Settings: logo + primary/secondary colour, applied to every Mailer
 * email (lib/mailer/email-html.ts). Mock mode keeps it in this browser with
 * the demo data; live mode saves it with the company's Mailer data and the
 * logo in Storage. The logo is always converted to a PNG here first — mail
 * apps don't show SVG, and converting also drops anything an SVG could run.
 */

const SAMPLE_CONTENT = {
  subject: "You're invited to our Annual Day",
  preheader: "Join us for an evening of celebration.",
  body: "Hi {{first_name}},\n\nWe'd love for you to join us for an evening of music, dinner and a look back at a great year.\n\nSee you there!",
  ctaLabel: "RSVP now",
  ctaUrl: "https://example.com/rsvp",
};

type PendingLogo = { blob: Blob; dataUrl: string };

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

function pickedType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".svg")) return "image/svg+xml";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

/** PNG/JPG/SVG → a PNG that fits LOGO_MAX_WIDTH × LOGO_MAX_HEIGHT. Throws a message for the person. */
async function logoToPng(file: File): Promise<Blob> {
  const type = pickedType(file);
  if (!(LOGO_ACCEPT as readonly string[]).includes(type)) throw new Error("Use a PNG, JPG or SVG file.");
  if (file.size > LOGO_MAX_BYTES) throw new Error("The logo must be 2 MB or smaller.");
  const isSvg = type === "image/svg+xml";

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file couldn't be opened as an image."));
      el.src = url;
    });
    // An SVG without its own size reports 0 (or 150×150 in some browsers) — give it a sensible box.
    let w = img.naturalWidth || 300;
    let h = img.naturalHeight || 100;
    if (w <= 0 || h <= 0) [w, h] = [300, 100];
    const fit = Math.min(LOGO_MAX_WIDTH / w, LOGO_MAX_HEIGHT / h);
    const scale = isSvg ? fit : Math.min(1, fit); // vectors can grow, photos only shrink
    const width = Math.max(1, Math.round(w * scale));
    const height = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't prepare the logo — try another browser.");
    ctx.drawImage(img, 0, 0, width, height);
    const png = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob(resolve, "image/png");
      } catch {
        resolve(null); // e.g. an SVG the browser won't let us read back
      }
    });
    if (!png) throw new Error(isSvg ? "This SVG couldn't be converted — try a PNG version of the logo." : "The logo couldn't be prepared — try another image.");
    if (png.size > LOGO_MAX_BYTES) throw new Error("The logo is too large after conversion — try a simpler or smaller image.");
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ColorField({
  id,
  label,
  value,
  onChange,
  fallback,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  fallback: string;
}) {
  const hex = normalizeHex(value);
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className={labelClasses}>
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={(hex ?? fallback).toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-xl border border-navy-950/12 bg-white p-1"
        />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => hex && onChange(hex)}
          placeholder={fallback}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={!hex}
          aria-describedby={hex ? undefined : errorId}
          className={cn(inputClasses, "font-mono uppercase", !hex && "border-red-300 focus:border-red-400 focus:ring-red-200")}
        />
        <span
          aria-hidden="true"
          className="h-10 w-10 shrink-0 rounded-xl border border-navy-950/10"
          style={{ background: hex ?? "transparent" }}
        />
      </div>
      {hex ? null : (
        <p id={errorId} className="mt-1 text-xs text-red-600">
          Enter a HEX color like {fallback}.
        </p>
      )}
    </div>
  );
}

export function BrandSettingsView() {
  const { data, run, mode } = useMailer();
  const saved = useMemo(() => brandOf(data), [data]);
  const initial: MailerBrandInput = saved ?? defaultBrandInput();

  const [primary, setPrimary] = useState(initial.primaryColor);
  const [secondary, setSecondary] = useState(initial.secondaryColor);
  /** The logo that stays when Save is pressed (saved one, or null after Remove). */
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  /** A newly picked logo, uploaded only when Save is pressed. */
  const [pending, setPending] = useState<PendingLogo | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const primaryHex = normalizeHex(primary);
  const secondaryHex = normalizeHex(secondary);
  const valid = Boolean(primaryHex && secondaryHex);
  const shownLogo = pending?.dataUrl ?? logoUrl;
  const dirty =
    pending !== null ||
    logoUrl !== initial.logoUrl ||
    primaryHex !== initial.primaryColor ||
    secondaryHex !== initial.secondaryColor ||
    !saved;

  const preview = useMemo(() => {
    const brand = {
      logoUrl: shownLogo,
      primaryColor: primaryHex ?? DEFAULT_PRIMARY_COLOR,
      secondaryColor: secondaryHex ?? DEFAULT_SECONDARY_COLOR,
    };
    return renderEmail("announcement", SAMPLE_CONTENT, sampleTokenValues(), { brand }).html;
  }, [shownLogo, primaryHex, secondaryHex]);

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);
    setPreparing(true);
    try {
      const blob = await logoToPng(file);
      setPending({ blob, dataUrl: await blobToDataUrl(blob) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The logo couldn't be prepared — try another image.");
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeLogo() {
    setPending(null);
    setLogoUrl(null);
    setNotice(null);
  }

  function resetToDefault() {
    const d = defaultBrandInput();
    setPrimary(d.primaryColor);
    setSecondary(d.secondaryColor);
    setPending(null);
    setLogoUrl(null);
    setError(null);
    setNotice("Defaults restored — press Save to apply them to your emails.");
  }

  async function save() {
    if (!primaryHex || !secondaryHex) {
      setError("Fix the highlighted color codes first.");
      return;
    }
    setError(null);
    setNotice(null);
    setSaving(true);
    const result = await run(async (repo) => {
      const url = pending ? await repo.uploadLogo(pending.blob) : logoUrl;
      return repo.saveBrandSettings({ logoUrl: url, primaryColor: primaryHex, secondaryColor: secondaryHex });
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPending(null);
    setLogoUrl(result.value.logoUrl);
    setPrimary(result.value.primaryColor);
    setSecondary(result.value.secondaryColor);
    setNotice("Brand settings saved — every email now uses them.");
  }

  const busy = saving || preparing;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card className="space-y-6">
        {/* Logo */}
        <div>
          <p className={labelClasses}>
            Logo <span className="ml-1 font-normal text-navy-700/45">PNG, JPG or SVG · up to 2 MB</span>
          </p>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void pickLogo(e.dataTransfer.files[0]);
            }}
            className={cn(
              "mt-1.5 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-5 text-center transition",
              dragging ? "border-gold-500 bg-gold-500/5" : "border-navy-950/12 bg-navy-950/[0.02]",
            )}
          >
            <div className="flex h-20 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-navy-950/[0.07] bg-white">
              {preparing ? (
                <Loader2 size={20} className="animate-spin text-navy-700/50" aria-label="Preparing logo" />
              ) : shownLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- data:/Storage URL preview
                <img src={shownLogo} alt="Your logo" className="max-h-16 max-w-32 object-contain" />
              ) : (
                <ImagePlus size={22} className="text-navy-700/35" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-navy-950">{shownLogo ? (pending ? "New logo ready — press Save to use it." : "Your logo") : "Drop your logo here, or choose a file."}</p>
              <p className="mt-0.5 text-xs text-navy-700/55">Shown at the top of every email. A wide logo on a transparent background works best.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={secondaryButton}>
                  {shownLogo ? <RefreshCw size={15} /> : <ImagePlus size={15} />}
                  {shownLogo ? "Replace" : "Upload logo"}
                </button>
                {shownLogo ? (
                  <button type="button" onClick={removeLogo} disabled={busy} className={cn(secondaryButton, "text-red-700")}>
                    <Trash2 size={15} /> Remove
                  </button>
                ) : null}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={LOGO_ACCEPT_ATTR}
              className="sr-only"
              tabIndex={-1}
              aria-label="Logo file"
              onChange={(e) => void pickLogo(e.target.files?.[0])}
            />
          </div>
        </div>

        <ColorField id="brand-primary" label="Primary color — buttons and links" value={primary} onChange={setPrimary} fallback={DEFAULT_PRIMARY_COLOR} />
        <ColorField id="brand-secondary" label="Secondary color — headings" value={secondary} onChange={setSecondary} fallback={DEFAULT_SECONDARY_COLOR} />

        <ErrorText>{error}</ErrorText>
        {notice ? (
          <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {notice}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-navy-950/[0.06] pt-4">
          <button type="button" onClick={save} disabled={busy || !valid} className={primaryButton}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={resetToDefault} disabled={busy} className={secondaryButton}>
            <RotateCcw size={15} /> Reset to default
          </button>
          {dirty && saved ? <span className="text-xs text-navy-700/55">Unsaved changes</span> : null}
        </div>
        {mode === "mock" ? (
          <p className="text-xs text-navy-700/50">Mock mode: saved in this browser only. &ldquo;Reset demo data&rdquo; clears it too.</p>
        ) : null}
      </Card>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card className="p-3 sm:p-3">
          <p className="px-1 pb-2 text-xs font-medium text-navy-700/75">Live preview</p>
          <iframe
            title="Brand preview"
            sandbox=""
            srcDoc={preview}
            className="h-[520px] w-full rounded-xl border border-navy-950/10 bg-white"
          />
          <p className="px-1 pt-2 text-xs text-navy-700/50">
            Every campaign, template and automatic email uses these settings. Each email type keeps its own background tint and
            emoji.
          </p>
        </Card>
      </div>
    </div>
  );
}
