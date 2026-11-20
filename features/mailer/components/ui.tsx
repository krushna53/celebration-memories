"use client";

import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CampaignKind, RecipientStatus } from "@/types/mailer";

/** Small shared building blocks for the Mailer screens. */

export const inputClasses =
  "w-full rounded-xl border border-navy-950/12 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/25";
export const labelClasses = "text-xs font-medium text-navy-700/75";

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:brightness-105 disabled:opacity-50";
export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-navy-950/12 bg-white px-3.5 py-2 text-sm font-medium text-navy-950 hover:bg-navy-950/[0.03] disabled:opacity-50";
export const dangerButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50";

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelClasses}>
        {label}
        {hint ? <span className="ml-1 font-normal text-navy-700/45">{hint}</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-navy-950/[0.07] bg-white p-4 shadow-[0_1px_2px_rgba(30,27,75,0.04)] sm:p-5", className)}>{children}</div>;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  note,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  note?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <div className="rounded-2xl border border-navy-950/[0.07] bg-white p-4 shadow-[0_1px_2px_rgba(30,27,75,0.04)]">
      <div className="flex items-center gap-2 text-sm text-navy-700/75">
        <Icon size={16} className="text-navy-700/60" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="font-display text-3xl tabular-nums leading-none text-navy-950">{value}</p>
        {note ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              tone === "good" && "bg-emerald-50 text-emerald-700",
              tone === "bad" && "bg-red-50 text-red-700",
              tone === "neutral" && "bg-navy-950/[0.05] text-navy-700/70",
            )}
          >
            {note}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** One metric in a campaign card's grey metrics row. */
export function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-navy-950/[0.035] px-3 py-2.5">
      <p className="text-xs text-navy-700/60">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-navy-950">{value}</p>
    </div>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {children}
    </p>
  );
}

export function SimulatedBadge() {
  return (
    <span
      title="No real email was sent — results come from the mock-mode simulator."
      className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800"
    >
      Simulated
    </span>
  );
}

export function CampaignStatusPill({ status }: { status: "draft" | "sent" }) {
  return status === "sent" ? (
    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Sent</span>
  ) : (
    <span className="rounded-full bg-navy-950/[0.06] px-2.5 py-0.5 text-xs font-medium text-navy-700/80">Draft</span>
  );
}

const KIND_LABELS: Record<CampaignKind, string> = {
  diwali: "Diwali",
  new_year: "New Year",
  invitation: "Invitation",
  announcement: "Announcement",
};

export function KindTag({ kind }: { kind: CampaignKind }) {
  return <span className="rounded-md border border-navy-950/10 px-2 py-0.5 text-xs text-navy-700/75">{KIND_LABELS[kind]}</span>;
}

export const KIND_ICON_BG: Record<CampaignKind, string> = {
  diwali: "bg-amber-50 text-amber-700",
  new_year: "bg-indigo-50 text-indigo-700",
  invitation: "bg-gold-100 text-gold-600",
  announcement: "bg-sky-50 text-sky-700",
};

export const STATUS_STYLES: Record<RecipientStatus, string> = {
  queued: "bg-navy-950/[0.05] text-navy-700",
  sent: "bg-sky-50 text-sky-800",
  delivered: "bg-emerald-50 text-emerald-800",
  clicked: "bg-violet-50 text-violet-800",
  bounced: "bg-orange-50 text-orange-800",
  failed: "bg-red-50 text-red-800",
};

export function StatusBadge({ status }: { status: RecipientStatus }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLES[status])}>{status}</span>;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn(inputClasses, "bg-navy-950/[0.025]", className)}
    />
  );
}

/** Plain modal dialog: Escape and the backdrop close it; focus moves into it on open. */
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl outline-none sm:rounded-2xl sm:p-6",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-xl text-navy-950">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-navy-700/60 hover:bg-navy-950/5">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-navy-950/15 bg-white px-6 py-10 text-center">
      <p className="font-medium text-navy-950">{title}</p>
      {children ? <div className="mt-1 text-sm text-navy-700/65">{children}</div> : null}
    </div>
  );
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
