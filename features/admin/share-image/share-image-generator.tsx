"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ShareImageGeneratorProps {
  honoreeName: string;
  occasion: string | null;
  eventTitle: string;
  dateLabel: string;
  venueName: string | null;
  /** e.g. "mahesh-75th-birthday" — the full URL is resolved client-side from window.location.origin. */
  eventSlug: string;
  primaryColor: string;
  secondaryColor: string;
}

const CANVAS_SIZE = 1080;

/**
 * Client-side Canvas composer for a shareable, downloadable invitation
 * card — no server round trip, nothing stored. Admin can optionally drop
 * in a photo as the background; otherwise falls back to a gradient built
 * from the event's active template colours.
 */
export function ShareImageGenerator(props: ShareImageGeneratorProps) {
  const {
    honoreeName,
    occasion,
    eventTitle,
    dateLabel,
    venueName,
    eventSlug,
    primaryColor,
    secondaryColor,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const eventUrl = `${origin}/events/${eventSlug}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    if (bgImage) {
      const scale = Math.max(CANVAS_SIZE / bgImage.width, CANVAS_SIZE / bgImage.height);
      const w = bgImage.width * scale;
      const h = bgImage.height * scale;
      ctx.drawImage(bgImage, (CANVAS_SIZE - w) / 2, (CANVAS_SIZE - h) / 2, w, h);
      const overlay = ctx.createLinearGradient(0, CANVAS_SIZE * 0.35, 0, CANVAS_SIZE);
      overlay.addColorStop(0, "rgba(0,0,0,0)");
      overlay.addColorStop(1, "rgba(0,0,0,0.78)");
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    } else {
      const grad = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      grad.addColorStop(0, secondaryColor);
      grad.addColorStop(1, primaryColor);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 3;
    ctx.strokeRect(44, 44, CANVAS_SIZE - 88, CANVAS_SIZE - 88);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 12;

    if (occasion) {
      ctx.font = "600 30px system-ui, sans-serif";
      ctx.fillText(occasion.toUpperCase(), CANVAS_SIZE / 2, 400, CANVAS_SIZE - 160);
    }

    ctx.font = "700 68px Georgia, serif";
    ctx.fillText(honoreeName, CANVAS_SIZE / 2, 480, CANVAS_SIZE - 120);

    ctx.font = "400 34px Georgia, serif";
    ctx.fillText(eventTitle, CANVAS_SIZE / 2, 540, CANVAS_SIZE - 160);

    ctx.font = "500 30px system-ui, sans-serif";
    ctx.fillText(dateLabel, CANVAS_SIZE / 2, 650, CANVAS_SIZE - 160);
    if (venueName) {
      ctx.font = "400 26px system-ui, sans-serif";
      ctx.fillText(venueName, CANVAS_SIZE / 2, 692, CANVAS_SIZE - 160);
    }

    ctx.font = "400 24px system-ui, sans-serif";
    ctx.fillText(eventUrl.replace(/^https?:\/\//, ""), CANVAS_SIZE / 2, 970);

    ctx.shadowBlur = 0;
    setReady(true);
  }, [bgImage, honoreeName, occasion, eventTitle, dateLabel, venueName, eventUrl, primaryColor, secondaryColor]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new window.Image();
    img.onload = () => setBgImage(img);
    img.src = URL.createObjectURL(file);
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${honoreeName.replace(/\s+/g, "-").toLowerCase()}-invitation.png`;
    a.click();
  }

  async function share() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "invitation.png", { type: "image/png" });
      const shareText = `You're invited! ${eventUrl}`;

      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files?: File[]; text?: string; title?: string }) => Promise<void>;
      };

      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], text: shareText, title: honoreeName });
          return;
        } catch {
          // user cancelled, or file-sharing unsupported — fall through to text-only share
        }
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
    }, "image/png");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex items-center justify-center rounded-2xl border border-navy-950/10 bg-navy-950/5 p-4">
        <canvas ref={canvasRef} className="w-full max-w-md rounded-xl shadow-lg" />
      </div>
      <div className="grid gap-4">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-navy-950/20 px-4 py-3 text-center text-sm text-navy-700/70 hover:border-gold-500/50">
          <Upload size={16} /> Use a photo as background
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
        <Button type="button" onClick={download} className="w-full" disabled={!ready}>
          <Download size={16} /> Download Image
        </Button>
        <Button type="button" onClick={share} variant="outline" className="w-full">
          <Share2 size={16} /> Share
        </Button>
        <p className="text-xs leading-relaxed text-navy-700/50">
          On a phone, Share opens your device&rsquo;s native share sheet with the
          image attached where supported (including WhatsApp). On desktop,
          download the image first, then attach it to your message manually —
          browsers can&rsquo;t send an image straight into a WhatsApp chat.
        </p>
      </div>
    </div>
  );
}
