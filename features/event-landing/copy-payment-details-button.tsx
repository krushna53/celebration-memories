"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies the payment details text — handy for pasting bank details into a banking app. */
export function CopyPaymentDetailsButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {});
      }}
      className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 px-4 py-2 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:border-gold-500 hover:bg-gold-500/5"
    >
      {copied ? <Check size={15} className="text-gold-600" /> : <Copy size={15} className="text-gold-600" />}
      {copied ? "Copied" : "Copy details"}
    </button>
  );
}
