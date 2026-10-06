"use client";

import { useState } from "react";
import { Check, Download, Link2, Loader2, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ReelSharePanelProps {
  videoUrl: string;
  /** Absolute URL of the public /reels/[shareToken] page. */
  shareUrl: string;
  shareText: string;
  fileName: string;
}

/**
 * Plays a finished Guest Reel and gets it onto social media. Instagram
 * has no web "post to Reels" link, so the best path on a phone is the
 * native share sheet WITH the video file attached (Web Share Level 2) —
 * that offers Instagram (Reels/Stories), WhatsApp Status, etc. directly.
 * Where file sharing isn't supported (most desktops) it falls back to
 * sharing the link, plus a plain Download button for posting by hand.
 */
export function ReelSharePanel({ videoUrl, shareUrl, shareText, fileName }: ReelSharePanelProps) {
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function fetchFile(): Promise<File> {
    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error("Couldn't load the video.");
    return new File([await res.blob()], `${fileName}.mp4`, { type: "video/mp4" });
  }

  async function share() {
    setBusy("share");
    setMessage(null);
    try {
      const file = await fetchFile();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
      } else if (navigator.share) {
        await navigator.share({ url: shareUrl, text: shareText });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setMessage("Link copied — download the video to post it on Instagram.");
      }
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") setMessage("Sharing didn't work here — try Download instead.");
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setBusy("download");
    setMessage(null);
    try {
      const file = await fetchFile();
      const href = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = href;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      setMessage("Download failed — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;

  return (
    <div className="grid gap-4">
      <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl bg-navy-950 shadow-lg ring-1 ring-gold-500/30">
        <video
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          className="aspect-[9/16] w-full bg-navy-950 object-cover"
          aria-label="Your personal reel"
        />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={share} disabled={busy !== null}>
          {busy === "share" ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />}
          Share to Instagram / WhatsApp
        </Button>
        <Button type="button" variant="outline" onClick={download} disabled={busy !== null}>
          {busy === "download" ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          Download
        </Button>
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-xs">
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="text-gold-600 underline underline-offset-2">
          Send link on WhatsApp
        </a>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 text-gold-600 underline underline-offset-2">
          {copied ? <Check size={12} /> : <Link2 size={12} />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      {message ? <p className="text-center text-xs text-navy-700/70">{message}</p> : null}
    </div>
  );
}
