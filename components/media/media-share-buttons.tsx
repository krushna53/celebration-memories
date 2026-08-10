"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Download, Facebook, Link2, Loader2, Mail, MessageCircle, Send, Share2, Twitter } from "lucide-react";

interface MediaShareButtonsProps {
  url: string;
  /** Suggested filename, without extension — the real extension is inferred from the fetched file. */
  fileNameBase: string;
  shareText?: string;
  className?: string;
  /**
   * Public, crawlable link-preview page for this one item — a relative
   * path like "/p/gallery/abc123" (see app/p/[kind]/[id]/page.tsx, task
   * #80). When set, a fourth button opens a small menu of branded
   * WhatsApp/Facebook/X/Telegram/Email/Copy-Link share links pointed at
   * this page rather than the raw media file. Those platforms build
   * their preview card by crawling the URL's Open Graph tags, so they
   * need an actual webpage — a raw Storage file URL has no OG tags and
   * unfurls as a bare link. Kept relative and resolved against
   * `window.location.origin` at click time (rather than a hardcoded
   * SITE_URL) so the shared link matches whatever domain the guest is
   * actually viewing — some events are served from their own custom
   * domain. Omit this prop entirely (nothing to link to yet) and only
   * Download + native Share render, same as before.
   */
  pageUrl?: string;
}

const BRAND_SHARE_LINKS = (pageUrl: string, text: string) => [
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    href: `https://wa.me/?text=${encodeURIComponent(`${text} ${pageUrl}`.trim())}`,
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: Facebook,
    href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
  },
  {
    key: "x",
    label: "X",
    icon: Twitter,
    href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(text)}`,
  },
  {
    key: "telegram",
    label: "Telegram",
    icon: Send,
    href: `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(text)}`,
  },
  {
    key: "email",
    label: "Email",
    icon: Mail,
    href: `mailto:?subject=${encodeURIComponent(text || "A memory to share")}&body=${encodeURIComponent(`${text ? `${text}\n\n` : ""}${pageUrl}`)}`,
  },
] as const;

/**
 * Download + Share controls for one photo/video, reused by the Memory
 * Wall and the Gallery lightbox.
 *
 * There is no web API for posting directly into Instagram/Facebook/X —
 * none of those platforms expose one, by design. The two things that
 * genuinely work: (1) Download, which guests can then upload manually,
 * and (2) the Web Share API on mobile, which hands the actual file to
 * the OS share sheet — that's the same sheet Instagram/Facebook/etc
 * register themselves into, so "Share" often lets a guest post straight
 * into those apps without a manual download step. Desktop browsers
 * mostly don't support file sharing via this API, so Share there falls
 * back to Download.
 */
export function MediaShareButtons({ url, fileNameBase, shareText, className, pageUrl }: MediaShareButtonsProps) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const shareToggleRef = useRef<HTMLButtonElement>(null);

  function toggleMenu() {
    if (!menuOpen && shareToggleRef.current) {
      const rect = shareToggleRef.current.getBoundingClientRect();
      // Rendered via a portal at position: fixed (see below) rather than
      // as a normal absolutely-positioned child — both the Gallery grid
      // tiles and Memory Wall cards this renders inside have
      // `overflow-hidden` (for the rounded-corner photo/video crop),
      // which would silently clip a same-tree dropdown before a guest
      // ever saw it.
      setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setMenuOpen((open) => !open);
  }

  async function fetchAsFile(): Promise<File> {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not load the file.");
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "jpg").replace("quicktime", "mov");
    return new File([blob], `${fileNameBase}.${ext}`, { type: blob.type });
  }

  async function handleDownload() {
    setBusy("download");
    try {
      const file = await fetchAsFile();
      const objectUrl = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      // Same fetch-as-blob caveat as the admin download button (see
      // features/admin/memories/moderation-list.tsx) — fall back to
      // opening the file directly rather than a silent dead end.
      console.error("Download via blob failed, opening file directly instead:", err);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setBusy("share");
    try {
      const file = await fetchAsFile();
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files?: File[]; text?: string }) => Promise<void>;
      };

      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: shareText });
      } else {
        // No file-sharing support (most desktop browsers) — download instead.
        const objectUrl = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      // AbortError just means the guest cancelled the share sheet — not an error.
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    } finally {
      setBusy(null);
    }
  }

  // Resolved against the current origin at click time, not a hardcoded
  // constant — see the pageUrl prop doc comment above.
  const absolutePageUrl = pageUrl && typeof window !== "undefined" ? new URL(pageUrl, window.location.origin).toString() : pageUrl;

  async function handleCopyLink() {
    if (!absolutePageUrl) return;
    try {
      await navigator.clipboard.writeText(absolutePageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("Copy link failed:", err);
    }
  }

  return (
    <div className={className}>
      <div className="relative">
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy !== null}
          aria-label="Download"
          className="tap-target flex items-center justify-center rounded-full bg-navy-950/70 p-2 text-ivory-50 backdrop-blur-sm transition-luxury duration-200 hover:bg-navy-950 disabled:opacity-60"
        >
          {busy === "download" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        </button>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={handleShare}
          disabled={busy !== null}
          aria-label="Share"
          className="tap-target flex items-center justify-center rounded-full bg-navy-950/70 p-2 text-ivory-50 backdrop-blur-sm transition-luxury duration-200 hover:bg-navy-950 disabled:opacity-60"
        >
          {busy === "share" ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
        </button>
      </div>
      {absolutePageUrl ? (
        <div className="relative">
          <button
            ref={shareToggleRef}
            type="button"
            onClick={toggleMenu}
            aria-label="Share to WhatsApp, Facebook, X, Telegram, or email"
            aria-expanded={menuOpen}
            className="tap-target flex items-center justify-center rounded-full bg-navy-950/70 p-2 text-ivory-50 backdrop-blur-sm transition-luxury duration-200 hover:bg-navy-950"
          >
            <Link2 size={15} />
          </button>

          {menuOpen && menuPos && typeof document !== "undefined"
            ? createPortal(
                <>
                  {/* Full-screen invisible backdrop closes the menu on outside click/tap — simplest option without a popover library. */}
                  <button
                    type="button"
                    aria-label="Close share menu"
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-40 cursor-default"
                  />
                  <div
                    style={{ top: menuPos.top, right: menuPos.right }}
                    className="fixed z-50 w-44 overflow-hidden rounded-xl border border-navy-950/10 bg-white py-1.5 text-left shadow-xl"
                  >
                    {BRAND_SHARE_LINKS(absolutePageUrl, shareText ?? "").map(({ key, label, icon: Icon, href }) => (
                      <a
                        key={key}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-navy-950 transition-luxury duration-150 hover:bg-gold-500/10"
                      >
                        <Icon size={15} className="text-navy-700/70" /> {label}
                      </a>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        void handleCopyLink();
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-navy-950 transition-luxury duration-150 hover:bg-gold-500/10"
                    >
                      {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} className="text-navy-700/70" />}
                      {copied ? "Copied!" : "Copy Link"}
                    </button>
                  </div>
                </>,
                document.body,
              )
            : null}
        </div>
      ) : null}
    </div>
  );
}
