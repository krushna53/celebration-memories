"use client";

import { useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";

interface MediaShareButtonsProps {
  url: string;
  /** Suggested filename, without extension — the real extension is inferred from the fetched file. */
  fileNameBase: string;
  shareText?: string;
  className?: string;
}

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
export function MediaShareButtons({ url, fileNameBase, shareText, className }: MediaShareButtonsProps) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);

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

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy !== null}
        aria-label="Download"
        className="tap-target flex items-center justify-center rounded-full bg-navy-950/70 p-2 text-ivory-50 backdrop-blur-sm transition-luxury duration-200 hover:bg-navy-950 disabled:opacity-60"
      >
        {busy === "download" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
      </button>
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
  );
}
