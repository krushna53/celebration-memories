"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronDown, Heart, HelpCircle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GoogleAuthButton } from "@/features/admin/auth/google-auth-button";
import { PublicRsvpForm } from "@/features/rsvp/public-rsvp-form";
import { RsvpDetailFields, type ConfiguredRsvpValues } from "@/features/rsvp/rsvp-config-fields";
import {
  getQuickRsvpGuestAction,
  quickRsvpNameOnlyAction,
  quickRsvpSignedInAction,
  saveQuickRsvpDetailsAction,
  type QuickRsvpGuest,
} from "@/features/rsvp/quick-rsvp-actions";
import { logRsvpStartedAction } from "@/features/tracking/actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { attendanceOptions, buildRsvpSchema, DEFAULT_RSVP_CONFIG, type RsvpConfig } from "@/lib/rsvp-config";
import type { AttendanceOption } from "@/types/rsvp";

const ICONS = { coming: Check, maybe: HelpCircle, not_coming: Heart } as const;
const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

/** Survives the Google round-trip, so coming back from sign-in finishes the "Yes" without another tap. */
const intentKey = (eventId: string) => `quick-rsvp-intent:${eventId}`;

interface QuickRsvpProps {
  eventSlug: string;
  eventId: string;
  honoreeName: string;
  rsvpConfig?: RsvpConfig;
  segment?: "family" | "corporate";
}

/**
 * The 3-click public RSVP: Yes → Confirm with Google → pick your account,
 * and you're on the host's guest list (services/quick-rsvp.ts). Maybe / No
 * take just a name. After a Yes, the full form (headcount, meal, phone,
 * the host's own questions) is an optional collapsible block. Guests
 * without a Google account can still use the original phone-based form.
 */
export function QuickRsvp({ eventSlug, eventId, honoreeName, rsvpConfig, segment = "family" }: QuickRsvpProps) {
  const config = rsvpConfig ?? DEFAULT_RSVP_CONFIG;
  const options = attendanceOptions(config, segment);
  const [ready, setReady] = useState(false);
  const [guest, setGuest] = useState<QuickRsvpGuest | null>(null);
  const [choice, setChoice] = useState<AttendanceOption | null>(null);
  const [answered, setAnswered] = useState<AttendanceOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [fullForm, setFullForm] = useState(false);
  const [redirectTo, setRedirectTo] = useState("");
  const startedTracked = useRef(false);

  function trackStarted() {
    if (startedTracked.current) return;
    startedTracked.current = true;
    logRsvpStartedAction(eventId, "public").catch(() => {});
  }

  async function answerSignedIn(value: AttendanceOption) {
    setSaving(true);
    setError(null);
    const result = await quickRsvpSignedInAction(eventSlug, value);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setGuest(result.data);
    setAnswered(value);
    setChoice(value);
  }

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    if (url.searchParams.has("auth_error")) setError("Google sign-in wasn't completed. Please try again.");
    url.searchParams.delete("auth_error");
    setRedirectTo(`${url.origin}/auth/callback?next=${encodeURIComponent(`${url.pathname}${url.search}#rsvp`)}`);

    getQuickRsvpGuestAction(eventSlug)
      .then(async (result) => {
        if (!active || !result.success) return;
        setGuest(result.data);
        let pending: string | null = null;
        try {
          pending = sessionStorage.getItem(intentKey(eventId));
          sessionStorage.removeItem(intentKey(eventId));
        } catch {
          // Storage blocked — the guest just taps Yes once more after signing in.
        }
        if (result.data && pending === "coming") {
          await answerSignedIn("coming");
        } else if (result.data?.coming) {
          setAnswered(result.data.coming);
          setChoice(result.data.coming);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
    // answerSignedIn only reads stable values; run once per event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug, eventId]);

  function choose(value: AttendanceOption) {
    trackStarted();
    setError(null);
    setChoice(value);
    if (guest) {
      void answerSignedIn(value);
      return;
    }
    setAnswered(null);
    try {
      if (value === "coming") sessionStorage.setItem(intentKey(eventId), "coming");
      else sessionStorage.removeItem(intentKey(eventId));
    } catch {
      // Optional — see the effect above.
    }
  }

  async function sendNameOnly() {
    if (!choice || choice === "coming") return;
    setSaving(true);
    setError(null);
    const result = await quickRsvpNameOnlyAction(eventSlug, name, choice, honeypot);
    setSaving(false);
    if (result.success) setAnswered(choice);
    else setError(result.error);
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    setGuest(null);
    setAnswered(null);
    setChoice(null);
  }

  if (fullForm) {
    return (
      <div className="grid gap-4">
        <PublicRsvpForm eventSlug={eventSlug} eventId={eventId} honoreeName={honoreeName} rsvpConfig={rsvpConfig} segment={segment} />
        <button type="button" className="text-sm text-gold-700 underline underline-offset-4" onClick={() => setFullForm(false)}>
          Back to the quick RSVP
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-gold-500/25 bg-white p-5 text-left shadow-sm sm:p-8">
      <fieldset disabled={!ready || saving} className="space-y-3">
        <legend className="sr-only">Will you be joining us?</legend>
        {options.map(({ value, label }) => {
          const Icon = ICONS[value];
          return (
            <label
              key={value}
              className={cn(
                "flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-4 transition-colors",
                choice === value ? "border-gold-500 bg-gold-500/10 text-navy-950" : "border-navy-950/10 text-navy-700 hover:bg-ivory-50",
              )}
            >
              <input
                type="radio"
                name={`quick-rsvp-${eventId}`}
                value={value}
                checked={choice === value}
                onChange={() => choose(value)}
                className="h-4 w-4 accent-gold-600"
              />
              <Icon size={19} aria-hidden="true" />
              <span className="font-medium">{label}</span>
            </label>
          );
        })}
      </fieldset>

      {!ready || saving ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-navy-700" role="status">
          <Loader2 size={14} className="animate-spin" /> {ready ? "Saving your reply…" : "Getting your RSVP ready…"}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {ready && !guest && choice === "coming" ? (
        <div className="mt-5 space-y-3">
          <GoogleAuthButton redirectTo={redirectTo} label="Confirm with Google" />
          <p className="text-center text-xs text-navy-700/80">
            Your name and email come from your Google account. By confirming you agree they may be stored and used by the
            host to plan this event (
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Privacy Notice
            </a>
            ).
          </p>
          <button type="button" className="block w-full text-center text-sm text-gold-700 underline underline-offset-4" onClick={() => setFullForm(true)}>
            No Google account? Fill in the form instead
          </button>
        </div>
      ) : null}

      {ready && !guest && choice && choice !== "coming" && answered !== choice ? (
        <div className="mt-5 grid gap-3">
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <label htmlFor={`quick-rsvp-website-${eventId}`}>Leave this field blank</label>
            <input id={`quick-rsvp-website-${eventId}`} tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </div>
          <label className={cn(labelClasses, "grid gap-1.5")}>
            Your name
            <input className={inputClasses} value={name} maxLength={120} autoComplete="name" onChange={(e) => setName(e.target.value)} />
          </label>
          <p className="text-xs text-navy-700/70">Your name and reply are shared with the host only.</p>
          <Button type="button" onClick={sendNameOnly} disabled={saving} className="w-full sm:w-auto">
            Send my reply
          </Button>
        </div>
      ) : null}

      {answered ? (
        <div className="mt-5 rounded-2xl bg-ivory-50 p-4" role="status">
          <p className="font-medium text-navy-950">
            {answered === "coming" ? "You’re on the list!" : answered === "maybe" ? "Thanks — we’ve let the host know you might make it." : "You’ll be missed. Thank you for letting us know."}
          </p>
          {guest ? (
            <p className="mt-1 break-words text-sm text-navy-700">
              {guest.name}
              {guest.email ? ` · ${guest.email}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {guest && answered === "coming" ? <DetailsBlock eventSlug={eventSlug} config={config} guest={guest} honoreeName={honoreeName} segment={segment} /> : null}

      {guest ? (
        <p className="mt-5 text-center text-xs text-navy-700/70">
          Not {guest.name.split(" ")[0]}?{" "}
          <button type="button" className="underline underline-offset-2" onClick={signOut}>
            Sign out
          </button>
        </p>
      ) : null}
    </div>
  );
}

/** "Fill in the form" — optional extras after a confirmed Yes, collapsed by default. */
function DetailsBlock({
  eventSlug,
  config,
  guest,
  honoreeName,
  segment,
}: {
  eventSlug: string;
  config: RsvpConfig;
  guest: QuickRsvpGuest;
  honoreeName: string;
  segment: "family" | "corporate";
}) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ConfiguredRsvpValues>({
    resolver: zodResolver(buildRsvpSchema(config)),
    defaultValues: {
      name: guest.name,
      email: guest.email,
      phone: guest.phone ?? "",
      coming: "coming",
      adults: 1,
      children: 0,
      mealPreference: "no_preference",
      consent: true,
    },
  });

  async function onSubmit(values: ConfiguredRsvpValues) {
    setMessage(null);
    const result = await saveQuickRsvpDetailsAction(eventSlug, values);
    setMessage(result.success ? { ok: true, text: "Details saved — thank you!" } : { ok: false, text: result.error });
  }

  return (
    <details className="group mt-5 rounded-2xl border border-navy-950/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-navy-950">
        <span>
          Fill in the form <span className="font-normal text-navy-700/70">(optional — guests, meal, phone)</span>
        </span>
        <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 border-t border-navy-950/10 px-4 py-5">
        <div>
          <label className={labelClasses} htmlFor="quick-rsvp-name">
            Full Name
          </label>
          <input id="quick-rsvp-name" className={cn(inputClasses, "mt-1.5")} {...register("name")} />
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
            segment === "corporate" ? "Questions, accessibility needs, anything else we should know..." : `Dietary needs, well-wishes for ${honoreeName}, anything else...`
          }
        />
        {message ? (
          <p className={message.ok ? "text-sm text-green-700" : "text-sm text-red-600"} role="status">
            {message.text}
          </p>
        ) : null}
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto sm:justify-self-start">
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
          Save details
        </Button>
      </form>
    </details>
  );
}
