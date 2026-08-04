"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { ACTIONS, MediaUploadsSection, type View } from "@/features/uploads/media-uploads-section";
import {
  identifyPublicMemoryUploaderAction,
  renamePublicMemoryUploaderAction,
} from "@/features/uploads/public-memory-actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-3 text-base text-navy-950 placeholder:text-navy-700/40 transition-luxury duration-200 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

interface PublicMemoryUploaderProps {
  eventSlug: string;
  honoreeName: string;
}

interface StoredIdentity {
  token: string;
  firstName: string;
  /** True if this identity was created with a blank name (defaulted to the literal "Guest" server-side) — lets video actions detect they still need a real name from this guest, even though they're already identified for every other action. */
  isPlaceholder: boolean;
}

/**
 * A real name is required for every action now — photo, audio, and
 * note included, not just the two video actions. Used to be video-only
 * (see git history for the old fewest-taps reasoning), but that let a
 * guest tap "Photo"/"Note"/"Audio" without typing a name and get
 * silently identified as the literal placeholder "Guest" server-side,
 * permanently — nothing ever prompted them again unless they later
 * happened to tap a video action too. A host reviewing the Memory Wall
 * has no way to know who a "Guest" upload is actually from, so this
 * closes that gap for every upload type.
 */
function requiresRealName(): boolean {
  return true;
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
      return { token: parsed.token, firstName: parsed.firstName, isPlaceholder: parsed.isPlaceholder === true };
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
 * guest with whatever name they've typed and drops straight into that
 * action, via MediaUploadsSection's `initialView` prop. No separate
 * "Continue" button, no second screen.
 *
 * Name is required for every action — see requiresRealName. A blank
 * name is rejected with an inline error instead of silently falling
 * back to a placeholder, since every memory (photo, video, audio, or
 * note) carries a personal message and the host specifically wants to
 * know who it's from.
 *
 * The resolved identity (self-service token + first name) is saved to
 * localStorage once identified, scoped per event slug, so a guest who
 * navigates back or reloads doesn't get asked to identify themselves
 * again — see loadStoredIdentity above. `isPlaceholder`/`renamingFor`
 * remain as a fallback for guests who were already identified as the
 * literal "Guest" before this requirement existed (an already-stored
 * localStorage identity from a prior visit) — new identifications can
 * no longer end up in that state.
 */
export function PublicMemoryUploader({ eventSlug, honoreeName }: PublicMemoryUploaderProps) {
  const [name, setName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [pendingView, setPendingView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [identified, setIdentified] = useState<StoredIdentity | null>(null);
  const [quietSuccess, setQuietSuccess] = useState(false);
  // Set only for the already-identified-with-a-placeholder-name edge
  // case above — holds the video view the guest was trying to reach so
  // the inline prompt can resume straight into it once a real name is
  // saved.
  const [renamingFor, setRenamingFor] = useState<View | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  // True only while `error` specifically means "the name field is
  // empty" — distinct from other errors (network failure, server
  // rejection) so the name input's border only turns red for the one
  // case it can actually fix.
  const [nameFieldError, setNameFieldError] = useState(false);

  useEffect(() => {
    const stored = loadStoredIdentity(eventSlug);
    if (stored) setIdentified(stored);
  }, [eventSlug]);

  async function handleActionTap(view: View) {
    setError(null);
    setNameFieldError(false);

    if (identified) {
      if (requiresRealName() && identified.isPlaceholder) {
        setRenamingFor(view);
        return;
      }
      setPendingView(view);
      return;
    }

    const trimmedName = name.trim();
    if (requiresRealName() && !trimmedName) {
      setError("Please enter your name to continue.");
      setNameFieldError(true);
      return;
    }

    setPendingView(view);
    try {
      const result = await identifyPublicMemoryUploaderAction(eventSlug, trimmedName, honeypot);
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
      const identity: StoredIdentity = {
        token: result.token,
        firstName: result.firstName,
        isPlaceholder: !trimmedName,
      };
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

  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identified || !renamingFor) return;

    const trimmed = renameValue.trim();
    if (!trimmed) {
      setError("Please enter your name to continue.");
      setNameFieldError(true);
      return;
    }

    setError(null);
    setNameFieldError(false);
    setIsRenaming(true);
    try {
      const result = await renamePublicMemoryUploaderAction(identified.token, trimmed);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const updated: StoredIdentity = {
        ...identified,
        firstName: trimmed.split(" ")[0] || trimmed,
        isPlaceholder: false,
      };
      setIdentified(updated);
      try {
        window.localStorage.setItem(storageKey(eventSlug), JSON.stringify(updated));
      } catch {
        // Same non-fatal storage note as above.
      }
      setPendingView(renamingFor);
      setRenamingFor(null);
      setRenameValue("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsRenaming(false);
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

  if (renamingFor) {
    return (
      <div className="rounded-2xl border border-gold-500/15 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <form onSubmit={handleRenameSubmit}>
          <label className="text-sm font-medium text-navy-950" htmlFor="rename-uploader">
            Your Name <span className="normal-case text-red-500">*</span>
          </label>
          <input
            id="rename-uploader"
            autoFocus
            aria-required="true"
            aria-invalid={nameFieldError ? "true" : "false"}
            className={cn(
              inputClasses,
              "mt-2",
              nameFieldError && "border-red-500 focus:border-red-500 focus:ring-red-500/30",
            )}
            placeholder={`e.g. Priya (${honoreeName.split(" ")[0]}'s niece)`}
            value={renameValue}
            onChange={(e) => {
              setRenameValue(e.target.value);
              if (nameFieldError) setNameFieldError(false);
            }}
          />
          <p className="mt-2 text-sm text-navy-700/60">
            A name is needed for a video message so {honoreeName} knows who it&rsquo;s from.
          </p>

          {error ? (
            <p className="mt-3 text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={isRenaming}
              className="tap-target flex items-center gap-2 rounded-full bg-gold-500 px-6 py-2.5 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:brightness-110 disabled:opacity-60"
            >
              {isRenaming ? <Loader2 className="animate-spin" size={16} /> : null}
              Continue
            </button>
            <button
              type="button"
              onClick={() => {
                setRenamingFor(null);
                setRenameValue("");
                setError(null);
              }}
              disabled={isRenaming}
              className="tap-target text-sm font-medium text-navy-700/60 hover:text-navy-950"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
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
            Your Name <span className="normal-case text-red-500">*</span>
          </label>
          <input
            id="uploader-name"
            aria-invalid={nameFieldError ? "true" : "false"}
            className={cn(
              inputClasses,
              "mt-2",
              nameFieldError && "border-red-500 focus:border-red-500 focus:ring-red-500/30",
            )}
            placeholder={`e.g. Priya (${honoreeName.split(" ")[0]}'s niece)`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameFieldError) setNameFieldError(false);
            }}
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
        <p className="mt-4 text-center text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-6 text-center text-xs text-navy-700/50">
        Your memories are reviewed before appearing on the public Memory Wall.
      </p>
    </div>
  );
}
