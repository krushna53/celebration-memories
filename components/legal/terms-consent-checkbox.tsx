"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { BUILDER } from "@/lib/constants";

interface TermsConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  /** "dark" for a dark navy card (register-form.tsx, signup-form.tsx); "light" for a white card (start/account-form.tsx). */
  variant?: "dark" | "light";
}

/**
 * Required consent checkbox shown on every self-service account-creation
 * form (host registration, wizard account creation, vendor signup) — NOT
 * on login, since re-showing a mandatory checkbox every time a returning
 * user signs back in is unusual UX and the agreement is already on file
 * from when their account was created.
 *
 * Callers must keep the primary submit action (and Google sign-in, where
 * offered) disabled while `checked` is false — this component only
 * renders the input and copy, it doesn't gate anything on its own.
 */
export function TermsConsentCheckbox({
  checked,
  onChange,
  id = "terms-consent",
  variant = "dark",
}: TermsConsentCheckboxProps) {
  const isDark = variant === "dark";

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-2.5 text-left text-xs leading-relaxed",
        isDark ? "text-ivory-100/70" : "text-navy-700/70",
      )}
    >
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 rounded text-gold-500 focus:ring-2 focus:ring-gold-500/40",
          isDark ? "border-white/20 bg-navy-900" : "border-navy-950/20 bg-white",
        )}
      />
      <span>
        This platform&rsquo;s design, source code, templates, and business methods are the
        confidential property of {BUILDER.name} — by creating an account you agree not to copy,
        reverse-engineer, or use them to build a competing product. I have read and agree to the{" "}
        <Link
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "underline underline-offset-2",
            isDark ? "text-gold-300 hover:text-gold-200" : "text-gold-600 hover:text-gold-700",
          )}
        >
          Terms and Conditions
        </Link>
        .
      </span>
    </label>
  );
}
