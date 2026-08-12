"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, PencilLine, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { FORM_CATEGORY_OPTIONS, type FormCategory } from "@/lib/form-category";
import { createDraftFormAction } from "@/features/forms/builder-actions";
import { AiFormGenerator } from "@/features/forms/ai-form-generator";

type WizardStep = 1 | 2 | 3;

/**
 * /forms/new's entry point — a short wizard before landing in the full
 * builder (features/forms/form-builder.tsx):
 *
 *  1. What kind of RSVP is this? (lib/form-category.ts's FORM_CATEGORY_OPTIONS)
 *  2. Build it with AI, or by hand?
 *  3. (AI path only) the same prompt/image generator used inside the
 *     builder itself (features/forms/ai-form-generator.tsx) — reused
 *     here rather than duplicated, since generation always needs an
 *     existing draft form/token to persist into.
 *
 * The draft form is created as soon as step 2 is answered (not before
 * — step 1 alone doesn't need a database row yet), tagged with the
 * chosen category either way. The "build it myself" path additionally
 * seeds that category's starter fields (FORM_CATEGORY_STARTER_FIELDS)
 * so the builder doesn't open empty.
 */
export function NewFormWizard() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [category, setCategory] = useState<FormCategory | null>(null);
  const [creating, setCreating] = useState<"manual" | "ai" | null>(null);
  const [aiToken, setAiToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectCategory(value: FormCategory) {
    setCategory(value);
    setStep(2);
  }

  async function chooseManual() {
    if (!category) return;
    setError(null);
    setCreating("manual");
    const result = await createDraftFormAction(category, true);
    if (!result.success) {
      setCreating(null);
      setError(result.error);
      return;
    }
    router.push(`/forms/build/${result.token}`);
  }

  async function chooseAi() {
    if (!category) return;
    setError(null);
    setCreating("ai");
    const result = await createDraftFormAction(category, false);
    setCreating(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setAiToken(result.token);
    setStep(3);
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-gold-600">Step {step} of 3</p>
      <h1 className="mt-2 text-center font-display text-3xl text-navy-950">Build RSVP / Form</h1>

      {step === 1 ? (
        <div className="mt-8">
          <p className="text-center text-sm text-navy-700/60">What kind of RSVP is this?</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {FORM_CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => selectCategory(option.value)}
                className="rounded-xl border border-navy-950/10 bg-white p-4 text-left transition-luxury duration-200 hover:border-gold-500/50 hover:shadow-sm"
              >
                <p className="font-display text-base text-navy-950">{option.label}</p>
                <p className="mt-1 text-xs text-navy-700/50">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 2 && category ? (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-1.5 text-xs text-navy-700/50 hover:text-navy-950"
          >
            <ArrowLeft size={13} /> Change RSVP type
          </button>
          <p className="mt-4 text-center text-sm text-navy-700/60">How do you want to build your {FORM_CATEGORY_OPTIONS.find((o) => o.value === category)?.label} form?</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={chooseAi}
              disabled={creating !== null}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/5 p-6 text-center transition-luxury duration-200 hover:border-gold-500 disabled:opacity-60",
              )}
            >
              {creating === "ai" ? <Loader2 className="animate-spin text-gold-600" size={22} /> : <Sparkles className="text-gold-600" size={22} />}
              <span className="font-display text-base text-navy-950">Generate with AI</span>
              <span className="text-xs text-navy-700/60">Describe it or upload a photo of a form — AI builds the fields for you.</span>
            </button>

            <button
              type="button"
              onClick={chooseManual}
              disabled={creating !== null}
              className="flex flex-col items-center gap-2 rounded-xl border border-navy-950/10 bg-white p-6 text-center transition-luxury duration-200 hover:border-navy-950/25 disabled:opacity-60"
            >
              {creating === "manual" ? <Loader2 className="animate-spin text-navy-700" size={22} /> : <PencilLine className="text-navy-700" size={22} />}
              <span className="font-display text-base text-navy-950">Create It Yourself</span>
              <span className="text-xs text-navy-700/60">Start from a few suggested fields for this occasion and edit freely.</span>
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 && aiToken && category ? (
        <div className="mt-8">
          <AiFormGenerator
            token={aiToken}
            hasExistingFields={false}
            onGenerated={() => router.push(`/forms/build/${aiToken}`)}
          />
          <button
            type="button"
            onClick={() => router.push(`/forms/build/${aiToken}`)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs text-navy-700/50 hover:text-navy-950"
          >
            Skip — build it myself instead <ArrowRight size={13} />
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
