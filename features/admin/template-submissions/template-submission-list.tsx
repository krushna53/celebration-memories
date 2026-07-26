"use client";

import { useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { deriveThemeFromSubmission } from "@/lib/community-theme";
import {
  approveTemplateSubmissionAction,
  rejectTemplateSubmissionAction,
} from "@/features/admin/template-submissions/actions";
import type { TemplateSubmissionRecord } from "@/types/template-submission";

interface TemplateSubmissionListProps {
  initialSubmissions: TemplateSubmissionRecord[];
}

const STATUS_STYLES: Record<TemplateSubmissionRecord["status"], string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-green-200 bg-green-50 text-green-700",
  rejected: "border-navy-950/10 bg-navy-950/[0.03] text-navy-700/50",
};

function SwatchPreview({ submission }: { submission: TemplateSubmissionRecord }) {
  const theme = deriveThemeFromSubmission(submission);
  return (
    <div
      className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg px-4 text-center"
      style={{ backgroundColor: theme.colors.navy950 }}
    >
      <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.colors.gold300 }}>
        {submission.category}
      </p>
      <p className="text-lg" style={{ color: theme.colors.ivory50, fontFamily: theme.fontDisplayVar }}>
        {submission.name}
      </p>
      <div className="h-px w-12" style={{ backgroundColor: theme.colors.gold500 }} />
      <p className="text-[10px]" style={{ color: theme.colors.gold200 }}>
        {submission.fontDisplay} · {submission.animation}
      </p>
    </div>
  );
}

export function TemplateSubmissionList({ initialSubmissions }: TemplateSubmissionListProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  async function handleApprove(id: string) {
    setBusyId(id);
    const result = await approveTemplateSubmissionAction(id);
    if (result.success) {
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "approved" as const } : s)),
      );
    }
    setBusyId(null);
  }

  async function handleReject(id: string) {
    setBusyId(id);
    const note = noteDrafts[id] ?? "";
    const result = await rejectTemplateSubmissionAction(id, note);
    if (result.success) {
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "rejected" as const, adminNote: note || null } : s)),
      );
    }
    setBusyId(null);
  }

  if (submissions.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
        No template submissions yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {submissions.map((submission) => (
        <div
          key={submission.id}
          className="flex flex-col overflow-hidden rounded-xl border border-navy-950/10 bg-white shadow-sm"
        >
          <div className="p-3">
            <SwatchPreview submission={submission} />
          </div>

          <div className="flex flex-1 flex-col gap-1.5 px-4 pb-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  STATUS_STYLES[submission.status],
                )}
              >
                {submission.status}
              </span>
              <span className="text-xs text-navy-700/40">
                {new Date(submission.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-navy-700/80">{submission.description}</p>
            <p className="mt-1 text-xs text-navy-700/60">
              By {submission.authorName}
              {submission.authorWebsite ? (
                <a
                  href={submission.authorWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center gap-0.5 text-gold-600 hover:underline"
                >
                  website <ExternalLink size={10} />
                </a>
              ) : null}
            </p>
            <p className="text-xs text-navy-700/40">{submission.authorEmail}</p>
            {submission.adminNote ? (
              <p className="mt-1 text-xs italic text-navy-700/50">Note: {submission.adminNote}</p>
            ) : null}
          </div>

          {submission.status === "pending" ? (
            <div className="border-t border-navy-950/5 p-3">
              <input
                placeholder="Optional note if rejecting..."
                value={noteDrafts[submission.id] ?? ""}
                onChange={(e) =>
                  setNoteDrafts((prev) => ({ ...prev, [submission.id]: e.target.value }))
                }
                className="w-full rounded-lg border border-navy-950/15 px-2.5 py-1.5 text-xs focus:border-gold-500 focus:outline-none"
              />
              <div className="mt-2 flex gap-2">
                <button
                  disabled={busyId === submission.id}
                  onClick={() => handleApprove(submission.id)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  disabled={busyId === submission.id}
                  onClick={() => handleReject(submission.id)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-950/5 disabled:opacity-50"
                >
                  <X size={14} /> Reject
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
