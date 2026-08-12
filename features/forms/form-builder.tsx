"use client";

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ImagePlus,
  Loader2,
  Mail,
  Plus,
  Rocket,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { CustomFieldType, CustomForm, CustomFormField } from "@/services/custom-forms";
import {
  confirmFormCoverUploadAction,
  createFieldAction,
  deleteFieldAction,
  publishFormAction,
  reorderFieldsAction,
  requestFormCoverUploadUrlAction,
  updateFieldAction,
  updateFormMetaAction,
} from "@/features/forms/builder-actions";
import { FormOwnerAccountForm } from "@/features/forms/account-form";
import { AiFormGenerator } from "@/features/forms/ai-form-generator";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

const FIELD_TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Short answer" },
  { value: "textarea", label: "Long answer" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Multiple choice" },
  { value: "checkbox", label: "Checkboxes" },
];

const NEEDS_OPTIONS: readonly CustomFieldType[] = ["select", "radio", "checkbox"];

interface FormBuilderProps {
  token: string;
  publicUrl: string;
  initialForm: CustomForm;
  initialFields: CustomFormField[];
}

export function FormBuilder({ token, publicUrl, initialForm, initialFields }: FormBuilderProps) {
  const [form, setForm] = useState(initialForm);
  const [fields, setFields] = useState(initialFields);
  const [title, setTitle] = useState(initialForm.title);
  const [description, setDescription] = useState(initialForm.description ?? "");
  const [notifyEmail, setNotifyEmail] = useState(initialForm.notifyEmail ?? "");
  const [savingMeta, setSavingMeta] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveMeta() {
    setSavingMeta(true);
    const result = await updateFormMetaAction(token, {
      title,
      description: description || null,
      notifyEmail: notifyEmail || null,
    });
    setSavingMeta(false);
    if (result.success) {
      setForm((prev) => ({ ...prev, title, description: description || null, notifyEmail: notifyEmail || null }));
    }
  }

  async function handleCoverFile(file: File) {
    setUploadingCover(true);
    const signed = await requestFormCoverUploadUrlAction(token, file.name, file.type, file.size);
    if (!signed.success) {
      setUploadingCover(false);
      alert(signed.error);
      return;
    }
    const putResult = await fetch(signed.data.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (!putResult.ok) {
      setUploadingCover(false);
      alert("Upload failed — please try again.");
      return;
    }
    const confirmed = await confirmFormCoverUploadAction(token, signed.data.path);
    setUploadingCover(false);
    if (confirmed.success) {
      setForm((prev) => ({ ...prev, coverImagePath: signed.data.path, coverImageUrl: URL.createObjectURL(file) }));
    } else {
      alert(confirmed.error);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    const result = await publishFormAction(token);
    setPublishing(false);
    if (result.success) {
      setForm((prev) => ({ ...prev, status: "published" }));
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

  async function handleAddField(input: { label: string; fieldType: CustomFieldType; required: boolean; options: string[] | null }) {
    const result = await createFieldAction(token, input);
    if (!result.success) {
      alert(result.error);
      return;
    }
    setFields((prev) => [
      ...prev,
      { id: result.id, formId: form.id, label: input.label, fieldType: input.fieldType, required: input.required, options: input.options, sortOrder: prev.length },
    ]);
  }

  async function handleDeleteField(fieldId: string) {
    if (!confirm("Delete this field? Existing responses keep their data, but it won't show in the form anymore.")) return;
    const result = await deleteFieldAction(token, fieldId);
    if (result.success) {
      setFields((prev) => prev.filter((f) => f.id !== fieldId));
    } else {
      alert(result.error);
    }
  }

  async function handleToggleRequired(field: CustomFormField) {
    const nextRequired = !field.required;
    setFields((prev) => prev.map((f) => (f.id === field.id ? { ...f, required: nextRequired } : f)));
    const result = await updateFieldAction(token, field.id, { required: nextRequired });
    if (!result.success) alert(result.error);
  }

  function moveField(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= fields.length) return;
    const reordered = [...fields];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved!);
    setFields(reordered);
    reorderFieldsAction(token, reordered.map((f) => f.id)).catch(() => {});
  }

  /** AI generation (features/forms/ai-form-generator.tsx) persists directly and hands back the saved rows, so this just swaps local state to match — same "server is the source of truth" approach as saveMeta/handleCoverFile above. */
  function handleGenerated(result: { title: string; description: string | null; fields: CustomFormField[] }) {
    setForm((prev) => ({ ...prev, title: result.title, description: result.description }));
    setTitle(result.title);
    setDescription(result.description ?? "");
    setFields(result.fields);
  }

  return (
    <div className="grid gap-6">
      <AiFormGenerator token={token} hasExistingFields={fields.length > 0} onGenerated={handleGenerated} />

      <section className="rounded-xl border border-navy-950/10 bg-white p-5">
        <label className={labelClasses} htmlFor="form-title">
          Form title
        </label>
        <input id="form-title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveMeta} className={`${inputClasses} mt-1.5`} />

        <label className={`${labelClasses} mt-4 block`} htmlFor="form-description">
          Description (optional)
        </label>
        <textarea
          id="form-description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={saveMeta}
          className={`${inputClasses} mt-1.5`}
        />

        <div className="mt-4">
          <span className={labelClasses}>Cover photo (optional)</span>
          <div className="mt-1.5 flex items-center gap-3">
            {form.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.coverImageUrl} alt="" className="h-16 w-24 rounded-lg object-cover" />
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleCoverFile(e.target.files[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingCover}
              className="flex items-center gap-1.5 rounded-full border border-navy-950/15 px-3.5 py-2 text-xs font-medium text-navy-700/70 hover:border-gold-500/40 hover:text-gold-700 disabled:opacity-60"
            >
              {uploadingCover ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
              {form.coverImagePath ? "Replace photo" : "Add photo"}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClasses} htmlFor="notify-email">
            Email me when someone submits (optional)
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <Mail size={15} className="text-navy-700/40" />
            <input
              id="notify-email"
              type="email"
              placeholder="you@example.com"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              onBlur={saveMeta}
              className={inputClasses}
            />
          </div>
        </div>

        {savingMeta ? <p className="mt-2 text-xs text-navy-700/40">Saving...</p> : null}
      </section>

      <section className="rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Fields</h2>
        <div className="mt-3 grid gap-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center justify-between gap-3 rounded-lg border border-navy-950/10 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-navy-950">
                  {field.label}
                  {field.required ? <span className="ml-1 text-gold-600">*</span> : null}
                </p>
                <p className="text-xs text-navy-700/50">{FIELD_TYPE_OPTIONS.find((o) => o.value === field.fieldType)?.label}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => moveField(index, -1)} disabled={index === 0} className="p-1.5 text-navy-700/50 hover:text-navy-950 disabled:opacity-30">
                  <ArrowUp size={14} />
                </button>
                <button type="button" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1} className="p-1.5 text-navy-700/50 hover:text-navy-950 disabled:opacity-30">
                  <ArrowDown size={14} />
                </button>
                <label className="flex items-center gap-1 px-1.5 text-xs text-navy-700/60">
                  <input type="checkbox" checked={field.required} onChange={() => handleToggleRequired(field)} /> Required
                </label>
                <button type="button" onClick={() => handleDeleteField(field.id)} className="p-1.5 text-navy-700/50 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {fields.length === 0 ? <p className="py-4 text-center text-sm text-navy-700/50">No fields yet — add one below.</p> : null}
        </div>

        <AddFieldForm onAdd={handleAddField} />
      </section>

      <section className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-5">
        {form.status === "published" ? (
          <>
            <p className="flex items-center gap-2 text-sm font-medium text-navy-950">
              <Rocket size={16} className="text-gold-600" /> Your form is live
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-navy-950/10 bg-white px-3 py-2 text-sm text-navy-700">
              <span className="truncate">{publicUrl}</span>
              <button type="button" onClick={copyLink} className="ml-auto shrink-0 text-gold-700 hover:text-gold-800">
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-navy-700/70">
              Once you publish, anyone with the link can fill out this form. You can keep editing fields after publishing.
            </p>
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || fields.length === 0}
              className="mt-3 flex items-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:brightness-110 disabled:opacity-60"
            >
              {publishing ? <Loader2 className="animate-spin" size={16} /> : <Rocket size={16} />}
              Publish Form
            </button>
            {fields.length === 0 ? <p className="mt-2 text-xs text-navy-700/50">Add at least one field first.</p> : null}
          </>
        )}
      </section>

      {form.status === "published" && !form.ownerId ? <FormOwnerAccountForm token={token} /> : null}
    </div>
  );
}

function AddFieldForm({
  onAdd,
}: {
  onAdd: (input: { label: string; fieldType: CustomFieldType; required: boolean; options: string[] | null }) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");
  const [adding, setAdding] = useState(false);

  const needsOptions = NEEDS_OPTIONS.includes(fieldType);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setAdding(true);
    const options = needsOptions
      ? optionsText.split(",").map((s) => s.trim()).filter(Boolean)
      : null;
    await onAdd({ label: label.trim(), fieldType, required, options });
    setAdding(false);
    setLabel("");
    setRequired(false);
    setOptionsText("");
    setFieldType("text");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-2.5 rounded-lg border border-dashed border-navy-950/15 p-3.5 sm:grid-cols-[1fr_auto]">
      <input placeholder="Field label, e.g. Full Name" value={label} onChange={(e) => setLabel(e.target.value)} className={inputClasses} />
      <select value={fieldType} onChange={(e) => setFieldType(e.target.value as CustomFieldType)} className={cn(inputClasses, "sm:w-44")}>
        {FIELD_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {needsOptions ? (
        <input
          placeholder="Options, comma separated"
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          className={cn(inputClasses, "sm:col-span-2")}
        />
      ) : null}
      <label className="flex items-center gap-1.5 text-xs text-navy-700/60">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required
      </label>
      <button
        type="submit"
        disabled={adding || !label.trim()}
        className="flex items-center justify-center gap-1.5 rounded-full border border-gold-500/40 px-4 py-2 text-xs font-medium text-gold-700 hover:border-gold-500 hover:bg-gold-500/5 disabled:opacity-60 sm:col-span-2"
      >
        {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add Field
      </button>
    </form>
  );
}
