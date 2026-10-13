"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ATTENDANCE_LABELS, ATTENDANCE_OPTIONS } from "@/types/rsvp";
import {
  BUILT_IN_FIELDS,
  CORPORATE_RSVP_PRESET,
  DEFAULT_FIELD_LABELS,
  DEFAULT_RSVP_CONFIG,
  MAX_QUESTIONS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  REQUIRABLE_FIELDS,
  type CustomQuestion,
  type QuestionType,
  type RsvpConfig,
} from "@/lib/rsvp-config";
import type { SaveRsvpConfigResult } from "@/features/admin/rsvp-form/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

function newQuestionId(existing: CustomQuestion[]): string {
  let n = existing.length + 1;
  while (existing.some((q) => q.id === `q${n}`)) n++;
  return `q${n}`;
}

/**
 * RSVP form builder — used on /admin/rsvp-form and the wizard's RSVP Form
 * step. Name and the attendance question are always on the form; every
 * other field can be shown/hidden, renamed and (where it makes sense)
 * required, and hosts can add their own questions. Saved config is
 * re-validated server-side (lib/rsvp-config.ts sanitizeRsvpConfig).
 */
export function RsvpFormBuilder({
  initialConfig,
  saveAction,
  corporate = false,
  onSaved,
}: {
  initialConfig: RsvpConfig;
  saveAction: (config: RsvpConfig) => Promise<SaveRsvpConfigResult>;
  corporate?: boolean;
  onSaved?: () => void;
}) {
  const [config, setConfig] = useState<RsvpConfig>(initialConfig);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function update(patch: Partial<RsvpConfig>) {
    setConfig((c) => ({ ...c, ...patch }));
    setMessage(null);
  }

  function updateField(field: (typeof BUILT_IN_FIELDS)[number], patch: Partial<RsvpConfig["fields"][typeof field]>) {
    setConfig((c) => ({ ...c, fields: { ...c.fields, [field]: { ...c.fields[field], ...patch } } }));
    setMessage(null);
  }

  function updateQuestion(index: number, patch: Partial<CustomQuestion>) {
    setConfig((c) => ({ ...c, questions: c.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)) }));
    setMessage(null);
  }

  function moveQuestion(index: number, delta: -1 | 1) {
    setConfig((c) => {
      const next = [...c.questions];
      const target = index + delta;
      if (target < 0 || target >= next.length) return c;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return { ...c, questions: next };
    });
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveAction(config);
      if (result.success) {
        setConfig(result.config);
        setMessage({ ok: true, text: "RSVP form saved." });
        onSaved?.();
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-navy-700/70">Start from:</span>
        <button type="button" className="rounded-full border border-navy-950/15 px-3 py-1 hover:border-gold-500" onClick={() => setConfig(DEFAULT_RSVP_CONFIG)}>
          Standard form
        </button>
        <button
          type="button"
          className={corporate ? "rounded-full border border-gold-500 bg-gold-500/10 px-3 py-1" : "rounded-full border border-navy-950/15 px-3 py-1 hover:border-gold-500"}
          onClick={() => setConfig(CORPORATE_RSVP_PRESET)}
        >
          Corporate event
        </button>
      </div>

      <section className="rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Attendance question</h2>
        <p className="mt-1 text-sm text-navy-700/65">Always on the form. Rename the choices to fit your event.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {ATTENDANCE_OPTIONS.map((option) => (
            <label key={option} className="grid gap-1.5">
              <span className={labelClasses}>{ATTENDANCE_LABELS[option]}</span>
              <input
                className={inputClasses}
                value={config.attendanceLabels[option]}
                maxLength={40}
                placeholder={ATTENDANCE_LABELS[option]}
                disabled={option === "maybe" && !config.allowMaybe}
                onChange={(e) => update({ attendanceLabels: { ...config.attendanceLabels, [option]: e.target.value } })}
              />
            </label>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-navy-950">
          <input type="checkbox" className="h-4 w-4 accent-gold-500" checked={config.allowMaybe} onChange={(e) => update({ allowMaybe: e.target.checked })} />
          Offer a &ldquo;Maybe&rdquo; option
        </label>
      </section>

      <section className="rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Fields</h2>
        <p className="mt-1 text-sm text-navy-700/65">Full name is always asked. Choose what else to ask, and rename anything.</p>
        <div className="mt-4 divide-y divide-navy-950/5">
          {BUILT_IN_FIELDS.map((field) => {
            const setting = config.fields[field];
            return (
              <div key={field} className="grid gap-3 py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center">
                <label className="flex items-center gap-2 text-sm font-medium text-navy-950">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-gold-500"
                    checked={setting.visible}
                    onChange={(e) => updateField(field, { visible: e.target.checked, required: e.target.checked && setting.required })}
                  />
                  {DEFAULT_FIELD_LABELS[field]}
                </label>
                <input
                  className={inputClasses}
                  value={setting.label}
                  maxLength={80}
                  placeholder={`Label (default: ${DEFAULT_FIELD_LABELS[field]})`}
                  disabled={!setting.visible}
                  aria-label={`${DEFAULT_FIELD_LABELS[field]} label`}
                  onChange={(e) => updateField(field, { label: e.target.value })}
                />
                {REQUIRABLE_FIELDS.includes(field) ? (
                  <label className="flex items-center gap-2 text-sm text-navy-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-gold-500"
                      checked={setting.required}
                      disabled={!setting.visible}
                      onChange={(e) => updateField(field, { required: e.target.checked })}
                    />
                    Required
                  </label>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-navy-950/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-navy-950">Your questions</h2>
            <p className="mt-1 text-sm text-navy-700/65">Up to {MAX_QUESTIONS}. Answers appear on this page and in each RSVP.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={config.questions.length >= MAX_QUESTIONS}
            onClick={() =>
              update({
                questions: [...config.questions, { id: newQuestionId(config.questions), label: "", type: "text", options: [], required: false }],
              })
            }
          >
            <Plus size={16} /> Add question
          </Button>
        </div>
        {config.questions.length === 0 ? (
          <p className="mt-4 text-sm text-navy-700/50">No extra questions yet.</p>
        ) : (
          <ol className="mt-4 grid gap-4">
            {config.questions.map((q, index) => (
              <li key={q.id} className="rounded-lg border border-navy-950/10 p-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <input
                    className={inputClasses}
                    value={q.label}
                    maxLength={80}
                    placeholder="Question, e.g. Company / organisation"
                    aria-label={`Question ${index + 1}`}
                    onChange={(e) => updateQuestion(index, { label: e.target.value })}
                  />
                  <select
                    className={inputClasses}
                    value={q.type}
                    aria-label={`Question ${index + 1} type`}
                    onChange={(e) => {
                      const type = e.target.value as QuestionType;
                      updateQuestion(index, { type, options: type === "choice" && q.options.length < 2 ? ["", ""] : q.options });
                    }}
                  >
                    {QUESTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {QUESTION_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                {q.type === "choice" ? (
                  <div className="mt-3 grid gap-2">
                    {q.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex gap-2">
                        <input
                          className={inputClasses}
                          value={option}
                          maxLength={60}
                          placeholder={`Choice ${optionIndex + 1}`}
                          aria-label={`Question ${index + 1} choice ${optionIndex + 1}`}
                          onChange={(e) =>
                            updateQuestion(index, { options: q.options.map((o, i) => (i === optionIndex ? e.target.value : o)) })
                          }
                        />
                        <button
                          type="button"
                          aria-label="Remove choice"
                          className="text-navy-700/50 hover:text-red-600"
                          onClick={() => updateQuestion(index, { options: q.options.filter((_, i) => i !== optionIndex) })}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    {q.options.length < 10 ? (
                      <button type="button" className="justify-self-start text-sm text-gold-700 underline" onClick={() => updateQuestion(index, { options: [...q.options, ""] })}>
                        Add a choice
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2 text-navy-700">
                    <input type="checkbox" className="h-4 w-4 accent-gold-500" checked={q.required} onChange={(e) => updateQuestion(index, { required: e.target.checked })} />
                    Required
                  </label>
                  <button type="button" aria-label="Move up" disabled={index === 0} className="text-navy-700/60 hover:text-navy-950 disabled:opacity-30" onClick={() => moveQuestion(index, -1)}>
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" aria-label="Move down" disabled={index === config.questions.length - 1} className="text-navy-700/60 hover:text-navy-950 disabled:opacity-30" onClick={() => moveQuestion(index, 1)}>
                    <ArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    className="ml-auto inline-flex items-center gap-1 text-navy-700/60 hover:text-red-600"
                    onClick={() => update({ questions: config.questions.filter((_, i) => i !== index) })}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-xs text-navy-700/50">Questions without wording, and multiple-choice questions with fewer than two choices, are skipped when you save.</p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : null}
          Save RSVP form
        </Button>
        {message ? (
          <p className={message.ok ? "text-sm text-green-700" : "text-sm text-red-600"} role="status">
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
