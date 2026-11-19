"use client";

import { useState } from "react";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";

import { analyzeContactCsv, IMPORT_OUTCOME_LABELS, type ImportAnalysis, type ImportRowOutcome } from "@/lib/mailer/csv-import";
import { useMailer } from "@/features/mailer/mailer-provider";
import { ErrorText, Field, inputClasses, Modal, primaryButton, secondaryButton } from "@/features/mailer/components/ui";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PROBLEM_OUTCOMES: ImportRowOutcome[] = ["invalid_email", "missing_email", "duplicate_in_file", "duplicate_existing"];

/** Pick a CSV → see what will happen per row → confirm → summary. */
export function CsvImportDialog({ onClose }: { onClose: () => void }) {
  const { data, run } = useMailer();
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [listId, setListId] = useState<string>("");
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ imported: number; analysis: ImportAnalysis } | null>(null);

  function analyze(text: string, events: string[]) {
    setAnalysis(analyzeContactCsv(text, data.contacts.map((c) => c.email), { eventIds: events }));
  }

  async function pickFile(file: File | undefined) {
    setError(null);
    setAnalysis(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is over 5MB — please split it into smaller files.");
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setCsvText(text);
    analyze(text, eventIds);
  }

  function toggleEvent(id: string) {
    const next = eventIds.includes(id) ? eventIds.filter((x) => x !== id) : [...eventIds, id];
    setEventIds(next);
    if (csvText) analyze(csvText, next);
  }

  async function confirmImport() {
    if (!analysis) return;
    setBusy(true);
    const result = await run((repo) => repo.importContacts(analysis.toImport, listId || null));
    setBusy(false);
    if (result.ok) setDone({ imported: result.value.length, analysis });
    else setError(result.error);
  }

  if (done) {
    const skipped = done.analysis.totalRows - done.imported;
    return (
      <Modal title="Import complete" onClose={onClose}>
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
          <div className="text-sm text-emerald-900">
            <p className="font-medium">
              {done.imported} contact{done.imported === 1 ? "" : "s"} imported from {fileName}.
            </p>
            {skipped > 0 ? <p className="mt-0.5">{skipped} row{skipped === 1 ? "" : "s"} skipped — see below.</p> : null}
          </div>
        </div>
        <SummaryGrid analysis={done.analysis} importedOverride={done.imported} />
        <ProblemRows analysis={done.analysis} />
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className={primaryButton}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Import contacts from CSV" onClose={onClose} wide>
      <p className="text-sm text-navy-700/75">
        Needs an <strong>Email</strong> column. First Name, Last Name (or a single Name), Company and Phone are picked up too. Invalid and
        duplicate emails are skipped.
      </p>

      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gold-500/40 px-4 py-8 text-center hover:border-gold-500">
        <FileUp className="text-gold-500" size={26} />
        <span className="text-sm font-medium text-navy-950">{fileName ?? "Choose a .csv file"}</span>
        <span className="text-xs text-navy-700/55">Up to 5MB</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-navy-700/75">Link imported contacts to events</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {data.events.map((ev) => {
              const on = eventIds.includes(ev.id);
              return (
                <button
                  key={ev.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleEvent(ev.id)}
                  className={cn("rounded-full border px-3 py-1 text-xs", on ? "border-gold-500 bg-gold-100 text-navy-950" : "border-navy-950/12 text-navy-700/75")}
                >
                  {ev.name}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Add to list" hint="(optional)" htmlFor="imp-list">
          <select id="imp-list" className={inputClasses} value={listId} onChange={(e) => setListId(e.target.value)}>
            <option value="">— Don&rsquo;t add to a list —</option>
            {data.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <ErrorText>{error ?? analysis?.fatalError}</ErrorText>
      </div>

      {analysis && !analysis.fatalError ? (
        <>
          <SummaryGrid analysis={analysis} />
          <ProblemRows analysis={analysis} />
        </>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryButton}>
          Cancel
        </button>
        <button
          type="button"
          onClick={confirmImport}
          disabled={busy || !analysis || Boolean(analysis.fatalError) || analysis.toImport.length === 0}
          className={primaryButton}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : null}
          Import {analysis && !analysis.fatalError ? analysis.toImport.length : ""} contact{analysis?.toImport.length === 1 ? "" : "s"}
        </button>
      </div>
    </Modal>
  );
}

function SummaryGrid({ analysis, importedOverride }: { analysis: ImportAnalysis; importedOverride?: number }) {
  const items: [string, number, string][] = [
    ["Rows in file", analysis.totalRows, "text-navy-950"],
    [importedOverride === undefined ? "Ready to import" : "Imported", importedOverride ?? analysis.counts.imported, "text-emerald-700"],
    ["Invalid email", analysis.counts.invalid_email, "text-red-700"],
    ["Missing email", analysis.counts.missing_email, "text-red-700"],
    ["Duplicate in file", analysis.counts.duplicate_in_file, "text-amber-700"],
    ["Already a contact", analysis.counts.duplicate_existing, "text-amber-700"],
  ];
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map(([label, n, color]) => (
        <div key={label} className="rounded-xl bg-navy-950/[0.035] px-3 py-2">
          <p className="text-xs text-navy-700/60">{label}</p>
          <p className={cn("text-lg font-semibold tabular-nums", n ? color : "text-navy-700/40")}>{n}</p>
        </div>
      ))}
    </div>
  );
}

function ProblemRows({ analysis }: { analysis: ImportAnalysis }) {
  const problems = analysis.rows.filter((r) => PROBLEM_OUTCOMES.includes(r.outcome));
  if (problems.length === 0) return null;
  return (
    <details className="mt-3 rounded-xl border border-navy-950/10 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-navy-950">Skipped rows ({problems.length})</summary>
      <div className="mt-2 max-h-48 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <tbody>
            {problems.slice(0, 200).map((r) => (
              <tr key={r.line} className="border-t border-navy-950/5">
                <td className="py-1.5 pr-3 text-navy-700/55">Line {r.line}</td>
                <td className="py-1.5 pr-3 text-navy-950 [overflow-wrap:anywhere]">{r.email || "(empty)"}</td>
                <td className="py-1.5 text-navy-700/75">{IMPORT_OUTCOME_LABELS[r.outcome]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {problems.length > 200 ? <p className="py-1.5 text-xs text-navy-700/55">…and {problems.length - 200} more</p> : null}
      </div>
    </details>
  );
}
