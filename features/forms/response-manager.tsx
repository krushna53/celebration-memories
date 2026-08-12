"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Download, Loader2, Pencil, Search, Trash2, Upload, X } from "lucide-react";

import type { CustomFormField, CustomFormResponse } from "@/services/custom-forms";
import {
  bulkImportResponsesAction,
  deleteResponseAction,
  exportResponsesCsvAction,
  updateResponseAction,
} from "@/features/forms/dashboard-actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

function cellText(value: string | string[] | undefined): string {
  if (value === undefined) return "";
  return Array.isArray(value) ? value.join(", ") : value;
}

export function ResponseManager({
  formId,
  fields,
  initialResponses,
}: {
  formId: string;
  fields: CustomFormField[];
  initialResponses: CustomFormResponse[];
}) {
  const [responses, setResponses] = useState(initialResponses);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<CustomFormResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sortedFields = useMemo(() => [...fields].sort((a, b) => a.sortOrder - b.sortOrder), [fields]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return responses;
    return responses.filter((r) => Object.values(r.data).some((v) => cellText(v).toLowerCase().includes(q)));
  }, [responses, search]);

  async function handleExport() {
    setExporting(true);
    const result = await exportResponsesCsvAction(formId);
    setExporting(false);
    if (!result.success) {
      alert(result.error);
      return;
    }
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleCsvFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        setImporting(true);
        const result = await bulkImportResponsesAction(formId, results.data);
        setImporting(false);
        if (result.success) {
          setImportSummary(`Imported ${result.created} responses (${result.skipped} skipped).`);
          window.location.reload();
        } else {
          alert(result.error);
        }
      },
    });
  }

  async function handleDelete(response: CustomFormResponse) {
    if (!confirm("Delete this response? This can't be undone.")) return;
    const result = await deleteResponseAction(response.id);
    if (result.success) {
      setResponses((prev) => prev.filter((r) => r.id !== response.id));
    } else {
      alert(result.error);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-700/40" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search responses..."
            className={`${inputClasses} pl-9`}
          />
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 rounded-full border border-navy-950/15 px-3.5 py-2 text-xs font-medium text-navy-700/70 hover:border-gold-500/40 hover:text-gold-700 disabled:opacity-60"
          >
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Import CSV
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || responses.length === 0}
            className="flex items-center gap-1.5 rounded-full border border-navy-950/15 px-3.5 py-2 text-xs font-medium text-navy-700/70 hover:border-gold-500/40 hover:text-gold-700 disabled:opacity-60"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export CSV
          </button>
        </div>
      </div>

      {importSummary ? <p className="mt-2 text-xs text-navy-700/60">{importSummary}</p> : null}
      <p className="mt-1 text-xs text-navy-700/40">
        CSV columns should match your field labels: {sortedFields.map((f) => f.label).join(", ") || "(no fields yet)"}
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-navy-950/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy-950/5 text-xs uppercase tracking-wide text-navy-700/60">
            <tr>
              {sortedFields.map((f) => (
                <th key={f.id} className="whitespace-nowrap px-4 py-3">
                  {f.label}
                </th>
              ))}
              <th className="whitespace-nowrap px-4 py-3">Submitted</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-950/5">
            {filtered.map((response) => (
              <tr key={response.id}>
                {sortedFields.map((f) => (
                  <td key={f.id} className="max-w-[200px] truncate px-4 py-3 text-navy-800">
                    {cellText(response.data[f.id])}
                  </td>
                ))}
                <td className="whitespace-nowrap px-4 py-3 text-xs text-navy-700/50">
                  {new Date(response.submittedAt).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button type="button" onClick={() => setEditing(response)} className="mr-2 inline-flex items-center text-navy-700/60 hover:text-navy-950">
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => handleDelete(response)} className="inline-flex items-center text-navy-700/60 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={sortedFields.length + 2} className="px-4 py-8 text-center text-sm text-navy-700/50">
                  No responses {search ? "match your search" : "yet"}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editing ? (
        <EditResponseModal
          response={editing}
          fields={sortedFields}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setResponses((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function EditResponseModal({
  response,
  fields,
  onClose,
  onSaved,
}: {
  response: CustomFormResponse;
  fields: CustomFormField[];
  onClose: () => void;
  onSaved: (response: CustomFormResponse) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.id] = cellText(response.data[f.id]);
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const data: Record<string, string | string[]> = {};
    for (const f of fields) {
      data[f.id] = f.fieldType === "checkbox" ? values[f.id]!.split(",").map((s) => s.trim()).filter(Boolean) : values[f.id]!;
    }
    const result = await updateResponseAction(response.id, data);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSaved({ ...response, data });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base text-navy-950">Edit Response</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-navy-700/50 hover:text-navy-950">
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 grid max-h-[60vh] gap-3 overflow-y-auto">
          {fields.map((f) => (
            <div key={f.id}>
              <label className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">{f.label}</label>
              <input
                value={values[f.id] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                className={`${inputClasses} mt-1`}
              />
            </div>
          ))}
        </div>
        {error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : "Save"}
        </button>
      </div>
    </div>
  );
}
