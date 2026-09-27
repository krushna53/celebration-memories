"use client";

import { useState } from "react";
import { Instagram, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StoryCard {
  /** Small gold line at the top, e.g. "You're invited" or "I'm going!". */
  eyebrow: string;
  /** The big line — the honoree/occasion or the achievement. */
  title: string;
  subtitle?: string;
  /** Up to three short detail lines (date, time, venue…). */
  details?: string[];
}

const W = 1080;
const H = 1920;

/** The page's own display/body font stacks (next/font gives them hashed family names), so the story matches the site. */
function pageFonts(): { display: string; body: string } {
  const display = document.querySelector(".font-display");
  return {
    display: display ? getComputedStyle(display).fontFamily : "Georgia, serif",
    body: getComputedStyle(document.body).fontFamily || "system-ui, sans-serif",
  };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws a 1080x1920 (Instagram Story size) card in EveryMoment's navy + gold. */
async function renderStory(card: StoryCard): Promise<Blob> {
  const { display, body } = pageFonts();
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#26315f");
  bg.addColorStop(1, "#0b1024");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.38, 40, W / 2, H * 0.38, W * 0.8);
  glow.addColorStop(0, "rgba(233,196,106,0.22)");
  glow.addColorStop(1, "rgba(233,196,106,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // A light scatter of gold confetti — seeded so the same card always looks the same.
  let seed = card.title.length * 97 + 13;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(233,196,106,${0.15 + rand() * 0.45})`;
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H, 3 + rand() * 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(233,196,106,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(60, 60, W - 120, H - 120);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e9c46a";
  ctx.font = `600 40px ${body}`;
  ctx.fillText(card.eyebrow.toUpperCase().split("").join(" "), W / 2, 560);

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 104px ${display}`;
  let y = 720;
  for (const line of wrap(ctx, card.title, W - 220).slice(0, 4)) {
    ctx.fillText(line, W / 2, y);
    y += 122;
  }
  if (card.subtitle) {
    ctx.fillStyle = "#e9c46a";
    ctx.font = `italic 500 56px ${display}`;
    y += 10;
    for (const line of wrap(ctx, card.subtitle, W - 240).slice(0, 2)) {
      ctx.fillText(line, W / 2, y);
      y += 72;
    }
  }
  ctx.fillStyle = "#e9c46a";
  ctx.fillRect(W / 2 - 70, y + 20, 140, 4);
  y += 110;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = `500 48px ${body}`;
  for (const detail of (card.details ?? []).slice(0, 3)) {
    for (const line of wrap(ctx, detail, W - 240).slice(0, 2)) {
      ctx.fillText(line, W / 2, y);
      y += 66;
    }
  }

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `500 38px ${body}`;
  ctx.fillText("Made with EveryMoment · everymoment.in", W / 2, H - 140);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create the image."))), "image/png"));
}

/**
 * "Share to your Story" — draws a Story-sized image for this moment and
 * hands it to the phone's share sheet (where Instagram, WhatsApp Status
 * and Facebook Stories register themselves). Desktop browsers can't share
 * files, so there it downloads the image instead. The share text (with
 * the link) is also copied, ready to paste as a caption or link sticker.
 */
export function StoryShareButton({
  card,
  shareText,
  fileName = "everymoment-story",
  label = "Share to your Story",
  className,
}: {
  card: StoryCard;
  /** Caption/link to share alongside the image; "{url}" becomes the current page's link. */
  shareText: string;
  fileName?: string;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await renderStory(card);
      // "{url}" in the share text = this page's link, filled in at share time.
      const text = shareText.replace("{url}", `${window.location.origin}${window.location.pathname}`);
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      await navigator.clipboard?.writeText(text).catch(() => {});
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        setNote("Image saved — post it to your Instagram Story. The caption and link are copied too.");
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) setNote("Couldn't create the image — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-luxury duration-200 hover:brightness-110 disabled:opacity-70"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Instagram size={16} />} {label}
      </button>
      {note ? <p className="max-w-xs text-center text-xs text-navy-700/70">{note}</p> : null}
    </div>
  );
}
