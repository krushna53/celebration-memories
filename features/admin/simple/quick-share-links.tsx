"use client";

import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareLink {
  key: string;
  label: string;
  description: string;
  path: string;
  message: (link: string) => string;
}

interface QuickShareLinksProps {
  slug: string;
  hostedBy: string;
  honoreeName: string;
  eventTitle: string;
  publicRsvpEnabled: boolean;
  publicMemoriesEnabled: boolean;
}

/**
 * Self-contained copy + WhatsApp share block for the simplified client
 * dashboard (/admin/simple). Deliberately reimplements (rather than
 * imports) the copy/share handlers already in event-settings-form.tsx —
 * that component is a single 1000+ line client form tied to the full
 * settings page; pulling it in here would drag in the whole form. This
 * stays a small, standalone island instead.
 */
export function QuickShareLinks({
  slug,
  hostedBy,
  honoreeName,
  eventTitle,
  publicRsvpEnabled,
  publicMemoriesEnabled,
}: QuickShareLinksProps) {
  const [origin, setOrigin] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const links: ShareLink[] = [
    {
      key: "web",
      label: "Web Page",
      description: "The full site — share this one anywhere.",
      path: `/events/${slug}`,
      message: (link) => `${hostedBy} warmly invites you to celebrate ${honoreeName}'s ${eventTitle}: ${link}`,
    },
    ...(publicRsvpEnabled
      ? [
          {
            key: "rsvp",
            label: "RSVP Link",
            description: "Anyone with this link can submit their own RSVP.",
            path: `/events/${slug}/rsvp`,
            message: (link: string) => `Please RSVP for ${honoreeName}'s ${eventTitle} here: ${link}`,
          },
        ]
      : []),
    ...(publicMemoriesEnabled
      ? [
          {
            key: "memories",
            label: "Share-a-Memory Link",
            description: "Relatives upload a photo, video, or note — no invite needed.",
            path: `/events/${slug}/memories`,
            message: (link: string) => `${hostedBy} would love a photo or video memory of ${honoreeName} — upload one here: ${link}`,
          },
        ]
      : []),
    {
      key: "display",
      label: "Big Screen Display",
      description: "Open on a TV or projector at the venue.",
      path: `/events/${slug}/display`,
      message: (link) =>
        `Open this on the TV/projector at the venue for a full-screen slideshow of ${honoreeName}'s photos, timeline, and shared memories: ${link}`,
    },
  ];

  function copy(key: string, link: string) {
    navigator.clipboard.writeText(link);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  }

  function shareViaWhatsApp(text: string) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  if (!origin) return null;

  return (
    <div className="grid gap-3">
      {links.map((link) => {
        const fullLink = `${origin}${link.path}`;
        return (
          <div
            key={link.key}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy-950/10 bg-navy-950/[0.02] px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-navy-950">{link.label}</p>
              <p className="text-xs text-navy-700/50">{link.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => copy(link.key, fullLink)}
                className={cn(
                  "tap-target flex items-center gap-1.5 rounded-full border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700 transition-luxury duration-200 hover:border-navy-950/30 hover:text-navy-950",
                )}
              >
                {copiedKey === link.key ? <Check size={13} /> : <Copy size={13} />}
                {copiedKey === link.key ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => shareViaWhatsApp(link.message(fullLink))}
                className="tap-target flex items-center gap-1.5 rounded-full border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700 transition-luxury duration-200 hover:border-navy-950/30 hover:text-navy-950"
              >
                <MessageCircle size={13} /> WhatsApp
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
