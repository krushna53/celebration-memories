"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  attestWhatsAppConsentAction,
  processEventWhatsAppOutboxAction,
  revokeWhatsAppConsentAction,
  saveEventWhatsAppSettingsAction,
  sendWhatsAppInvitationsAction,
} from "@/features/admin/whatsapp/actions";
import type { EventWhatsAppSettings } from "@/lib/whatsapp-cloud/types";
import type { WhatsAppGuestRow } from "@/services/whatsapp";

const cardClasses = "rounded-xl border border-navy-950/10 bg-white p-5";
const pillClass = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-xs font-medium transition-luxury duration-300 ${
    active ? "border-gold-500 bg-gold-500/10 text-gold-600" : "border-navy-950/15 text-navy-700/70 hover:border-navy-950/30"
  }`;

type Notice = { kind: "success" | "error"; text: string } | null;

function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p role="status" className={`mt-3 text-sm ${notice.kind === "error" ? "text-red-700" : "text-emerald-700"}`}>
      {notice.text}
    </p>
  );
}

const TOGGLES: Array<{ key: Exclude<keyof EventWhatsAppSettings, "eventId" | "enabled">; label: string; hint: string }> = [
  { key: "rsvpConfirmation", label: "RSVP confirmation", hint: "Right after a guest RSVPs (and again if they change their answer)." },
  { key: "reminder24h", label: "Reminder 24 hours before", hint: "To guests who said Attending or Maybe." },
  { key: "reminder2h", label: "Reminder 2 hours before", hint: "To guests who said Attending or Maybe." },
  { key: "thankYou", label: "Thank you + photo sharing", hint: "2 hours after the event ends, with their upload link." },
  { key: "feedbackRequest", label: "Feedback request", hint: "The day after the event." },
  { key: "memoryReminder", label: "Photo/video reminder", hint: "3 days after, only to guests who haven't uploaded anything." },
];

type Filter = "all" | "opted_in" | "none" | "opted_out";

export function EventWhatsAppManager({
  settings,
  guests,
  sendingAvailable,
}: {
  settings: EventWhatsAppSettings;
  guests: WhatsAppGuestRow[];
  sendingAvailable: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [saving, startSaving] = useTransition();
  const [settingsNotice, setSettingsNotice] = useState<Notice>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attested, setAttested] = useState(false);
  const [consentNotice, setConsentNotice] = useState<Notice>(null);
  const [consentPending, startConsent] = useTransition();

  const [confirmSend, setConfirmSend] = useState(false);
  const [sendNotice, setSendNotice] = useState<Notice>(null);
  const [progress, setProgress] = useState<{ sent: number; remaining: number } | null>(null);
  const [sendPending, startSend] = useTransition();

  const visible = useMemo(() => guests.filter((g) => filter === "all" || g.consent === filter), [guests, filter]);
  const counts = useMemo(
    () => ({
      opted_in: guests.filter((g) => g.consent === "opted_in").length,
      none: guests.filter((g) => g.consent === "none").length,
      opted_out: guests.filter((g) => g.consent === "opted_out").length,
    }),
    [guests],
  );
  const readyToInvite = guests.filter((g) => g.consent === "opted_in" && g.phoneValid && !g.invited).length;

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    setSettingsNotice(null);
    startSaving(async () => {
      const result = await saveEventWhatsAppSettingsAction(form);
      setSettingsNotice(result.success ? { kind: "success", text: "Saved." } : { kind: "error", text: result.error });
      if (result.success) router.refresh();
    });
  }

  function attest() {
    setConsentNotice(null);
    startConsent(async () => {
      const result = await attestWhatsAppConsentAction({ eventId: settings.eventId, inviteeIds: [...selected], attested });
      setConsentNotice(
        result.success
          ? { kind: "success", text: `Consent recorded for ${result.data.recorded} guest${result.data.recorded === 1 ? "" : "s"} (guests without a valid phone were skipped).` }
          : { kind: "error", text: result.error },
      );
      if (result.success) {
        setSelected(new Set());
        setAttested(false);
        router.refresh();
      }
    });
  }

  function revoke() {
    setConsentNotice(null);
    startConsent(async () => {
      const result = await revokeWhatsAppConsentAction({ eventId: settings.eventId, inviteeIds: [...selected] });
      setConsentNotice(result.success ? { kind: "success", text: "Consent removed." } : { kind: "error", text: result.error });
      if (result.success) {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function sendInvitations() {
    setSendNotice(null);
    startSend(async () => {
      const result = await sendWhatsAppInvitationsAction({ eventId: settings.eventId, inviteeIds: null, confirmed: confirmSend });
      setConfirmSend(false);
      if (!result.success) {
        setSendNotice({ kind: "error", text: result.error });
        return;
      }
      const { queued, duplicate, blocked, failed } = result.data;
      let sent = 0;
      let remaining = queued;
      // Drain this event's outbox in small batches so no single request runs long; the 15-minute cron finishes anything left.
      for (let i = 0; i < 100 && remaining > 0; i++) {
        setProgress({ sent, remaining });
        const batch = await processEventWhatsAppOutboxAction(settings.eventId);
        if (!batch.success || batch.data.processed === 0) break;
        sent += batch.data.processed;
        remaining = batch.data.remaining;
      }
      setProgress(null);
      setSendNotice({
        kind: failed > 0 ? "error" : "success",
        text: `Queued ${queued} invitation${queued === 1 ? "" : "s"}${duplicate ? `, ${duplicate} already invited` : ""}${blocked ? `, ${blocked} not allowed (test mode or opted out)` : ""}${failed ? `, ${failed} couldn't be prepared` : ""}.${remaining > 0 ? ` ${remaining} still sending in the background.` : ""}`,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className={cardClasses}>
        <h2 className="font-display text-lg text-navy-950">Automatic messages</h2>
        <label className="mt-4 flex items-start gap-3 text-sm text-navy-950">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="mt-0.5 h-4 w-4" />
          <span>
            Use WhatsApp for this event
            <span className="block text-xs text-navy-700/60">
              Adds a &ldquo;Send me updates on WhatsApp&rdquo; checkbox to your RSVP form. Only guests who tick it (or whose consent you record
              below) are ever messaged.
            </span>
          </span>
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {TOGGLES.map((t) => (
            <label key={t.key} className={`flex items-start gap-3 text-sm ${form.enabled ? "text-navy-950" : "text-navy-700/40"}`}>
              <input
                type="checkbox"
                disabled={!form.enabled}
                checked={form[t.key]}
                onChange={(e) => setForm({ ...form, [t.key]: e.target.checked })}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                {t.label}
                <span className="block text-xs text-navy-700/60">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-5">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
          <NoticeLine notice={settingsNotice} />
        </div>
      </div>

      <div className={cardClasses}>
        <h2 className="font-display text-lg text-navy-950">Send invitations</h2>
        <p className="mt-1 text-sm text-navy-700/70">
          Sends your approved invitation template, with each guest&rsquo;s personal link, to the {readyToInvite} guest
          {readyToInvite === 1 ? "" : "s"} who have consented and haven&rsquo;t been invited on WhatsApp yet. Nobody is messaged twice.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm text-navy-950">
          <input type="checkbox" checked={confirmSend} onChange={(e) => setConfirmSend(e.target.checked)} className="h-4 w-4" />
          Yes, send {readyToInvite} WhatsApp invitation{readyToInvite === 1 ? "" : "s"} now
        </label>
        <div className="mt-4">
          <Button onClick={sendInvitations} disabled={sendPending || !confirmSend || readyToInvite === 0 || !sendingAvailable || !settings.enabled}>
            {sendPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {progress ? `Sending… ${progress.sent} sent, ${progress.remaining} to go` : "Send invitations"}
          </Button>
          {!sendingAvailable ? (
            <p className="mt-2 text-xs text-navy-700/60">WhatsApp sending isn&rsquo;t switched on for EveryMoment yet — you can still collect consent.</p>
          ) : !settings.enabled ? (
            <p className="mt-2 text-xs text-navy-700/60">Turn on WhatsApp for this event and save first.</p>
          ) : null}
          <NoticeLine notice={sendNotice} />
        </div>
      </div>

      <div className={cardClasses}>
        <h2 className="font-display text-lg text-navy-950">Guest consent</h2>
        <p className="mt-1 text-sm text-navy-700/70">
          Guests opt in themselves on the RSVP form. If a guest has told you directly that they want WhatsApp updates, select them and
          record it here. Replying STOP to our number opts them out everywhere.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["all", `All (${guests.length})`],
              ["opted_in", `Opted in (${counts.opted_in})`],
              ["none", `No consent (${counts.none})`],
              ["opted_out", `Opted out (${counts.opted_out})`],
            ] as Array<[Filter, string]>
          ).map(([key, label]) => (
            <button key={key} type="button" className={pillClass(filter === key)} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-navy-950/10">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-navy-700/50">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all shown guests"
                    checked={visible.length > 0 && visible.every((g) => selected.has(g.inviteeId))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((g) => g.inviteeId)) : new Set())}
                    className="h-4 w-4"
                  />
                </th>
                <th className="px-3 py-2 font-medium">Guest</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-950/5">
              {visible.map((g) => (
                <tr key={g.inviteeId}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${g.name}`}
                      checked={selected.has(g.inviteeId)}
                      onChange={() => toggle(g.inviteeId)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-3 py-2 text-navy-950">{g.name}</td>
                  <td className={`px-3 py-2 ${g.phoneValid ? "text-navy-700/80" : "text-amber-700"}`}>
                    {g.phone ? g.phone : "—"}
                    {g.phone && !g.phoneValid ? <span className="block text-xs">Not a valid WhatsApp number</span> : null}
                  </td>
                  <td className="px-3 py-2 text-navy-700/80">
                    {g.consent === "opted_in" ? `Opted in${g.consentSource === "host_attested" ? " (by you)" : ""}` : g.consent === "opted_out" ? "Opted out" : "—"}
                    {g.invited ? <span className="block text-xs text-emerald-700">Invited</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm text-navy-950">
          <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5 h-4 w-4" />
          These {selected.size} guest{selected.size === 1 ? "" : "s"} told me they agree to receive messages about this event on WhatsApp.
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={attest} disabled={consentPending || selected.size === 0 || !attested}>
            Record consent
          </Button>
          <Button size="sm" variant="outline" onClick={revoke} disabled={consentPending || selected.size === 0}>
            Remove consent
          </Button>
        </div>
        <NoticeLine notice={consentNotice} />
      </div>
    </div>
  );
}
