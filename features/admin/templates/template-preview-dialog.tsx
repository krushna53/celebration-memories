"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Crown, Loader2, Monitor, Smartphone, X } from "lucide-react";

import { cn } from "@/lib/utils";

const PHONE = { width: 390, height: 844 };
const DESKTOP_WIDTH = 1280;

/**
 * Full-screen popup showing the host's own event page rendered in one
 * template (an iframe of /events/[slug]/preview/[template]), switchable
 * between a phone frame and a scaled-down desktop view. "Use this
 * template" applies it without leaving the popup.
 */
export function TemplatePreviewDialog({
  eventSlug,
  template,
  isSelected,
  pending,
  onUse,
  onClose,
}: {
  eventSlug: string;
  template: { slug: string; name: string; premium?: boolean; price?: number };
  isSelected: boolean;
  pending: boolean;
  onUse: () => void;
  onClose: () => void;
}) {
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [loaded, setLoaded] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  // Desktop on a big screen by default; phones always start in phone view.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setDevice("desktop");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const update = () => setStageSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const src = `/events/${encodeURIComponent(eventSlug)}/preview/${encodeURIComponent(template.slug)}`;
  // Scale the real-size page down to fit the popup, so it shows exactly as it would on that device.
  // The phone frame's 10px bezel sits outside the 390px screen.
  const frameWidth = device === "phone" ? PHONE.width + 20 : DESKTOP_WIDTH;
  const scale = stageSize.width ? Math.min(1, (stageSize.width - 24) / frameWidth, device === "phone" ? (stageSize.height - 24) / (PHONE.height + 20) : 1) : 1;
  const frameHeight = device === "phone" ? PHONE.height + 20 : Math.max(600, (stageSize.height - 24) / scale);

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-navy-950/80 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={`Preview ${template.name}`}>
      <div className="flex w-full max-w-6xl flex-col overflow-hidden bg-ivory-50 sm:rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-950/10 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gold-600">Preview · your event</p>
            <p className="flex items-center gap-2 truncate font-display text-lg text-navy-950">
              {template.name}
              {template.premium ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-navy-950 px-2 py-0.5 text-[10px] font-medium text-gold-300">
                  <Crown size={10} /> ₹{template.price}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-navy-950/15 p-0.5" role="tablist" aria-label="Device">
              {(
                [
                  ["phone", Smartphone, "Phone"],
                  ["desktop", Monitor, "Desktop"],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={device === value}
                  onClick={() => {
                    if (value !== device) setLoaded(false);
                    setDevice(value);
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs",
                    device === value ? "bg-navy-950 text-ivory-50" : "text-navy-700/70",
                  )}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onUse}
              disabled={isSelected || pending}
              className="flex items-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-xs font-medium text-navy-950 disabled:opacity-60"
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {isSelected ? "Current template" : "Use this template"}
            </button>
            <button type="button" onClick={onClose} aria-label="Close preview" className="p-1.5 text-navy-700/60 hover:text-navy-950">
              <X size={20} />
            </button>
          </div>
        </div>

        <div ref={stage} className="relative flex flex-1 items-start justify-center overflow-hidden bg-navy-950/5 pt-3">
          {!loaded ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-navy-700/60">
              <Loader2 size={18} className="animate-spin" /> Loading your page in {template.name}…
            </div>
          ) : null}
          <div
            className={cn("overflow-hidden bg-white shadow-xl", device === "phone" ? "rounded-[2rem] border-[10px] border-navy-950" : "rounded-lg")}
            style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})`, transformOrigin: "top center", flexShrink: 0 }}
          >
            <iframe
              key={`${template.slug}-${device}`}
              src={src}
              title={`${template.name} preview`}
              onLoad={() => setLoaded(true)}
              className="h-full w-full border-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
