"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, HeartHandshake, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MediaUploadsSection } from "@/features/uploads/media-uploads-section";
import { identifyPublicMemoryUploaderAction } from "@/features/uploads/public-memory-actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 transition-luxury duration-200 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

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
 * Two-step client for the public "share a memory" page (no invite token
 * needed): a name-only identification form, then — once identified — the
 * exact same <MediaUploadsSection> used on personal /invite/[token]
 * pages, so uploads land in the normal approval queue and Memory Wall.
 * See features/uploads/public-memory-actions.ts for the server side.
 *
 * The identity (self-service token + first name) is saved to
 * localStorage once entered — without this, a guest tapping their
 * browser's back button (or the page reloading) lost the in-memory
 * `identified` state and got asked to type their name again, even
 * though they'd already been issued a working token. Scoped per event
 * slug so visiting a different event's page doesn't reuse the name.
 */
export function PublicMemoryUploader({ eventSlug, honoreeName }: PublicMemoryUploaderProps) {
  const [name, setName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identified, setIdentified] = useState<StoredIdentity | null>(null);
  const [quietSuccess, setQuietSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadStoredIdentity(eventSlug);
    if (stored) setIdentified(stored);
  }, [eventSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await identifyPublicMemoryUploaderAction(eventSlug, name, honeypot);
      if (!result.success) {
        setError(result.error);
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
    } finally {
      setSubmitting(false);
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

  if (identified) {
    return (
      <div className="grid gap-4">
        <div className="flex items-center gap-2 rounded-xl border border-gold-500/15 bg-gold-500/5 px-4 py-3 text-sm text-navy-700/80">
          <HeartHandshake className="shrink-0 text-gold-500" size={18} />
          Thanks, {identified.firstName} — upload as many memories as you&rsquo;d like below.
        </div>
        <MediaUploadsSection token={identified.token} />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-5 rounded-2xl border border-gold-500/15 bg-white px-6 py-8 text-left shadow-sm sm:px-10 sm:py-10"
    >
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

      <div>
        <label className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70" htmlFor="uploader-name">
          Your Name
        </label>
        <input
          id="uploader-name"
          ref={inputRef}
          className={cn(inputClasses, "mt-1.5")}
          placeholder={`e.g. Priya (${honoreeName.split(" ")[0]}'s niece)`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <p className="mt-1.5 text-[11px] text-navy-700/50">
          Just your name — no account or phone number needed. This lets{" "}
          {honoreeName} know who each memory is from.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto sm:justify-self-start">
        {submitting ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            One moment...
          </>
        ) : (
          "Continue to Upload"
        )}
      </Button>
    </form>
  );
}
