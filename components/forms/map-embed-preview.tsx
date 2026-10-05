"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Live preview of the Google Maps embed URL a Location form is about to
 * save (the same iframe guests see in the Event Details section), plus a
 * "Copy embed code" button giving the ready-to-paste <iframe> snippet
 * for use anywhere else (a blog, another site, an email builder).
 */
export function MapEmbedPreview({ embedUrl, title = "Venue map" }: { embedUrl: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  if (!embedUrl.trim()) return null;

  const embedCode = `<iframe src="${embedUrl.replace(/"/g, "&quot;")}" width="600" height="450" style="border:0;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${title.replace(/"/g, "&quot;")}"></iframe>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-navy-950/10">
      <iframe
        src={embedUrl}
        title={title}
        className="h-56 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="flex items-center justify-between gap-3 bg-navy-950/[0.02] px-3 py-2">
        <span className="text-xs text-navy-700/60">This is the map guests will see.</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-navy-950 hover:text-gold-700"
          aria-live="polite"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy embed code"}
        </button>
      </div>
    </div>
  );
}
