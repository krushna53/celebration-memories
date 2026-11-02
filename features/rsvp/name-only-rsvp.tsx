"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RsvpAttendanceField, type ConfiguredRsvpValues } from "@/features/rsvp/rsvp-config-fields";
import { submitNameOnlyRsvpAction } from "@/features/rsvp/public-rsvp-actions";
import { logRsvpStartedAction } from "@/features/tracking/actions";
import { buildRsvpSchema, type RsvpConfig } from "@/lib/rsvp-config";
import type { AttendanceOption } from "@/types/rsvp";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

interface NameOnlyRsvpProps {
  eventSlug: string;
  eventId: string;
  config: RsvpConfig;
  segment?: "family" | "corporate";
}

/**
 * The shared RSVP for events set to "name only" (RsvpConfig.nameOnly): a
 * name, the attendance choice and the host's own questions, which are
 * hidden for a guest who can't come. Several family members can reply one
 * after another from the same phone — "Add another reply" resets the form.
 */
export function NameOnlyRsvp({ eventSlug, eventId, config, segment = "family" }: NameOnlyRsvpProps) {
  const router = useRouter();
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ name: string; coming: AttendanceOption; picks: string[] } | null>(null);
  const [started, setStarted] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConfiguredRsvpValues>({
    resolver: zodResolver(buildRsvpSchema(config)),
    defaultValues: { name: "", adults: 1, children: 0, mealPreference: "no_preference", consent: true },
  });
  const coming = watch("coming");

  function trackStarted() {
    if (started) return;
    setStarted(true);
    logRsvpStartedAction(eventId, "public").catch(() => {});
  }

  async function onSubmit(values: ConfiguredRsvpValues) {
    setError(null);
    const answers = values.coming === "not_coming" ? {} : values.answers;
    const result = await submitNameOnlyRsvpAction(eventSlug, { ...values, answers }, honeypot);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const picks = config.questions.flatMap((q) => (answers?.[q.id] ? [answers[q.id]!] : []));
    setSent({ name: values.name, coming: values.coming, picks });
    reset();
    router.refresh();
  }

  if (sent) {
    return (
      <div className="rounded-3xl border border-gold-500/25 bg-white p-6 text-left shadow-sm sm:p-8" role="status">
        <p className="font-display text-xl text-navy-950">
          {sent.coming === "coming"
            ? `Thank you, ${sent.name.split(" ")[0]} — see you there!`
            : sent.coming === "maybe"
              ? `Thanks, ${sent.name.split(" ")[0]} — we’ve noted you might make it.`
              : `You’ll be missed, ${sent.name.split(" ")[0]}. Thank you for letting us know.`}
        </p>
        {sent.picks.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-navy-700">
            {sent.picks.map((pick) => (
              <li key={pick}>
                You picked: <span className="font-medium text-navy-950">{pick}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Button type="button" variant="outline" className="mt-5 w-full sm:w-auto" onClick={() => setSent(null)}>
          Add another reply
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onFocus={trackStarted}
      noValidate
      className="grid gap-5 rounded-3xl border border-gold-500/25 bg-white p-5 text-left shadow-sm sm:p-8"
    >
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor={`name-only-website-${eventId}`}>Leave this field blank</label>
        <input id={`name-only-website-${eventId}`} tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>

      <div>
        <label className={labelClasses} htmlFor={`name-only-name-${eventId}`}>
          Your name <span className="normal-case text-red-500">*</span>
        </label>
        <input
          id={`name-only-name-${eventId}`}
          className={cn(inputClasses, "mt-1.5", errors.name && "border-red-500")}
          autoComplete="name"
          maxLength={120}
          {...register("name")}
        />
        {errors.name ? (
          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <RsvpAttendanceField config={config} register={register} errors={errors} coming={coming} segment={segment} />

      {coming && coming !== "not_coming"
        ? config.questions.map((q) => {
            const error = errors.answers?.[q.id]?.message;
            const options = q.type === "yes_no" ? ["Yes", "No"] : q.options;
            return (
              <div key={q.id}>
                {q.type === "choice" || q.type === "yes_no" ? (
                  <fieldset>
                    <legend className={labelClasses}>
                      {q.label} {q.required ? <span className="normal-case text-red-500">*</span> : null}
                    </legend>
                    <div className="mt-2 grid gap-2">
                      {options.map((option) => (
                        <label
                          key={option}
                          className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-navy-950/15 px-4 py-3 text-sm text-navy-950 has-[:checked]:border-gold-500 has-[:checked]:bg-gold-500/10"
                        >
                          <input type="radio" value={option} className="h-4 w-4 accent-gold-600" {...register(`answers.${q.id}`)} />
                          {option}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <label className={cn(labelClasses, "grid gap-1.5")}>
                    <span>
                      {q.label} {q.required ? <span className="normal-case text-red-500">*</span> : null}
                    </span>
                    <input className={inputClasses} {...register(`answers.${q.id}`)} />
                  </label>
                )}
                {error ? (
                  <p className="mt-1 text-xs font-medium text-red-600" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })
        : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-navy-700/70">Your name and reply are shared with the host{config.showResponses ? " and shown in the guest list below" : ""}.</p>
      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto sm:justify-self-start">
        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
        Send my RSVP
      </Button>
    </form>
  );
}
