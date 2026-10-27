"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { submitRsvpAction } from "@/features/rsvp/actions";
import { logRsvpStartedAction } from "@/features/tracking/actions";
import { NotificationPrompt } from "@/features/push/notification-prompt";
import { RsvpPaymentPanel } from "@/features/rsvp-payment/rsvp-payment-panel";
import { WorkshopSessionPicker } from "@/features/rsvp/workshop-session-picker";
import type { RsvpPrice } from "@/lib/rsvp-pricing";
import type { RsvpFormValues } from "@/types/rsvp";
import { attendanceOptions, buildRsvpSchema, DEFAULT_RSVP_CONFIG, type RsvpConfig } from "@/lib/rsvp-config";
import {
  RsvpAttendanceField,
  RsvpDetailFields,
  type ConfiguredRsvpValues,
} from "@/features/rsvp/rsvp-config-fields";
import type { ScheduleItemRecord } from "@/types/content";
import { StoryShareButton, type StoryCard } from "@/features/share/story-share-button";
import { ConsentPhotoPicker } from "@/features/reels/consent-photo-picker";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 transition-luxury duration-200 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

interface RsvpFormProps {
  token: string;
  eventId: string;
  inviteeId: string;
  defaultValues: Partial<ConfiguredRsvpValues>;
  /** The event's RSVP form setup (lib/rsvp-config.ts); omitted = the default form. */
  rsvpConfig?: RsvpConfig;
  /** Corporate-type events get professional default wording (attendance choices, comments hint). */
  segment?: "family" | "corporate";
  guestName: string;
  /** Non-null only when the event is a paid event with pricing configured (lib/rsvp-pricing.ts) — shows the payment step after a "coming" RSVP. */
  rsvpPrice?: RsvpPrice | null;
  /** Schedule items that require registration (#106) — shown as an optional "join a session" step after a "coming" RSVP. Empty/omitted for events with no such sessions (the common case). */
  workshopSessions?: ScheduleItemRecord[];
  /** Push-reminder prompt after a yes/maybe — segment-specific copy (lib/event-segment.ts). */
  reminderMessage?: string;
  /** Event details for the "I'm going!" Story card shown after a "coming" RSVP; the link points at the public event page. */
  story?: { card: StoryCard; shareText: string };
  /** Set when the host has turned on Guest Reels — offers an optional selfie (with consent) so the guest can be found in the event photos. */
  reelSelfie?: { photoUrl: string | null; honoreeName: string; hostedBy: string };
}

export function RsvpForm({
  token,
  eventId,
  inviteeId,
  defaultValues,
  guestName,
  rsvpPrice,
  workshopSessions,
  reminderMessage = "Get a reminder to share a photo or video memory before the big day?",
  story,
  reelSelfie,
  rsvpConfig,
  segment = "family",
}: RsvpFormProps) {
  const config = rsvpConfig ?? DEFAULT_RSVP_CONFIG;
  const [submitted, setSubmitted] = useState(false);
  const [submittedComing, setSubmittedComing] = useState<RsvpFormValues["coming"] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  // A guest who hasn't answered yet gets one-tap buttons first (their invite link already identifies them);
  // the full form is one tap away, and opens by itself when the host requires details the guest hasn't given.
  const [quick, setQuick] = useState(!defaultValues.coming);
  const [quickSaving, setQuickSaving] = useState(false);
  const startedTracked = useRef(false);

  function trackStarted() {
    if (startedTracked.current) return;
    startedTracked.current = true;
    logRsvpStartedAction(eventId, "token").catch(() => {});
  }

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ConfiguredRsvpValues>({
    resolver: zodResolver(buildRsvpSchema(config)),
    defaultValues: {
      name: guestName,
      coming: "coming",
      adults: 1,
      children: 0,
      mealPreference: "no_preference",
      ...defaultValues,
    },
  });

  const coming = watch("coming");

  async function answerInOneTap(value: RsvpFormValues["coming"]) {
    trackStarted();
    setServerError(null);
    setQuickSaving(true);
    const result = await submitRsvpAction(token, {
      name: guestName,
      adults: 1,
      children: 0,
      mealPreference: "no_preference",
      ...defaultValues,
      coming: value,
      consent: true,
    });
    setQuickSaving(false);
    if (result.success) {
      setSubmitted(true);
      setSubmittedComing(value);
    } else {
      setQuick(false);
      setServerError("Almost there — please fill in the details below.");
    }
  }

  async function onSubmit(values: ConfiguredRsvpValues) {
    setServerError(null);
    const result = await submitRsvpAction(token, values);
    if (result.success) {
      setSubmitted(true);
      setSubmittedComing(values.coming);
    } else {
      setServerError(result.error);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-500/20 bg-white px-8 py-12 text-center shadow-sm">
        <CheckCircle2 className="text-gold-500" size={36} />
        <h3 className="font-display text-2xl text-navy-950">
          Thank you, {guestName.split(" ")[0]}!
        </h3>
        <p className="max-w-sm text-sm text-navy-700/75">
          Your RSVP has been recorded. You can revisit this link anytime to
          update your response.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setQuick(false);
            setSubmitted(false);
          }}
        >
          {submittedComing === "coming" ? "Add details (guests, meal) or edit" : "Edit my RSVP"}
        </Button>
        {submittedComing === "coming" && story ? (
          <StoryShareButton card={story.card} shareText={story.shareText} fileName="im-going" label="Tell your friends — share to your Story" />
        ) : null}
        {submittedComing === "coming" && rsvpPrice ? (
          <div className="w-full text-left">
            <RsvpPaymentPanel source={{ mode: "token", token }} price={rsvpPrice} />
          </div>
        ) : null}
        {submittedComing === "coming" && workshopSessions && workshopSessions.length > 0 ? (
          <div className="w-full text-left">
            <WorkshopSessionPicker eventId={eventId} inviteeId={inviteeId} sessions={workshopSessions} returnPath={`/invite/${token}`} />
          </div>
        ) : null}
        {submittedComing === "coming" || submittedComing === "maybe" ? (
          <div className="w-full text-left">
            <NotificationPrompt
              token={token}
              message={reminderMessage}
              buttonLabel="Notify me"
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (quick) {
    const options = attendanceOptions(config, segment);
    const others = options.filter((o) => o.value !== "coming");
    return (
      <div className="grid gap-4 rounded-2xl border border-gold-500/15 bg-white px-6 py-8 text-center shadow-sm sm:px-10">
        <p className={labelClasses}>Will you be joining us?</p>
        <Button type="button" size="lg" onClick={() => answerInOneTap("coming")} disabled={quickSaving} className="w-full">
          {quickSaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={18} />}
          {options.find((o) => o.value === "coming")?.label ?? "Yes, I'll be there"}
        </Button>
        <div className={cn("grid gap-2", others.length > 1 && "sm:grid-cols-2")}>
          {others.map((option) => (
            <Button key={option.value} type="button" variant="outline" onClick={() => answerInOneTap(option.value)} disabled={quickSaving}>
              {option.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-navy-700/70">
          One tap and you&rsquo;re done — your reply is saved under {guestName}. By replying you agree the host may store it
          to plan this event (
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            Privacy Notice
          </a>
          ).
        </p>
        <button type="button" className="text-sm text-gold-700 underline underline-offset-4" onClick={() => setQuick(false)}>
          Fill in the full form instead (guests, meal, comments)
        </button>
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
      <RsvpAttendanceField config={config} register={register} errors={errors} coming={coming} segment={segment} />

      {/* Name */}
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
        commentsPlaceholder={
          segment === "corporate"
            ? "Questions, accessibility needs, anything else we should know..."
            : "Dietary needs, well-wishes, anything else we should know..."
        }
      />

      {reelSelfie && coming !== "not_coming" ? (
        <div className="rounded-xl border border-gold-500/20 bg-ivory-50 p-4">
          <p className={labelClasses}>
            Your personal reel <span className="normal-case tracking-normal text-navy-700/50">(optional)</span>
          </p>
          <p className="mt-1.5 text-sm text-navy-700/75">
            After the celebration we&apos;ll make you a short video of the photos you&apos;re in with{" "}
            {reelSelfie.honoreeName} — ready to share on Instagram or WhatsApp. Add a clear selfie so we can find you.
          </p>
          <div className="mt-3">
            <ConsentPhotoPicker
              target={{ kind: "guest", token }}
              currentPhotoUrl={reelSelfie.photoUrl}
              consentLabel={
                <>
                  I agree that {reelSelfie.hostedBy} may use this photo to recognise my face in this event&apos;s photos and
                  make a personal reel for me. It&apos;s used only for this event, and I can remove it at any time from this page.
                </>
              }
            />
          </div>
        </div>
      ) : null}

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

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="w-full sm:w-auto sm:justify-self-start"
      >
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
