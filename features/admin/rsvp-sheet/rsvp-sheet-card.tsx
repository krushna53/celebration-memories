"use client";

import { useState } from "react";
import { Check, Copy, FileSpreadsheet, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { disableRsvpSheetLinkAction, regenerateRsvpSheetLinkAction } from "@/features/admin/rsvp-sheet/actions";

/**
 * "Live Google Sheet" on /admin/rsvps: a secret CSV link (services/rsvp-sheet.ts)
 * the host pastes into =IMPORTDATA(...) in their own Google Sheet, then shares
 * that sheet with someone who has no admin login.
 */
export function RsvpSheetCard({ eventId, initialUrl }: { eventId: string; initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const formula = url ? `=IMPORTDATA("${url}")` : "";

  async function run(action: typeof regenerateRsvpSheetLinkAction, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const result = await action(eventId);
    setBusy(false);
    if (result.success) setUrl(result.url);
    else setError(result.error);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(formula);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select the formula and copy it by hand.");
    }
  }

  return (
    <section className="rounded-2xl border border-navy-950/10 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <FileSpreadsheet size={20} className="mt-0.5 shrink-0 text-gold-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg text-navy-950">Live Google Sheet</h2>
          <p className="mt-1 text-sm text-navy-700/70">
            Share the RSVP list with someone who doesn&rsquo;t have an admin login. The sheet lives in your Google Drive and
            fills itself in as guests reply (Google refreshes it about once an hour).
          </p>

          {url ? (
            <>
              <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-navy-700">
                <li>
                  Open{" "}
                  <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-gold-700 underline underline-offset-2">
                    a new Google Sheet
                  </a>{" "}
                  and click cell A1.
                </li>
                <li>Paste this formula and press Enter:</li>
              </ol>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={formula}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Google Sheets formula"
                  className="min-w-0 flex-1 rounded-lg border border-navy-950/15 bg-ivory-50 px-3 py-2 font-mono text-xs text-navy-950"
                />
                <Button type="button" onClick={copy} className="shrink-0">
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy formula"}
                </Button>
              </div>
              <ol start={3} className="mt-3 list-decimal space-y-1 pl-5 text-sm text-navy-700">
                <li>Click Share and add the person&rsquo;s email (Viewer is enough).</li>
              </ol>
              <p className="mt-4 text-xs text-navy-700/60">
                Anyone with this link can see guests&rsquo; names, phone numbers and emails. Only put it in your own sheet.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <button
                  type="button"
                  disabled={busy}
                  className="text-gold-700 underline underline-offset-4 disabled:opacity-50"
                  onClick={() => run(regenerateRsvpSheetLinkAction, "Make a new link? Sheets using the current one will stop updating until you paste the new formula.")}
                >
                  Make a new link
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="text-navy-700/70 underline underline-offset-4 disabled:opacity-50"
                  onClick={() => run(disableRsvpSheetLinkAction, "Turn off the link? Sheets using it will stop updating.")}
                >
                  Turn off
                </button>
              </div>
            </>
          ) : (
            <Button type="button" className="mt-4" disabled={busy} onClick={() => run(regenerateRsvpSheetLinkAction)}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Create sheet link
            </Button>
          )}
          {busy && url ? <Loader2 size={14} className="mt-2 animate-spin text-navy-700" aria-label="Working" /> : null}
          {error ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
