"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Palette, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildThemeStyle, resolveHighlightMode, resolvePalette } from "@/lib/template-theme-vars";
import type { TemplateTheme } from "@/lib/template-catalog";
import type { ThemeOverrides } from "@/types/event";

type HighlightChoice = "auto" | "light" | "dark" | "custom";

const HIGHLIGHT_OPTIONS: { value: HighlightChoice; label: string }[] = [
  { value: "auto", label: "Template default" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "custom", label: "Pick a colour" },
];

function initialChoice(overrides: ThemeOverrides | null): HighlightChoice {
  if (overrides?.highlightColor) return "custom";
  return overrides?.highlightStyle ?? "auto";
}

/**
 * "Customise colours" panel shown above the template grid (wizard
 * Template step + admin Templates page — see template-picker.tsx). Lets
 * the host swap the accent colour and choose how the highlight bands
 * look (Hero, Countdown, Timeline, Live Stream, Event Day, navbar,
 * footer): the template's default, light, dark, or an exact colour.
 * Text colours are never picked by hand — lib/template-theme-vars.ts
 * derives them and contrast-checks them against whatever is chosen, so
 * no combination can make the page unreadable.
 *
 * The mini preview renders with the exact same CSS variables the real
 * page gets, so what's shown here is what guests see.
 */
export function ThemeColorCustomizer({
  templateName,
  theme,
  initialOverrides,
  onSave,
}: {
  templateName: string;
  theme: TemplateTheme;
  initialOverrides: ThemeOverrides | null;
  onSave: (overrides: ThemeOverrides | null) => Promise<{ success: true } | { success: false; error: string }>;
}) {
  // Open by default so hosts see the options and live preview straight away; the header still collapses it.
  const [open, setOpen] = useState(true);
  const [accent, setAccent] = useState<string | null>(initialOverrides?.accentColor ?? null);
  const [choice, setChoice] = useState<HighlightChoice>(initialChoice(initialOverrides));
  const [customColor, setCustomColor] = useState<string>(initialOverrides?.highlightColor ?? theme.colors.navy900);
  const [savedKey, setSavedKey] = useState(JSON.stringify(initialOverrides ?? null));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const draft: ThemeOverrides | null = (() => {
    const out: ThemeOverrides = {};
    if (accent) out.accentColor = accent;
    if (choice === "light" || choice === "dark") out.highlightStyle = choice;
    if (choice === "custom") out.highlightColor = customColor;
    return Object.keys(out).length > 0 ? out : null;
  })();
  const dirty = JSON.stringify(draft) !== savedKey;
  const palette = resolvePalette(theme, draft);
  const defaultMode = theme.highlightSurface ?? "dark";

  function save(next: ThemeOverrides | null) {
    setError(null);
    startTransition(async () => {
      const result = await onSave(next);
      if (result.success) setSavedKey(JSON.stringify(next));
      else setError(result.error);
    });
  }

  function resetAll() {
    setAccent(null);
    setChoice("auto");
    setCustomColor(theme.colors.navy900);
    save(null);
  }

  return (
    <section className="mb-8 rounded-2xl border border-navy-950/10 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
            <Palette size={17} />
          </span>
          <span>
            <span className="block font-display text-base text-navy-950">Customise colours</span>
            <span className="block text-xs text-navy-700/60">
              Change {templateName}&rsquo;s accent colour and the look of the top banner, countdown and timeline.
            </span>
          </span>
        </span>
        <span className="flex shrink-0 gap-1" aria-hidden>
          <span className="h-5 w-5 rounded-full border border-navy-950/10" style={{ background: palette.gold500 }} />
          <span
            className="h-5 w-5 rounded-full border border-navy-950/10"
            style={{ background: (buildThemeStyle(theme, draft) as Record<string, string>)["--feature-navy-900"] }}
          />
        </span>
      </button>

      {open ? (
        <div className="grid gap-6 border-t border-navy-950/10 p-5 lg:grid-cols-[1fr_300px]">
          <div className="grid content-start gap-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">Accent colour</p>
              <p className="mt-1 text-xs text-navy-700/50">Buttons, small headings, dividers and highlights.</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-navy-950/15 px-2.5 py-1.5 text-sm text-navy-950">
                  <input
                    type="color"
                    value={accent ?? theme.colors.gold500}
                    onChange={(e) => setAccent(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label="Accent colour"
                  />
                  <span className="font-mono text-xs uppercase">{accent ?? theme.colors.gold500}</span>
                </label>
                {accent ? (
                  <button
                    type="button"
                    onClick={() => setAccent(null)}
                    className="text-xs text-navy-700/60 underline underline-offset-4 hover:text-navy-950"
                  >
                    Use template&rsquo;s accent
                  </button>
                ) : (
                  <span className="text-xs text-navy-700/50">Template default</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
                Top banner, countdown &amp; timeline
              </p>
              <p className="mt-1 text-xs text-navy-700/50">
                Also used for the menu bar and footer. Text colour adjusts automatically so it always stays readable.
              </p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Highlight section style">
                {HIGHLIGHT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={choice === opt.value}
                    onClick={() => setChoice(opt.value)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-luxury duration-200",
                      choice === opt.value
                        ? "border-gold-500 bg-gold-500/10 text-navy-950"
                        : "border-navy-950/15 text-navy-700/70 hover:border-gold-500/50",
                    )}
                  >
                    {opt.label}
                    {opt.value === "auto" ? ` (${defaultMode})` : ""}
                  </button>
                ))}
              </div>
              {choice === "custom" ? (
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-navy-950/15 px-2.5 py-1.5 text-sm text-navy-950">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label="Highlight section background colour"
                  />
                  <span className="font-mono text-xs uppercase">{customColor}</span>
                </label>
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" disabled={pending || !dirty} onClick={() => save(draft)}>
                {pending ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                Save colours
              </Button>
              <button
                type="button"
                disabled={pending || savedKey === "null"}
                onClick={resetAll}
                className="inline-flex items-center gap-1.5 text-xs text-navy-700/60 hover:text-navy-950 disabled:opacity-40"
              >
                <RotateCcw size={12} /> Reset to template colours
              </button>
              {!dirty && savedKey !== "null" ? <span className="text-xs text-navy-700/50">Saved.</span> : null}
            </div>
          </div>

          <ColorPreview theme={theme} overrides={draft} mode={resolveHighlightMode(theme, draft)} />
        </div>
      ) : null}
    </section>
  );
}

/** A miniature hero/countdown band over a regular section, rendered with the real theme variables. */
function ColorPreview({ theme, overrides, mode }: { theme: TemplateTheme; overrides: ThemeOverrides | null; mode: "light" | "dark" }) {
  return (
    <div
      style={buildThemeStyle(theme, overrides)}
      className="overflow-hidden rounded-xl border border-navy-950/10 shadow-sm"
      aria-label={`Preview — ${mode} highlight sections`}
    >
      <div className="surface-feature bg-navy-900 px-4 py-5 text-center">
        <p className="text-[9px] uppercase tracking-[0.3em] text-gold-300">The celebration begins in</p>
        <p className="mt-1 font-display text-lg text-ivory-50">Counting Down</p>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {["23", "08", "41", "16"].map((n, i) => (
            <div key={i} className="glass-card rounded-lg py-2">
              <span className="block font-display text-base tabular-nums text-gold-300">{n}</span>
              <span className="block text-[7px] uppercase tracking-[0.2em] text-ivory-100/60">
                {["Days", "Hrs", "Min", "Sec"][i]}
              </span>
            </div>
          ))}
        </div>
        <span className="mt-3 inline-block rounded-full bg-gold-500 px-3 py-1 text-[10px] font-medium text-navy-950">
          RSVP Now
        </span>
      </div>
      <div className="bg-ivory-50 px-4 py-4 text-center">
        <p className="text-[9px] uppercase tracking-[0.3em] text-gold-600">You&rsquo;re warmly invited</p>
        <p className="mt-1 font-display text-base text-navy-950">Event Details</p>
        <p className="mt-1 text-[10px] text-navy-700/80">Sunday, 23 August · 7:00 PM onwards</p>
      </div>
    </div>
  );
}
