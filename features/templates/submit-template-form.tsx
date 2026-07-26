"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { submitTemplateAction } from "@/features/templates/submit-actions";
import { deriveThemeFromSubmission, googleFontStylesheetUrl } from "@/lib/community-theme";
import {
  templateSubmissionFormSchema,
  type TemplateSubmissionFormValues,
} from "@/types/template-submission";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 transition-luxury duration-200 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

const CATEGORY_OPTIONS: { value: TemplateSubmissionFormValues["category"]; label: string }[] = [
  { value: "general", label: "General" },
  { value: "kids", label: "Kids" },
  { value: "formal", label: "Formal" },
  { value: "festive", label: "Festive" },
  { value: "romantic", label: "Romantic" },
];

const ANIMATION_OPTIONS: { value: TemplateSubmissionFormValues["animation"]; label: string; hint: string }[] = [
  { value: "luxury", label: "Luxury", hint: "Slow, restrained — the platform default" },
  { value: "minimal", label: "Minimal", hint: "Quick, understated" },
  { value: "dreamy", label: "Dreamy", hint: "Slow and soft" },
  { value: "playful", label: "Playful", hint: "Bouncy, lighthearted" },
  { value: "energetic", label: "Energetic", hint: "Fast and punchy" },
  { value: "festive", label: "Festive", hint: "Confetti particles" },
  { value: "jubilant", label: "Jubilant", hint: "Confetti + rising balloons" },
];

const DEFAULT_VALUES: TemplateSubmissionFormValues = {
  name: "",
  description: "",
  category: "general",
  authorName: "",
  authorWebsite: "",
  authorEmail: "",
  baseDarkColor: "#1a1a2e",
  baseAccentColor: "#c9a227",
  baseLightColor: "#fffdf7",
  fontDisplay: "Playfair Display",
  animation: "luxury",
};

/** Live preview card — a mini invitation mockup that updates as the contributor picks colors/fonts, so they can see the result before submitting. Loads the chosen Google Font on the fly. */
function PreviewCard({ values }: { values: TemplateSubmissionFormValues }) {
  const theme = useMemo(
    () =>
      deriveThemeFromSubmission({
        baseDarkColor: values.baseDarkColor || "#000000",
        baseAccentColor: values.baseAccentColor || "#c9a227",
        baseLightColor: values.baseLightColor || "#ffffff",
        fontDisplay: values.fontDisplay || "Georgia",
        animation: values.animation,
      }),
    [values.baseDarkColor, values.baseAccentColor, values.baseLightColor, values.fontDisplay, values.animation],
  );

  useEffect(() => {
    if (!values.fontDisplay?.trim()) return;
    const linkId = "template-preview-font";
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = googleFontStylesheetUrl(values.fontDisplay);
  }, [values.fontDisplay]);

  return (
    <div
      className="sticky top-24 overflow-hidden rounded-2xl border border-navy-950/10 shadow-sm"
      style={{ backgroundColor: theme.colors.navy950 }}
    >
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 px-6 text-center">
        <p
          className="text-xs uppercase tracking-[0.35em]"
          style={{ color: theme.colors.gold300 }}
        >
          HOSTED BY
        </p>
        <p
          className="text-2xl"
          style={{ color: theme.colors.ivory50, fontFamily: theme.fontDisplayVar }}
        >
          {values.name?.trim() || "Your Template Name"}
        </p>
        <div className="h-px w-16" style={{ backgroundColor: theme.colors.gold500 }} />
        <p className="text-xs" style={{ color: theme.colors.gold200 }}>
          {CATEGORY_OPTIONS.find((c) => c.value === values.category)?.label} · {values.fontDisplay || "Font"}
        </p>
      </div>
      <div className="px-4 py-3 text-center text-xs" style={{ backgroundColor: theme.colors.ivory50, color: theme.colors.navy700 }}>
        Live preview — actual template uses your full site content
      </div>
    </div>
  );
}

/**
 * Public "Submit a Template" form (/templates/submit) — anyone can
 * design a config-only template (3 seed colors + a Google Font + a
 * motion style) and submit it for review, with credit fields for their
 * name and an optional website link. No account needed. See
 * lib/community-theme.ts for how a 3-color submission becomes a full
 * palette, and features/admin/template-submissions for the owner's
 * review queue.
 */
export function SubmitTemplateForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TemplateSubmissionFormValues>({
    resolver: zodResolver(templateSubmissionFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const liveValues = useWatch({ control }) as TemplateSubmissionFormValues;

  async function onSubmit(values: TemplateSubmissionFormValues) {
    setServerError(null);
    const result = await submitTemplateAction(values, honeypot);
    if (result.success) {
      setSubmitted(true);
      reset(DEFAULT_VALUES);
    } else {
      setServerError(result.error);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-500/20 bg-white px-8 py-12 text-center shadow-sm">
        <CheckCircle2 className="text-gold-500" size={36} />
        <h3 className="font-display text-xl text-navy-950">Template submitted</h3>
        <p className="max-w-sm text-sm text-navy-700/75">
          Thanks for contributing — we&rsquo;ll review it and, if approved, it&rsquo;ll
          show up in the template picker with credit to you.
        </p>
        <Button variant="outline" onClick={() => setSubmitted(false)}>
          Submit another template
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid gap-6 rounded-2xl border border-gold-500/15 bg-white px-6 py-8 text-left shadow-sm sm:px-10 sm:py-10"
      >
        {/* Honeypot — hidden from real visitors via CSS, never via display:none (some bots skip those) */}
        <div className="absolute -left-[9999px]" aria-hidden="true">
          <label htmlFor="website">Leave this field empty</label>
          <input
            id="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className={labelClasses} htmlFor="name">
              Template Name
            </label>
            <input id="name" className={cn(inputClasses, "mt-1.5")} placeholder="e.g. Sunset Garden" {...register("name")} />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
          </div>
          <div>
            <label className={labelClasses} htmlFor="category">
              Category
            </label>
            <select id="category" className={cn(inputClasses, "mt-1.5")} {...register("category")}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClasses} htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            className={cn(inputClasses, "mt-1.5 resize-none")}
            placeholder="A short description of the look and feel."
            {...register("description")}
          />
          {errors.description ? <p className="mt-1 text-xs text-red-600">{errors.description.message}</p> : null}
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <label className={labelClasses} htmlFor="baseDarkColor">
              Dark / Base Color
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input type="color" className="h-10 w-10 shrink-0 cursor-pointer rounded border border-navy-950/15" {...register("baseDarkColor")} />
              <input className={inputClasses} {...register("baseDarkColor")} />
            </div>
            {errors.baseDarkColor ? <p className="mt-1 text-xs text-red-600">{errors.baseDarkColor.message}</p> : null}
          </div>
          <div>
            <label className={labelClasses} htmlFor="baseAccentColor">
              Accent Color
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input type="color" className="h-10 w-10 shrink-0 cursor-pointer rounded border border-navy-950/15" {...register("baseAccentColor")} />
              <input className={inputClasses} {...register("baseAccentColor")} />
            </div>
            {errors.baseAccentColor ? <p className="mt-1 text-xs text-red-600">{errors.baseAccentColor.message}</p> : null}
          </div>
          <div>
            <label className={labelClasses} htmlFor="baseLightColor">
              Light / Ivory Color
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input type="color" className="h-10 w-10 shrink-0 cursor-pointer rounded border border-navy-950/15" {...register("baseLightColor")} />
              <input className={inputClasses} {...register("baseLightColor")} />
            </div>
            {errors.baseLightColor ? <p className="mt-1 text-xs text-red-600">{errors.baseLightColor.message}</p> : null}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className={labelClasses} htmlFor="fontDisplay">
              Display Font (Google Fonts name)
            </label>
            <input
              id="fontDisplay"
              className={cn(inputClasses, "mt-1.5")}
              placeholder="e.g. Cormorant Garamond"
              {...register("fontDisplay")}
            />
            <p className="mt-1 text-xs text-navy-700/50">
              Must be an exact font family name from{" "}
              <a href="https://fonts.google.com" target="_blank" rel="noopener noreferrer" className="underline">
                fonts.google.com
              </a>
              . Used for headings only.
            </p>
            {errors.fontDisplay ? <p className="mt-1 text-xs text-red-600">{errors.fontDisplay.message}</p> : null}
          </div>
          <div>
            <label className={labelClasses} htmlFor="animation">
              Motion Style
            </label>
            <select id="animation" className={cn(inputClasses, "mt-1.5")} {...register("animation")}>
              {ANIMATION_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label} — {a.hint}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-6 border-t border-navy-950/10 pt-6 sm:grid-cols-2">
          <div>
            <label className={labelClasses} htmlFor="authorName">
              Your Name (credited publicly)
            </label>
            <input id="authorName" className={cn(inputClasses, "mt-1.5")} {...register("authorName")} />
            {errors.authorName ? <p className="mt-1 text-xs text-red-600">{errors.authorName.message}</p> : null}
          </div>
          <div>
            <label className={labelClasses} htmlFor="authorWebsite">
              Your Website (optional, linked publicly)
            </label>
            <input id="authorWebsite" className={cn(inputClasses, "mt-1.5")} placeholder="https://" {...register("authorWebsite")} />
            {errors.authorWebsite ? <p className="mt-1 text-xs text-red-600">{errors.authorWebsite.message}</p> : null}
          </div>
        </div>

        <div>
          <label className={labelClasses} htmlFor="authorEmail">
            Your Email (private — for follow-up only, never shown publicly)
          </label>
          <input id="authorEmail" type="email" className={cn(inputClasses, "mt-1.5")} {...register("authorEmail")} />
          {errors.authorEmail ? <p className="mt-1 text-xs text-red-600">{errors.authorEmail.message}</p> : null}
        </div>

        {serverError ? (
          <p className="text-sm text-red-600" role="alert">
            {serverError}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto sm:justify-self-start">
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={16} /> Submitting...
            </>
          ) : (
            "Submit for Review"
          )}
        </Button>
      </form>

      <div className="hidden lg:block">
        <PreviewCard values={liveValues} />
      </div>
    </div>
  );
}
