"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Download,
  Facebook,
  Instagram,
  Link2,
  Linkedin,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  Share2,
  Twitter,
} from "lucide-react";

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

const BRAND_SHARE_LINKS = (pageUrl: string, text: string) =>
  [
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
      key: "linkedin",
      label: "LinkedIn",
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`,
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
 * mostly don't support file sharing via this API, so Share there shares
 * the page link instead (or opens the link menu), never a silent download.
 *
 * Phones only open the share sheet during the tap that asked for it
 * (Safari is strict about this), so the file is fetched ahead of time —
 * as soon as the guest's finger/pointer reaches a share control — and if
 * it still wasn't ready in time, the button turns into "Tap to share" so
 * the next tap opens the sheet instantly.
 */

// Above react-photo-view's lightbox (z-index 2000) — the Gallery lightbox
// toolbar renders these buttons, and a lower z-index hid the menu behind
// the photo.
const LAYER = 2100;

type NavigatorWithShare = Navigator & {
  canShare?: (data: ShareData) => boolean;
};

function saveFile(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // In-app browsers (WhatsApp/Instagram) often block the async clipboard API.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function MediaShareButtons({
  url,
  fileNameBase,
  shareText,
  className,
  pageUrl,
}: MediaShareButtonsProps) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  // A file fetched in time, but the phone refused the share sheet because the tap was "used up" — next tap shares.
  const [readyToShare, setReadyToShare] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const shareToggleRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<{
    url: string;
    promise: Promise<File>;
    file?: File;
  } | null>(null);

  // A different photo (the lightbox reuses this component while swiping) — drop the old file.
  useEffect(() => {
    setReadyToShare(false);
    setMenuOpen(false);
  }, [url]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // The menu is position: fixed, so close it rather than leave it floating when the page scrolls.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function toggleMenu() {
    if (!menuOpen && shareToggleRef.current) {
      const rect = shareToggleRef.current.getBoundingClientRect();
      // Rendered via a portal at position: fixed (see below) rather than
      // as a normal absolutely-positioned child — both the Gallery grid
      // tiles and Memory Wall cards this renders inside have
      // `overflow-hidden` (for the rounded-corner photo/video crop),
      // which would silently clip a same-tree dropdown before a guest
      // ever saw it. Opens upwards when there's no room below.
      const right = Math.max(8, window.innerWidth - rect.right);
      setMenuPos(
        rect.bottom + 380 > window.innerHeight && rect.top > 380
          ? { bottom: window.innerHeight - rect.top + 8, right }
          : { top: rect.bottom + 8, right },
      );
      prefetch();
    }
    setMenuOpen((open) => !open);
  }

  function prefetch(): Promise<File> {
    if (fileRef.current?.url === url) return fileRef.current.promise;
    const promise = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not load the file.");
      const blob = await res.blob();
      const type = blob.type.split(";")[0] || "image/jpeg";
      const ext = (type.split("/")[1] || "jpg")
        .replace("quicktime", "mov")
        .replace("jpeg", "jpg");
      return new File([blob], `${fileNameBase}.${ext}`, { type });
    })();
    const entry: { url: string; promise: Promise<File>; file?: File } = {
      url,
      promise,
    };
    promise.then((file) => (entry.file = file)).catch(() => {});
    entry.promise.catch(() => {
      if (fileRef.current === entry) fileRef.current = null;
    });
    fileRef.current = entry;
    return entry.promise;
  }

  async function handleDownload() {
    setBusy("download");
    try {
      saveFile(await prefetch());
    } catch (err) {
      // Same fetch-as-blob caveat as the admin download button (see
      // features/admin/memories/moderation-list.tsx) — fall back to
      // opening the file directly rather than a silent dead end.
      console.error(
        "Download via blob failed, opening file directly instead:",
        err,
      );
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(null);
    }
  }

  /** Hands the photo/video itself to the phone's share sheet (Instagram, WhatsApp, Stories…). */
  async function shareFile(source: "share" | "instagram") {
    const nav = navigator as NavigatorWithShare;
    // Already fetched: share synchronously within this tap, so the phone allows the sheet.
    const ready =
      fileRef.current?.url === url ? fileRef.current.file : undefined;
    if (ready && nav.share && nav.canShare?.({ files: [ready] })) {
      setReadyToShare(false);
      try {
        await nav.share({ files: [ready], text: shareText });
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Share failed:", err);
          setToast("Couldn't open sharing — use Download instead.");
        }
      }
      return;
    }

    setBusy("share");
    let file: File;
    try {
      file = await prefetch();
    } catch (err) {
      console.error("Share failed:", err);
      setToast("Couldn't load this file — please try again.");
      setBusy(null);
      return;
    }
    setBusy(null);

    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], text: shareText });
      } catch (err) {
        if (err instanceof Error && err.name === "NotAllowedError") {
          // The download took longer than the phone lets a tap "count" — one more tap shares instantly.
          setReadyToShare(true);
          setToast("Ready — tap the share button again.");
        } else if (err instanceof Error && err.name !== "AbortError") {
          console.error("Share failed:", err);
          setToast("Couldn't open sharing — use Download instead.");
        }
      }
      return;
    }

    // This browser can't share files (most desktops).
    if (source === "instagram") {
      saveFile(file);
      setToast(
        "Saved to your device — post it from the Instagram app on your phone.",
      );
      return;
    }
    if (absolutePageUrl && nav.share) {
      try {
        await nav.share({ url: absolutePageUrl, text: shareText });
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") toggleMenu();
      }
      return;
    }
    if (absolutePageUrl) {
      toggleMenu();
      return;
    }
    saveFile(file);
    setToast("Saved to your device.");
  }

  // Resolved against the current origin at click time, not a hardcoded
  // constant — see the pageUrl prop doc comment above.
  const absolutePageUrl =
    pageUrl && typeof window !== "undefined"
      ? new URL(pageUrl, window.location.origin).toString()
      : pageUrl;

  async function handleCopyLink() {
    if (!absolutePageUrl) return;
    if (await copyText(absolutePageUrl)) {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setMenuOpen(false);
      }, 900);
      setToast("Link copied");
    } else {
      setToast("Couldn't copy — press and hold the link to copy it.");
    }
  }

  const buttonClass =
    "tap-target flex items-center justify-center rounded-full bg-navy-950/70 p-2 text-ivory-50 backdrop-blur-sm transition-luxury duration-200 hover:bg-navy-950 disabled:opacity-60";
  const menuItemClass =
    "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-navy-950 transition-luxury duration-150 hover:bg-gold-500/10";

  return (
    <div className={className}>
      <div className="relative">
        <button
          type="button"
          onPointerEnter={() => void prefetch().catch(() => {})}
          onClick={handleDownload}
          disabled={busy !== null}
          aria-label="Download"
          title="Download"
          className={buttonClass}
        >
          {busy === "download" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Download size={15} />
          )}
        </button>
      </div>
      <div className="relative">
        <button
          type="button"
          onPointerEnter={() => void prefetch().catch(() => {})}
          onPointerDown={() => void prefetch().catch(() => {})}
          onFocus={() => void prefetch().catch(() => {})}
          onClick={() => void shareFile("share")}
          disabled={busy !== null}
          aria-label={readyToShare ? "Tap to share" : "Share"}
          title="Share"
          className={
            readyToShare
              ? `${buttonClass} animate-pulse bg-gold-500 text-navy-950 hover:bg-gold-500`
              : buttonClass
          }
        >
          {busy === "share" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Share2 size={15} />
          )}
        </button>
      </div>
      {absolutePageUrl ? (
        <div className="relative">
          <button
            ref={shareToggleRef}
            type="button"
            onClick={toggleMenu}
            aria-label="Share to Instagram, WhatsApp, Facebook, LinkedIn, X, Telegram, or email"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title="More ways to share"
            className={buttonClass}
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
                    style={{ zIndex: LAYER }}
                    className="fixed inset-0 cursor-default"
                  />
                  <div
                    role="menu"
                    style={{
                      top: menuPos.top,
                      bottom: menuPos.bottom,
                      right: menuPos.right,
                      zIndex: LAYER + 1,
                    }}
                    className="fixed w-48 overflow-hidden rounded-xl border border-navy-950/10 bg-white py-1.5 text-left shadow-xl"
                  >
                    {/* Instagram has no web share URL — hand the file to the phone's share sheet (Story/Post); desktop downloads it. */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        void shareFile("instagram");
                      }}
                      className={menuItemClass}
                    >
                      <Instagram size={15} className="text-navy-700/70" />{" "}
                      Instagram
                    </button>
                    {BRAND_SHARE_LINKS(absolutePageUrl, shareText ?? "").map(
                      ({ key, label, icon: Icon, href }) => (
                        <a
                          key={key}
                          role="menuitem"
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMenuOpen(false)}
                          className={menuItemClass}
                        >
                          <Icon size={15} className="text-navy-700/70" />{" "}
                          {label}
                        </a>
                      ),
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleCopyLink()}
                      className={menuItemClass}
                    >
                      {copied ? (
                        <Check size={15} className="text-emerald-600" />
                      ) : (
                        <Copy size={15} className="text-navy-700/70" />
                      )}
                      {copied ? "Copied!" : "Copy Link"}
                    </button>
                  </div>
                </>,
                document.body,
              )
            : null}
        </div>
      ) : null}
      {toast && typeof document !== "undefined"
        ? createPortal(
            <div
              role="status"
              style={{ zIndex: LAYER + 2 }}
              className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4"
            >
              <p className="rounded-full bg-navy-950/95 px-4 py-2.5 text-center text-sm text-ivory-50 shadow-xl">
                {toast}
              </p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
