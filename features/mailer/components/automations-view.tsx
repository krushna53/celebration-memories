"use client";

import { useEffect, useMemo, useState } from "react";
import { Cake, CalendarClock, Loader2, Play, RotateCcw, Save, ScrollText, Users } from "lucide-react";

import {
  AUTOMATION_KINDS,
  type AutomationKind,
  type AutomationLogEntry,
  type AutomationRunResult,
  type AutomationSettings,
  type MailerSender,
} from "@/types/mailer";
import {
  applyAutomationTokens,
  AUTOMATION_SEND_HOUR,
  AUTOMATION_TOKENS,
  automationSettingsOf,
  defaultAutomationContent,
  todayIn,
  upcomingOccasions,
  type AutomationToken,
} from "@/lib/mailer/automations";
import { MAILER_TOKENS, formatMailerDate } from "@/lib/mailer/tokens";
import { contactDisplayName } from "@/lib/mailer/email";
import { useMailer } from "@/features/mailer/mailer-provider";
import { useMailerNav } from "@/features/mailer/mailer-nav";
import { EmailPreview } from "@/features/mailer/components/email-preview";
import { Card, EmptyState, ErrorText, Field, formatDateTime, inputClasses, primaryButton, secondaryButton } from "@/features/mailer/components/ui";
import { cn } from "@/lib/utils";

const SAMPLE_TOKENS: Record<AutomationToken, string> = {
  celebrant_name: "Priya Sharma",
  celebrant_first_name: "Priya",
  birthday_date: formatMailerDate("2026-12-12"),
  years: "3",
  years_label: "3 years",
};

const STATUS_STYLE: Record<AutomationLogEntry["status"], string> = {
  sending: "bg-navy-950/[0.05] text-navy-700",
  sent: "bg-emerald-50 text-emerald-800",
  failed: "bg-red-50 text-red-800",
  simulated: "bg-amber-50 text-amber-800",
};

const KIND_LABEL = Object.fromEntries(AUTOMATION_KINDS.map((k) => [k.kind, k.label])) as Record<AutomationKind, string>;

/** Birthday greetings, HR birthday reminders and work-anniversary emails, sent automatically every day. */
export function AutomationsView() {
  const { data, run, mode } = useMailer();
  const navigate = useMailerNav();
  const saved = useMemo(() => automationSettingsOf(data), [data]);
  const [settings, setSettings] = useState<AutomationSettings>(saved);
  const [open, setOpen] = useState<AutomationKind | null>(null);
  const [busy, setBusy] = useState<"save" | "run" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [senders, setSenders] = useState<MailerSender[] | null>(mode === "live" ? null : []);
  const today = todayIn(Date.now());
  const [runDate, setRunDate] = useState(today);
  const [lastRun, setLastRun] = useState<AutomationRunResult | null>(null);

  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  useEffect(() => {
    if (mode !== "live") return;
    let cancelled = false;
    void run((repo) => repo.listSenders()).then((r) => {
      if (!cancelled) setSenders(r.ok ? r.value : []);
    });
    return () => {
      cancelled = true;
    };
    // Load the verified senders once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const withDob = data.contacts.filter((c) => c.dateOfBirth).length;
  const withJoining = data.contacts.filter((c) => c.joiningDate).length;
  const hrTeam = data.contacts.filter((c) => c.subscribed && c.roles.includes("hr"));
  const upcoming = useMemo(() => upcomingOccasions(data.contacts, today, 30), [data.contacts, today]);
  const log = data.automationLog ?? [];

  const setRule = (kind: AutomationKind, patch: Partial<AutomationSettings["rules"][AutomationKind]>) =>
    setSettings((s) => ({ ...s, rules: { ...s.rules, [kind]: { ...s.rules[kind], ...patch } } }));
  const setContent = (kind: AutomationKind, field: keyof AutomationSettings["rules"][AutomationKind]["content"], value: string) =>
    setSettings((s) => ({ ...s, rules: { ...s.rules, [kind]: { ...s.rules[kind], content: { ...s.rules[kind].content, [field]: value } } } }));

  async function save() {
    setBusy("save");
    setError(null);
    setNotice(null);
    const result = await run((repo) => repo.saveAutomationSettings(settings));
    setBusy(null);
    if (!result.ok) return setError(result.error);
    setSettings(result.value);
    setNotice("Saved.");
  }

  async function runNow() {
    setBusy("run");
    setError(null);
    setNotice(null);
    const result = await run((repo) => repo.runAutomations({ date: runDate }));
    setBusy(null);
    if (!result.ok) return setError(result.error);
    setLastRun(result.value);
  }

  const enabledCount = AUTOMATION_KINDS.filter((k) => saved.rules[k.kind].enabled).length;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-700">
            <Cake size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-medium text-navy-950">How automations work</h2>
            <p className="mt-1 text-sm text-navy-700/70">
              Every day from {AUTOMATION_SEND_HOUR}:00 India time, the Mailer checks your contacts&rsquo; <strong>date of birth</strong> and{" "}
              <strong>joining date</strong> and sends the emails switched on below. Each email goes once — never twice.{" "}
              {mode === "mock" ? <strong>Mock mode: nothing is really sent — use &ldquo;Run now&rdquo; to see what would go.</strong> : null}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-navy-950/[0.05] px-2.5 py-1 text-navy-700">{withDob} with a date of birth</span>
              <span className="rounded-full bg-navy-950/[0.05] px-2.5 py-1 text-navy-700">{withJoining} with a joining date</span>
              <span className={cn("rounded-full px-2.5 py-1", hrTeam.length ? "bg-navy-950/[0.05] text-navy-700" : "bg-amber-50 text-amber-900")}>
                {hrTeam.length} with the HR role
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{enabledCount} of 3 switched on</span>
            </div>
          </div>
          <button type="button" onClick={() => navigate({ name: "contacts" })} className={secondaryButton}>
            <Users size={15} /> Edit dates in Contacts
          </button>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>

      {/* Sender */}
      <Card className="grid gap-4 sm:grid-cols-2">
        <Field label="From name" hint="(shown as {{sender_name}})" htmlFor="au-sender-name">
          <input
            id="au-sender-name"
            className={inputClasses}
            value={settings.senderName}
            maxLength={80}
            placeholder="ABC Technologies HR Team"
            onChange={(e) => setSettings((s) => ({ ...s, senderName: e.target.value }))}
          />
        </Field>
        {mode === "live" ? (
          <Field label="Send from" htmlFor="au-sender">
            {senders === null ? (
              <p className="flex items-center gap-2 py-2 text-sm text-navy-700/60">
                <Loader2 size={14} className="animate-spin" /> Loading verified email settings…
              </p>
            ) : senders.length === 0 ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                No verified email setting yet — verify one in Email Settings, or nothing can be sent.
              </p>
            ) : (
              <select
                id="au-sender"
                className={inputClasses}
                value={settings.senderId ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, senderId: e.target.value || null }))}
              >
                <option value="">Default verified setting</option>
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} — {s.fromEmail}
                    {s.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : (
          <p className="self-end rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Mock mode — emails are only simulated.</p>
        )}
      </Card>

      {/* The three rules */}
      {AUTOMATION_KINDS.map(({ kind, label, description }) => {
        const rule = settings.rules[kind];
        const expanded = open === kind;
        const previewContacts =
          kind === "hr_birthday_reminder"
            ? hrTeam
            : data.contacts.filter((c) => (kind === "birthday" ? c.dateOfBirth : c.joiningDate) && c.subscribed);
        return (
          <Card key={kind}>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={rule.enabled} onChange={(e) => setRule(kind, { enabled: e.target.checked })} className="peer sr-only" />
                <span className="relative h-6 w-11 shrink-0 rounded-full bg-navy-950/15 transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-emerald-500 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-navy-950/40" />
                <span>
                  <span className="block font-medium text-navy-950">{label}</span>
                  <span className="block text-xs text-navy-700/60">{description}</span>
                </span>
              </label>
              <button type="button" onClick={() => setOpen(expanded ? null : kind)} className={cn(secondaryButton, "ml-auto")}>
                {expanded ? "Hide email" : "Edit email"}
              </button>
            </div>
            {kind === "hr_birthday_reminder" && rule.enabled && hrTeam.length === 0 ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Nobody has the HR role yet — give it to your HR people in Contacts, or this reminder has no one to go to.
              </p>
            ) : null}
            {expanded ? (
              <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
                <div className="min-w-0 space-y-3">
                  <Field label="Subject" htmlFor={`au-${kind}-subject`}>
                    <input id={`au-${kind}-subject`} className={inputClasses} value={rule.content.subject} onChange={(e) => setContent(kind, "subject", e.target.value)} />
                  </Field>
                  <Field label="Preview text" hint="(after the subject in most inboxes)" htmlFor={`au-${kind}-pre`}>
                    <input id={`au-${kind}-pre`} className={inputClasses} value={rule.content.preheader} onChange={(e) => setContent(kind, "preheader", e.target.value)} />
                  </Field>
                  <Field label="Message" hint="(blank line = new paragraph)" htmlFor={`au-${kind}-body`}>
                    <textarea id={`au-${kind}-body`} rows={9} className={inputClasses} value={rule.content.body} onChange={(e) => setContent(kind, "body", e.target.value)} />
                  </Field>
                  <div className="text-xs text-navy-700/60">
                    <p className="font-medium text-navy-700/75">Tokens</p>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {[...MAILER_TOKENS.filter((t) => ["first_name", "last_name", "full_name", "company", "sender_name"].includes(t.token)), ...AUTOMATION_TOKENS]
                        .filter((t) => kind === "work_anniversary" || !t.token.startsWith("years"))
                        .filter((t) => kind === "hr_birthday_reminder" || !["celebrant_name", "celebrant_first_name", "birthday_date"].includes(t.token))
                        .map((t) => (
                          <code key={t.token} title={t.label} className="rounded bg-navy-950/[0.05] px-1.5 py-0.5">{`{{${t.token}}}`}</code>
                        ))}
                    </p>
                    {kind === "hr_birthday_reminder" ? (
                      <p className="mt-1">Here {"{{first_name}}"} is the HR person reading it; {"{{celebrant_name}}"} is whose birthday it is.</p>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => setRule(kind, { content: defaultAutomationContent(kind) })} className={secondaryButton}>
                    <RotateCcw size={14} /> Reset to the default text
                  </button>
                </div>
                <div className="min-w-0">
                  <EmailPreview
                    kind={kind}
                    content={applyAutomationTokens(rule.content, SAMPLE_TOKENS)}
                    senderName={settings.senderName}
                    event={null}
                    contacts={previewContacts}
                  />
                </div>
              </div>
            ) : null}
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy !== null || !dirty} className={primaryButton}>
          {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save automations
        </button>
        {dirty ? <span className="text-sm text-amber-700">Unsaved changes</span> : notice ? <span className="text-sm text-emerald-700">{notice}</span> : null}
      </div>

      {/* Run now */}
      <Card>
        <h2 className="flex items-center gap-2 font-medium text-navy-950">
          <Play size={16} className="text-navy-700/60" /> Run now
        </h2>
        <p className="mt-1 text-sm text-navy-700/65">
          {mode === "live"
            ? "Sends whatever is due on the chosen day right away — the same as the daily job. Pick another date to test (e.g. someone's birthday). Already-sent emails are skipped."
            : "Shows what would be sent on the chosen day and adds it to the log as simulated."}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Day to process" htmlFor="au-date">
            <input id="au-date" type="date" className={inputClasses} value={runDate} onChange={(e) => setRunDate(e.target.value || today)} />
          </Field>
          <button type="button" onClick={runNow} disabled={busy !== null || dirty} className={primaryButton}>
            {busy === "run" ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {mode === "live" ? "Send due emails now" : "Simulate"}
          </button>
          {dirty ? <span className="pb-2 text-xs text-amber-700">Save your changes first.</span> : null}
        </div>
        {lastRun ? (
          <p className="mt-3 rounded-xl bg-navy-950/[0.04] px-3 py-2 text-sm text-navy-800">
            {formatMailerDate(lastRun.date)}:{" "}
            {lastRun.entries.length === 0
              ? "nothing due (or already sent). Check that the automation is switched on and the contact has the date."
              : `${lastRun.entries.filter((e) => e.status === "sent" || e.status === "simulated").length} ${mode === "live" ? "sent" : "simulated"}, ${lastRun.entries.filter((e) => e.status === "failed").length} failed — see the log below.`}
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Upcoming */}
        <Card>
          <h2 className="flex items-center gap-2 font-medium text-navy-950">
            <CalendarClock size={16} className="text-navy-700/60" /> Next 30 days
          </h2>
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing coming up">Add dates of birth and joining dates to contacts.</EmptyState>
          ) : (
            <ul className="mt-3 divide-y divide-navy-950/[0.06]">
              {upcoming.map((u) => (
                <li key={`${u.kind}-${u.contact.id}`} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-24 shrink-0 text-navy-700/70">{u.date === today ? "Today" : formatMailerDate(u.date).replace(/ \d{4}$/, "")}</span>
                  <span className="min-w-0 flex-1 truncate text-navy-950">{contactDisplayName(u.contact)}</span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", u.kind === "birthday" ? "bg-pink-50 text-pink-800" : "bg-teal-50 text-teal-800")}>
                    {u.kind === "birthday" ? "🎂 Birthday" : `🎉 ${u.years} yr${u.years === 1 ? "" : "s"}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Log */}
        <Card>
          <h2 className="flex items-center gap-2 font-medium text-navy-950">
            <ScrollText size={16} className="text-navy-700/60" /> Log
          </h2>
          {log.length === 0 ? (
            <EmptyState title="Nothing sent yet" />
          ) : (
            <div className="mt-3 max-h-96 overflow-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs text-navy-700/60">
                  <tr>
                    <th className="py-1.5 pr-2 font-medium">When</th>
                    <th className="py-1.5 pr-2 font-medium">Email</th>
                    <th className="py-1.5 pr-2 font-medium">For</th>
                    <th className="py-1.5 pr-2 font-medium">To</th>
                    <th className="py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-950/[0.06]">
                  {log.slice(0, 100).map((e) => (
                    <tr key={e.key} className="align-top">
                      <td className="py-1.5 pr-2 text-xs text-navy-700/70">{formatDateTime(e.at)}</td>
                      <td className="py-1.5 pr-2">{KIND_LABEL[e.kind]}</td>
                      <td className="py-1.5 pr-2">{e.contactName}</td>
                      <td className="py-1.5 pr-2 text-xs text-navy-700/80">{e.recipientEmail}</td>
                      <td className="py-1.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[e.status])}>{e.status}</span>
                        {e.error ? <p className="mt-1 text-xs text-red-700">{e.error}</p> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
