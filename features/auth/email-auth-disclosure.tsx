"use client";

import { useState } from "react";
import { ChevronDown, Mail } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmailAuthDisclosureProps {
  /** Matches the surrounding card — dark (navy) or light (white). */
  variant: "dark" | "light";
  label?: string;
  /** Start expanded, e.g. right after an email-verification link lands on /login. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Google is the primary sign-in/sign-up path on every auth screen; the
 * email/password form still exists (so accounts on non-Google email
 * addresses keep working) but sits collapsed behind this toggle so it
 * doesn't compete with the Google button, especially on phones.
 */
export function EmailAuthDisclosure({
  variant,
  label = "Use email instead",
  defaultOpen = false,
  children,
}: EmailAuthDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div
        className={cn(
          "my-5 flex items-center gap-3 text-xs uppercase tracking-[0.15em]",
          variant === "dark" ? "text-ivory-100/40" : "text-navy-700/40",
        )}
      >
        <span className={cn("h-px flex-1", variant === "dark" ? "bg-white/10" : "bg-navy-950/10")} /> or{" "}
        <span className={cn("h-px flex-1", variant === "dark" ? "bg-white/10" : "bg-navy-950/10")} />
      </div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex min-h-11 w-full items-center justify-center gap-2 text-sm underline-offset-4 hover:underline",
          variant === "dark" ? "text-ivory-100/70" : "text-navy-700/70",
        )}
      >
        <Mail size={15} />
        {label}
        <ChevronDown size={15} className={cn("transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
