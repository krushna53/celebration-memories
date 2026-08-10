"use client";

import { useState } from "react";
import { Check, Copy, Facebook, Mail, MessageCircle, Send, Twitter } from "lucide-react";

interface CollectionShareBarProps {
  /** Relative path, e.g. "/share/abc123" — resolved against window.location.origin at render time so the shared link matches whatever domain this page is actually being viewed on (same reasoning as MediaShareButtons's pageUrl prop). */
  pageUrl: string;
  text: string;
}

/**
 * A simpler standalone cousin of components/media/media-share-buttons.tsx's
 * branded-link menu — built for the /share/[token] collection page
 * specifically, where there's no single file to attach to a Download/Web
 * Share button (a collection is several items, not one). Shown inline in
 * the page header rather than behind a dropdown, since there's no
 * overflow-hidden ancestor to clip it here (unlike the Gallery/Memory
 * Wall cards MediaShareButtons renders inside).
 */
export function CollectionShareBar({ pageUrl, text }: CollectionShareBarProps) {
  const [copied, setCopied] = useState(false);
  const absoluteUrl = typeof window !== "undefined" ? new URL(pageUrl, window.location.origin).toString() : pageUrl;

  const links = [
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(`${text} ${absoluteUrl}`.trim())}` },
    { key: "facebook", label: "Facebook", icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(absoluteUrl)}` },
    { key: "x", label: "X", icon: Twitter, href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(absoluteUrl)}&text=${encodeURIComponent(text)}` },
    { key: "telegram", label: "Telegram", icon: Send, href: `https://t.me/share/url?url=${encodeURIComponent(absoluteUrl)}&text=${encodeURIComponent(text)}` },
    { key: "email", label: "Email", icon: Mail, href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n\n${absoluteUrl}`)}` },
  ] as const;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("Copy link failed:", err);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map(({ key, label, icon: Icon, href }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={label}
          className="tap-target flex items-center justify-center rounded-full bg-navy-950/70 p-2.5 text-ivory-50 backdrop-blur-sm transition-luxury duration-200 hover:bg-navy-950"
        >
          <Icon size={16} />
        </a>
      ))}
      <button
        type="button"
        onClick={handleCopy}
        title="Copy Link"
        className="tap-target flex items-center gap-1.5 rounded-full bg-navy-950/70 px-3 py-2.5 text-xs font-medium text-ivory-50 backdrop-blur-sm transition-luxury duration-200 hover:bg-navy-950"
      >
        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
