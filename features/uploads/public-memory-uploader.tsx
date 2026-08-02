"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { ACTIONS, MediaUploadsSection, type View } from "@/features/uploads/media-uploads-section";
import { identifyPublicMemoryUploaderAction } from "@/features/uploads/public-memory-actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-3 text-base text-navy-950 placeholder:text-navy-700/40 transition-luxury duration-200 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

interface PublicMemoryUploaderProps {
  eventSlug: string;
  honoreeName: string;
}

interface StoredIdentity {
  token: string;
  firstName: string;
}

function storageKey(eventSlug: string): string {
  return `cm-public-memory-identity-${eventSlug}`;
}

/** Reads a previously-saved identity for this event, if any — guards every step since localStorage isn't available during SSR and a guest's saved value could in principle be malformed. */
function loadStoredIdentity(eventSlug: string): StoredIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(eventSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredIdentity>;
    if (typeof parsed.token === "string" && typeof parsed.firstName === "string") {
      return { token: parsed.token, firstName: parsed.firstName };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * One-screen client for the public "share a memory" page (no invite
 * token needed). Used to be two full-screen steps — type your name, tap
 * Continue, THEN see the six action icons — which was one screen and
 * one tap too many for guests less comfortable with phones (a specific,
 * explicit ask: make this easy for a senior citizen to get through
 * alone). Now the name field and the six big action icons show
 * together on one screen: tapping any icon immediately identifies the
 * guest with whatever name they've typed (defaulting to "Guest" if left
 * blank — never a hard stop) and drops straight into that action, via
 * MediaUploadsSection's `initialView` prop. No separate "Continue"
 * button, no second screen.
 *
 * The resolved identity (self-service token + first name) is saved to
 * localStorage once identified, scoped per event slug, so a guest who
 * navigates back or reloads doesn't get asked to identify themselves
 * again — see loadStoredIdentity above.
 */
export function PublicMemoryUploader({ eventSlug, honoreeName }: PublicMemoryUploaderProps) {
  const [name, setName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [pendingView, setPendingView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [identified, setIdentified] = useState<StoredIdentity | null>(null);
  const [quietSuccess, setQuietSuccess] = useState(false);

  useEffect(() => {
    const stored = loadStoredIdentity(eventSlug);
    if (stored) setIdentified(stored);
  }, [eventSlug]);

  async function handleActionTap(view: View) {
    if (identified) {
      setPendingView(view);
      return;
    }

    setError(null);
    setPendingView(view);
    try {
      const result = await identifyPublicMemoryUploaderAction(eventSlug, name.trim() || "Guest", honeypot);
      if (!result.success) {
        setError(result.error);
        setPendingView(null);
        return;
      }
      if (!result.token) {
        // Honeypot tripped — quietly show a generic thank-you, don't reveal the spam check.
        setQuietSuccess(true);
        return;
      }
      const identity: StoredIdentity = { token: result.token, firstName: result.firstName };
      setIdentified(identity);
      try {
        window.localStorage.setItem(storageKey(eventSlug), JSON.stringify(identity));
      } catch {
        // Storage can be unavailable (private browsing, quota) — the
        // guest can still upload this visit, they'd just be asked again
        // next time. Not worth failing the flow over.
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setPendingView(null);
    }
  }

  if (quietSuccess) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-500/20 bg-white px-8 py-12 text-center shadow-sm">
        <CheckCircle2 className="text-gold-500" size={36} />
        <h3 className="font-display text-2xl text-navy-950">Thank you!</h3>
      </div>
    );
  }

  if (identified && pendingView) {
    // No caption field here — this public, no-login page is meant to be
    // the fewest-taps path (a specific ask: easy enough for a senior
    // citizen to get through alone), and a caption is one more optional
    // field to consider on every single item. The personal /invite/
    // [token] page still shows it.
    return <MediaUploadsSection token={identified.token} initialView={pendingView} showCaption={false} />;
  }

  return (
    <div className="rounded-2xl border border-gold-500/15 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
      {/* Honeypot — hidden from real visitors via CSS, left blank by them; bots that fill every field trip it. */}
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

      {!identified ? (
        <div className="mb-6">
          <label className="text-sm font-medium text-navy-950" htmlFor="uploader-name">
            Your Name <span className="font-normal text-navy-700/50">(optional)</span>
          </label>
          <input
            id="uploader-name"
            className={cn(inputClasses, "mt-2")}
            placeholder={`e.g. Priya (${honoreeName.split(" ")[0]}'s niece)`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="mt-2 text-sm text-navy-700/60">
            Tap a button below to get started — we&rsquo;ll use this name to let {honoreeName} know who each memory
            is from.
          </p>
        </div>
      ) : (
        <p className="mb-6 text-center text-sm text-navy-700/70">
          Thanks, {identified.firstName} — tap a button below to share a memory.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACTIONS.map(({ view: target, label, icon: Icon, isRecordAction }) => (
          <button
            key={target}
            type="button"
            disabled={pendingView !== null}
            onClick={() => handleActionTap(target)}
            className="tap-target group relative flex flex-col items-center gap-2 rounded-xl border border-navy-950/10 bg-ivory-50 px-3 py-6 text-center transition-luxury duration-200 hover:border-gold-500 hover:bg-gold-500/5 disabled:opacity-60"
          >
            {isRecordAction ? (
              <span className="absolute right-2 top-2 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500">
                <Circle size={6} className="fill-white text-white" />
              </span>
            ) : null}
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-600 transition-luxury duration-200 group-hover:bg-gold-500/25">
              {pendingView === target ? <Loader2 size={22} className="animate-spin" /> : <Icon size={22} />}
            </span>
            <span className="text-sm font-medium text-navy-950">{label}</span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-6 text-center text-xs text-navy-700/50">
        Your memories are reviewed before appearing on the public Memory Wall.
      </p>
    </div>
  );
}
