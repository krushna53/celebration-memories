"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw, Smartphone } from "lucide-react";

import { regenerateBusinessMobileAccessCodeAction } from "@/features/business/mobile-access/actions";

interface MobileAccessCardProps {
  initialCode: string;
}

/**
 * Lets a vendor see (and rotate) the code their phone needs to sign
 * into the companion mobile app's lightweight "Vendor" view — leads
 * inbox + pause/live toggle only, not the full dashboard (see
 * mobile-app/README.md). See services/business-mobile-auth.ts.
 */
export function MobileAccessCard({ initialCode }: MobileAccessCardProps) {
  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function regenerate() {
    const confirmed = window.confirm(
      "Generate a new code? Anyone currently signed into the mobile app with the old code will be signed out.",
    );
    if (!confirmed) return;

    setRegenerating(true);
    setError(null);
    const result = await regenerateBusinessMobileAccessCodeAction();
    if (result.success) {
      setCode(result.code);
    } else {
      setError(result.error);
    }
    setRegenerating(false);
  }

  return (
    <div className="grid gap-2 rounded-lg border border-navy-950/10 bg-navy-950/[0.02] p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-navy-950">
        <Smartphone size={15} /> Mobile App Access Code
      </div>
      <p className="text-xs text-navy-700/50">
        Open the Celebration Memories app, choose &ldquo;Vendor&rdquo;, and enter this code to check your leads or
        pause your listing on the go.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-gold-500/30 bg-white px-3 py-1.5 font-mono text-sm tracking-widest text-navy-950">
          {code}
        </span>
        <button
          type="button"
          onClick={copy}
          className="tap-target flex items-center gap-1.5 rounded-full border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700 transition-luxury duration-200 hover:border-navy-950/30 hover:text-navy-950"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={regenerate}
          disabled={regenerating}
          className="tap-target flex items-center gap-1.5 rounded-full border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700 transition-luxury duration-200 hover:border-navy-950/30 hover:text-navy-950 disabled:opacity-50"
        >
          <RefreshCw size={13} className={regenerating ? "animate-spin" : ""} />{" "}
          {regenerating ? "Generating…" : "Generate New Code"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
