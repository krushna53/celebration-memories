"use client";

import { X } from "lucide-react";

import { GoogleAuthButton } from "@/features/admin/auth/google-auth-button";

/**
 * Wedding Design step (app/start/[token]/design): shown after Save & Continue when nobody is logged in. The design
 * is already saved on the draft by then. "Continue with Google" comes back through /auth/callback, which links this
 * draft to the account (`link_event_id`, an unclaimed draft only) and lands on Event Details with ?from=design.
 *
 * Google only returns to an address listed in Supabase → Authentication → URL Configuration → Redirect URLs
 * (e.g. http://localhost:3000/** and the deploy-preview pattern); anywhere else Supabase falls back to the Site URL.
 */
export function DesignLoginDialog({
  token,
  eventId,
  onClose,
}: {
  token: string;
  eventId: string;
  onClose: () => void;
}) {
  const next = `/start/${token}/basics?from=design`;
  const callback = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&link_event_id=${encodeURIComponent(eventId)}`;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-navy-950/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="design-login-title"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-white p-7 text-navy-950 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-navy-700/60 hover:bg-navy-950/5 hover:text-navy-950"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-gold-600">Your design is saved</p>
        <h2 id="design-login-title" className="mt-1 font-display text-2xl">Log in to continue</h2>
        <p className="mt-2 text-sm text-navy-700/70">
          Log in with Google to keep your wedding website. We&rsquo;ll take you straight to your event details.
        </p>
        <div className="mt-6">
          <GoogleAuthButton label="Continue with Google" redirectTo={typeof window !== "undefined" ? callback() : ""} />
        </div>
      </div>
    </div>
  );
}
