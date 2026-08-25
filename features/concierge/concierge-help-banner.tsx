"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Headphones, Loader2, X } from "lucide-react";

import { submitConciergeInquiryAction } from "@/features/concierge/actions";

const DISMISS_KEY = "em_concierge_dismissed";

/** Routes where the banner must never appear. */
const HIDDEN_ON_PATHS = ["/display"];
/** Routes where the banner must never appear (exact match). */
const HIDDEN_ON_EXACT = ["/"];

const COUNTRY_CODES = [
  { code: "+91", flag: "🇮🇳", label: "India" },
  { code: "+1",  flag: "🇺🇸", label: "USA" },
  { code: "+44", flag: "🇬🇧", label: "UK" },
  { code: "+971", flag: "🇦🇪", label: "UAE" },
  { code: "+61", flag: "🇦🇺", label: "Australia" },
  { code: "+65", flag: "🇸🇬", label: "Singapore" },
  { code: "+60", flag: "🇲🇾", label: "Malaysia" },
  { code: "+1-CA", flag: "🇨🇦", label: "Canada" },
];

export function ConciergeHelpBanner() {
  const pathname = usePathname();

  // Never show on full-screen kiosk/display routes or the platform homepage
  if (HIDDEN_ON_PATHS.some((p) => pathname.endsWith(p))) return null;
  if (HIDDEN_ON_EXACT.includes(pathname)) return null;

  const [visible, setVisible] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const phoneRef = useRef<HTMLInputElement>(null);

  // Check dismiss state after hydration
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(DISMISS_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      phoneRef.current?.focus();
      return;
    }
    setState("loading");
    setErrorMsg("");
    const result = await submitConciergeInquiryAction(phone, countryCode, pathname);
    if (result.success) {
      setState("success");
      setTimeout(() => setVisible(false), 2800);
    } else {
      setState("error");
      setErrorMsg(result.error);
    }
  }

  if (!visible) return null;

  return (
    <div className="relative z-50 w-full border-b border-navy-950/10 bg-ivory-100 px-4 py-2.5 shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2">
        {/* Icon + copy */}
        <div className="flex items-center gap-2.5 text-navy-950">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-gold-700">
            <Headphones size={14} />
          </span>
          <p className="text-xs leading-snug text-navy-700/80 sm:text-sm">
            <span className="font-semibold text-navy-950">Are you feeling stuck?</span>{" "}
            Let a concierge help you. Add a phone number where we can reach you.
          </p>
        </div>

        {/* Form */}
        {state === "success" ? (
          <div className="ml-auto flex items-center gap-1.5 text-sm font-medium text-green-700">
            <Check size={15} />
            We&apos;ll reach out shortly!
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="ml-auto flex items-center gap-2"
          >
            {/* Country code picker */}
            <div className="flex items-center gap-1 rounded-lg border border-navy-950/15 bg-white px-2 py-1.5">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="appearance-none bg-transparent text-xs text-navy-950 focus:outline-none"
                aria-label="Country code"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code.replace("-CA", "")}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone input */}
            <input
              ref={phoneRef}
              type="tel"
              inputMode="numeric"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d\s\-()]/g, ""))}
              maxLength={15}
              className="w-32 rounded-lg border border-navy-950/15 bg-white px-3 py-1.5 text-xs text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 sm:w-40"
            />

            <button
              type="submit"
              disabled={state === "loading"}
              className="flex items-center gap-1.5 rounded-lg bg-navy-950 px-3 py-1.5 text-xs font-semibold text-ivory-50 transition hover:bg-navy-800 disabled:opacity-60"
            >
              {state === "loading" ? <Loader2 size={12} className="animate-spin" /> : null}
              Submit
            </button>

            {state === "error" && errorMsg ? (
              <p className="text-xs text-red-600">{errorMsg}</p>
            ) : null}
          </form>
        )}

        {/* Dismiss */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-navy-700/40 hover:text-navy-950"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
