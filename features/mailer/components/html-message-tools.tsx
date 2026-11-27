"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Code2, Loader2, Sparkles, Type, X } from "lucide-react";

import type { CampaignKind } from "@/types/mailer";
import { brandOf } from "@/lib/mailer/brand";
import { htmlToText } from "@/lib/mailer/html-email";
import { generateEmailAction } from "@/features/mailer/ai-actions";
import { useMailerStatus } from "@/features/mailer/mailer-provider";
import { ErrorText, inputClasses, primaryButton, secondaryButton } from "@/features/mailer/components/ui";
import { cn } from "@/lib/utils";

export type { HtmlEmailEditorHandle } from "@/features/mailer/components/html-email-editor";

/** CKEditor touches `window`, so it only ever loads in the browser. */
export const HtmlEmailEditor = dynamic(() => import("@/features/mailer/components/html-email-editor").then((m) => m.HtmlEmailEditor), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-navy-950/10 bg-white text-sm text-navy-700/60">
      <Loader2 size={16} className="mr-2 animate-spin" /> Loading editor…
    </div>
  ),
});

/** The plain-text version kept in `body` for an HTML email (text part of the email, template cards). */
export function plainTextOf(html: string): string {
  return htmlToText(html).slice(0, 10_000);
}

/** "Simple text" (the built-in design) vs "HTML editor" (CKEditor with Source). */
export function MessageFormatSwitch({ isHtml, onText, onHtml }: { isHtml: boolean; onText: () => void; onHtml: () => void }) {
  const tab = (on: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
      on ? "bg-white text-navy-950 shadow-sm" : "text-navy-700/65 hover:text-navy-950",
    );
  return (
    <div role="tablist" aria-label="Message format" className="inline-flex rounded-xl bg-navy-950/[0.05] p-1">
      <button type="button" role="tab" aria-selected={!isHtml} onClick={onText} className={tab(!isHtml)}>
        <Type size={13} /> Simple text
      </button>
      <button type="button" role="tab" aria-selected={isHtml} onClick={onHtml} className={tab(isHtml)}>
        <Code2 size={13} /> HTML editor
      </button>
    </div>
  );
}

/**
 * "Generate with AI": the host describes the email, OpenAI writes the
 * subject, preview text and a full HTML email (features/mailer/ai-actions.ts),
 * which the caller loads into the HTML editor.
 */
export function AiEmailGenerator({
  kind,
  currentHtml,
  onGenerated,
}: {
  kind: CampaignKind;
  /** The HTML email being edited, if any — offered for revision. */
  currentHtml: string | null;
  onGenerated: (email: { subject: string; preheader: string; html: string }) => void;
}) {
  const { data } = useMailerStatus();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [revise, setRevise] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRevise = Boolean(currentHtml?.trim());

  async function generate() {
    if (!prompt.trim()) {
      setError("Describe the email you want first.");
      return;
    }
    const brand = brandOf(data);
    setBusy(true);
    setError(null);
    const result = await generateEmailAction({
      prompt,
      kind,
      currentHtml: canRevise && revise ? currentHtml : null,
      brand: brand ? { primaryColor: brand.primaryColor, secondaryColor: brand.secondaryColor, hasLogo: Boolean(brand.logoUrl) } : null,
    }).catch(() => ({ success: false as const, error: "Couldn't reach the server. Please try again." }));
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onGenerated(result.data);
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn(secondaryButton, "border-gold-500/40 text-navy-950")}>
        <Sparkles size={15} className="text-gold-700" /> Generate with AI
      </button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-xl border border-gold-500/30 bg-gold-100/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-navy-950">
          <Sparkles size={15} className="text-gold-700" /> Generate with AI
        </p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-1 text-navy-700/60 hover:bg-navy-950/5">
          <X size={15} />
        </button>
      </div>
      <textarea
        rows={4}
        autoFocus
        className={cn(inputClasses, "resize-y bg-white")}
        placeholder="e.g. A Diwali greeting for our clients, warm and festive, thanking them for 2026, with a button to our website https://example.com"
        value={prompt}
        maxLength={2000}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={busy}
      />
      {canRevise ? (
        <label className="flex items-center gap-2 text-xs text-navy-700/80">
          <input type="checkbox" checked={revise} onChange={(e) => setRevise(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-gold-500)]" disabled={busy} />
          Change the current email (untick to start fresh)
        </label>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-xs text-navy-700/55">Replaces the subject, preview text and message. Review it before sending.</p>
        <button type="button" onClick={generate} disabled={busy} className={primaryButton}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {busy ? "Generating…" : "Generate"}
        </button>
      </div>
    </div>
  );
}
