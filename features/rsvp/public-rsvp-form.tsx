"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { submitPublicRsvpAction } from "@/features/rsvp/public-rsvp-actions";
import { logRsvpStartedAction } from "@/features/tracking/actions";
import { RsvpPaymentPanel } from "@/features/rsvp-payment/rsvp-payment-panel";
import { WorkshopSessionPicker } from "@/features/rsvp/workshop-session-picker";
import type { RsvpPrice } from "@/lib/rsvp-pricing";
import type { RsvpFormValues } from "@/types/rsvp";
import { buildRsvpSchema, DEFAULT_RSVP_CONFIG, type RsvpConfig } from "@/lib/rsvp-config";
import {
  RsvpAttendanceField,
  RsvpDetailFields,
  type ConfiguredRsvpValues,
} from "@/features/rsvp/rsvp-config-fields";
import type { ScheduleItemRecord } from "@/types/content";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 transition-luxury duration-200 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

interface PublicRsvpFormProps {
  eventSlug: string;
  eventId: string;
  honoreeName: string;
  /** Non-null only when the event is a paid event with pricing configured (lib/rsvp-pricing.ts) — shows the payment step after a "coming" RSVP. */
  rsvpPrice?: RsvpPrice | null;
  /** Schedule items that require registration (#106) — shown as an optional "join a session" step after a "coming" RSVP. */
  workshopSessions?: ScheduleItemRecord[];
  /** The event's RSVP form setup (lib/rsvp-config.ts); omitted = the default form. Phone always stays required here. */
  rsvpConfig?: RsvpConfig;
}

/**
 * The self-service RSVP form for events with no per-guest invite link
 * (events.public_rsvp_enabled). Nearly identical to the token-based
 * RsvpForm, with two differences: phone is required (it's how a
 * returning guest gets matched back to their existing RSVP instead of
 * creating a duplicate — see services/public-rsvp.ts), and a hidden
 * honeypot field guards against bots since this page has no secret
 * token gating it.
 */
export function PublicRsvpForm({ eventSlug, eventId, honoreeName, rsvpPrice, workshopSessions, rsvpConfig }: PublicRsvpFormProps) {
  const config = rsvpConfig ?? DEFAULT_RSVP_CONFIG;
  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [submittedInviteeId, setSubmittedInviteeId] = useState<string | null>(null);
  const [submittedComing, setSubmittedComing] = useState<RsvpFormValues["coming"] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const startedTracked = useRef(false);

  function trackStarted() {
    if (startedTracked.current) return;
    startedTracked.current = true;
    logRsvpStartedAction(eventId, "public").catch(() => {});
  }

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ConfiguredRsvpValues>({
    resolver: zodResolver(buildRsvpSchema(config, { forcePhone: true })),
    defaultValues: {
      coming: "coming",
      adults: 1,
      children: 0,
      mealPreference: "no_preference",
    },
  });

  const coming = watch("coming");

  async function onSubmit(values: ConfiguredRsvpValues) {
    setServerError(null);
    if (!values.phone) {
      setError("phone", { type: "manual", message: "Please enter your phone number." });
      return;
    }
    const result = await submitPublicRsvpAction(eventSlug, values, honeypot);
    if (result.success) {
      setSubmittedName(values.name);
      setSubmittedInviteeId(result.inviteeId);
      setSubmittedComing(values.coming);
      setSubmitted(true);
    } else {
      setServerError(result.error);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-500/20 bg-white px-8 py-12 text-center shadow-sm">
        <CheckCircle2 className="text-gold-500" size={36} />
        <h3 className="font-display text-2xl text-navy-950">
          Thank you, {submittedName.split(" ")[0]}!
        </h3>
        <p className="max-w-sm text-sm text-navy-700/75">
          Your RSVP has been recorded. If you&rsquo;d like to update it later,
          return to this page and submit again with the same phone number.
        </p>
        <Button variant="outline" onClick={() => setSubmitted(false)}>
          Edit my RSVP
        </Button>
        {submittedComing === "coming" && rsvpPrice && submittedInviteeId ? (
          <div className="w-full text-left">
            <RsvpPaymentPanel source={{ mode: "public", eventSlug, inviteeId: submittedInviteeId }} price={rsvpPrice} />
          </div>
        ) : null}
        {submittedComing === "coming" && submittedInviteeId && workshopSessions && workshopSessions.length > 0 ? (
          <div className="w-full text-left">
            <WorkshopSessionPicker
              eventId={eventId}
              inviteeId={submittedInviteeId}
              sessions={workshopSessions}
              returnPath={`/events/${eventSlug}/rsvp`}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onFocusCapture={trackStarted}
      noValidate
      className="grid gap-6 rounded-2xl border border-gold-500/15 bg-white px-6 py-8 text-left shadow-sm sm:px-10 sm:py-10"
    >
      {/* Honeypot — hidden from real guests via CSS, left blank by them; bots that fill every field trip it. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Leave this field blank</label>
        <input
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <RsvpAttendanceField config={config} register={register} errors={errors} coming={coming} />

      <div>
        <label className={labelClasses} htmlFor="name">
          Full Name <span className="normal-case text-red-500">*</span>
        </label>
        <input
          id="name"
          aria-required="true"
          aria-invalid={errors.name ? "true" : "false"}
          className={cn(
            inputClasses,
            "mt-1.5",
            errors.name && "border-red-500 focus:border-red-500 focus:ring-red-500/30",
          )}
          placeholder="Your name"
          {...register("name")}
        />
        {errors.name ? (
          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <RsvpDetailFields
        config={config}
        register={register}
        errors={errors}
        publicMode
        commentsPlaceholder={`Dietary needs, well-wishes for ${honoreeName}, anything else...`}
      />

      <div
        className={cn(errors.consent && "-m-0.5 rounded-lg border border-red-300 bg-red-50/60 p-2.5")}
      >
        <label className="flex items-start gap-2.5 text-sm text-navy-700/80">
          <input
            type="checkbox"
            aria-invalid={errors.consent ? "true" : "false"}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-950/30 text-gold-500 focus:ring-gold-500/40"
            {...register("consent")}
          />
          <span>
            I agree that the details I provide here (name, contact info, and
            RSVP) may be stored and used by the host to plan this event. See
            the{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-600 underline underline-offset-2"
            >
              Privacy Notice
            </a>
            .
          </span>
        </label>
        {errors.consent ? (
          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
            {errors.consent.message}
          </p>
        ) : null}
      </div>

      {serverError ? (
        <p className="text-sm font-medium text-red-600" role="alert">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto sm:justify-self-start">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            Submitting...
          </>
        ) : (
          "Submit RSVP"
        )}
      </Button>
    </form>
  );
}
