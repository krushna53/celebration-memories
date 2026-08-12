"use client";

import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";

import type { CustomFormStatus } from "@/services/custom-forms";
import { setFormStatusAction } from "@/features/forms/dashboard-actions";

const STATUS_LABEL: Record<CustomFormStatus, string> = {
  draft: "Draft",
  published: "Live",
  closed: "Closed",
};

/** Publish-link display + open/close toggle for the response dashboard header — the dashboard-side counterpart to form-builder.tsx's publish button, for an owner managing a form after the fact. */
export function FormStatusControl({
  formId,
  status,
  publicUrl,
}: {
  formId: string;
  status: CustomFormStatus;
  publicUrl: string;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function toggle() {
    const next = currentStatus === "closed" ? "published" : "closed";
    setBusy(true);
    const result = await setFormStatusAction(formId, next);
    setBusy(false);
    if (result.success) {
      setCurrentStatus(next);
    } else {
      alert(result.error);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          currentStatus === "published" ? "bg-green-100 text-green-800" : "bg-navy-950/5 text-navy-700/60"
        }`}
      >
        {STATUS_LABEL[currentStatus]}
      </span>
      {currentStatus !== "draft" ? (
        <>
          <button type="button" onClick={copyLink} className="flex items-center gap-1 text-xs text-gold-700 hover:text-gold-800">
            {copied ? <Check size={13} /> : <Copy size={13} />} Copy link
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className="flex items-center gap-1 rounded-full border border-navy-950/15 px-3 py-1.5 text-xs text-navy-700/70 hover:border-gold-500/40 hover:text-gold-700 disabled:opacity-60"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : null}
            {currentStatus === "closed" ? "Reopen" : "Close form"}
          </button>
        </>
      ) : null}
    </div>
  );
}
