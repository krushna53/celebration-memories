"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import type { CustomFormField } from "@/services/custom-forms";
import { submitCustomFormResponseAction } from "@/features/forms/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3.5 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

type FieldValue = string | string[];

function isEmpty(value: FieldValue | undefined): boolean {
  if (value === undefined) return true;
  return Array.isArray(value) ? value.length === 0 : value.trim() === "";
}

export function PublicFormFill({ formId, fields }: { formId: string; fields: CustomFormField[] }) {
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function setValue(fieldId: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function toggleCheckbox(fieldId: string, option: string) {
    setValues((prev) => {
      const current = Array.isArray(prev[fieldId]) ? (prev[fieldId] as string[]) : [];
      const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
      return { ...prev, [fieldId]: next };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    for (const field of fields) {
      if (field.required && isEmpty(values[field.id])) {
        setError(`"${field.label}" is required.`);
        return;
      }
    }

    setSubmitting(true);
    const result = await submitCustomFormResponseAction(formId, values);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-gold-500/20 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-gold-600" size={32} />
        <h2 className="mt-3 font-display text-xl text-navy-950">Thank you!</h2>
        <p className="mt-1 text-sm text-navy-700/60">Your response has been recorded.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 rounded-2xl border border-navy-950/10 bg-white p-6 shadow-sm">
      {fields.map((field) => (
        <div key={field.id}>
          <label className="text-sm font-medium text-navy-950">
            {field.label}
            {field.required ? <span className="ml-1 text-gold-600">*</span> : null}
          </label>
          <div className="mt-1.5">
            <FieldInput field={field} value={values[field.id]} onChange={(v) => setValue(field.id, v)} onToggleCheckbox={(o) => toggleCheckbox(field.id, o)} />
          </div>
        </div>
      ))}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-3 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:brightness-110 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="animate-spin" size={16} /> : "Submit"}
      </button>
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  onToggleCheckbox,
}: {
  field: CustomFormField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  onToggleCheckbox: (option: string) => void;
}) {
  switch (field.fieldType) {
    case "textarea":
      return <textarea rows={3} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClasses} />;
    case "select":
      return (
        <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClasses}>
          <option value="">Select...</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div className="grid gap-1.5">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-navy-800">
              <input type="radio" name={field.id} checked={value === opt} onChange={() => onChange(opt)} /> {opt}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="grid gap-1.5">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-navy-800">
              <input
                type="checkbox"
                checked={Array.isArray(value) ? value.includes(opt) : false}
                onChange={() => onToggleCheckbox(opt)}
              />{" "}
              {opt}
            </label>
          ))}
        </div>
      );
    case "date":
      return <input type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClasses} />;
    case "number":
      return <input type="number" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClasses} />;
    case "email":
      return <input type="email" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClasses} />;
    case "phone":
      return <input type="tel" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClasses} />;
    default:
      return <input type="text" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClasses} />;
  }
}
