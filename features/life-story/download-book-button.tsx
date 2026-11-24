"use client";

import { useState } from "react";
import { BookDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LifeStoryBundle } from "@/types/life-story";

/**
 * Builds the printable PDF book in the browser (@react-pdf/renderer,
 * loaded only on click) — no server time limit to worry about, and the
 * photos are fetched with the viewer's own signed /media links.
 */
export function DownloadBookButton({ bundle, variant = "outline" }: { bundle: LifeStoryBundle; variant?: "outline" | "light" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const [{ pdf }, { LifeStoryBook }] = await Promise.all([import("@react-pdf/renderer"), import("@/features/life-story/pdf-book")]);
      const absolute = (url: string) => new URL(url, window.location.origin).href;
      const book = {
        ...bundle,
        photos: bundle.photos.map((p) => ({ ...p, url: absolute(p.url) })),
      };
      const blob = await pdf(<LifeStoryBook bundle={book} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(bundle.story.title || bundle.story.subjectName).replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "life-story"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      console.error("Life Story PDF failed:", err);
      setError("Couldn't build the book — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={download}
        disabled={busy}
        className={cn(variant === "light" && "border-ivory-50/70 text-ivory-50 hover:bg-ivory-50/10")}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookDown className="h-4 w-4" />}
        {busy ? "Preparing the book…" : "Download the book (PDF)"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
