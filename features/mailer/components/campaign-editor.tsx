"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Send, Trash2, Users } from "lucide-react";

import { CAMPAIGN_KINDS, type CampaignKind, type MailerCampaignInput, type MailerSender } from "@/types/mailer";
import { resolveAudience } from "@/lib/mailer/audience";
import { contactDisplayName } from "@/lib/mailer/email";
import { MAILER_TOKENS, unknownTokens } from "@/lib/mailer/tokens";
import { BUILT_IN_TEMPLATE_IDS } from "@/lib/mailer/seed";
import { brandOf } from "@/lib/mailer/brand";
import { useMailer } from "@/features/mailer/mailer-provider";
import { useMailerNav } from "@/features/mailer/mailer-nav";
import { EmailPreview } from "@/features/mailer/components/email-preview";
import {
  Card,
  dangerButton,
  ErrorText,
  Field,
  inputClasses,
  Modal,
  primaryButton,
  SearchInput,
  secondaryButton,
} from "@/features/mailer/components/ui";
import { cn } from "@/lib/utils";

/** Create or edit a draft campaign: details, audience, content with tokens, live preview, and simulated send. */
export function CampaignEditor({ id, kind: initialKind }: { id?: string; kind?: CampaignKind }) {
  const { data, run, mode } = useMailer();
  const navigate = useMailerNav();
  const existing = id ? data.campaigns.find((c) => c.id === id) : undefined;

  const [form, setForm] = useState<MailerCampaignInput>(() => {
    if (existing) {
      const { name, kind, templateId, senderName, eventId, audience, subject, preheader, body, ctaLabel, ctaUrl } = existing;
      return { name, kind, templateId, senderName, eventId, audience, subject, preheader, body, ctaLabel, ctaUrl, showLogo: existing.showLogo !== false };
    }
    const kind = initialKind ?? "announcement";
    const template = data.templates.find((t) => t.id === BUILT_IN_TEMPLATE_IDS[kind]) ?? data.templates.find((t) => t.kind === kind);
    const label = CAMPAIGN_KINDS.find((k) => k.kind === kind)?.label ?? "Campaign";
    return {
      name: `${label} — ${new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`,
      kind,
      templateId: template?.id ?? null,
      senderName: "",
      eventId: kind === "invitation" ? (data.events[0]?.id ?? null) : null,
      audience: { contactIds: [], listIds: [] },
      subject: template?.subject ?? "",
      preheader: template?.preheader ?? "",
      body: template?.body ?? "",
      ctaLabel: template?.ctaLabel ?? "",
      ctaUrl: template?.ctaUrl ?? "",
      showLogo: true,
    };
  });
  const savedLogo = brandOf(data)?.logoUrl ?? null;
  const [savedId, setSavedId] = useState<string | undefined>(id);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "send" | "delete" | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [pickContacts, setPickContacts] = useState(false);
  // Live mode: verified Email Configurations to send from (null = still loading).
  const [senders, setSenders] = useState<MailerSender[] | null>(null);
  const [senderId, setSenderId] = useState<string>("");
  const [sendersError, setSendersError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const set = <K extends keyof MailerCampaignInput>(key: K, value: MailerCampaignInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setNotice(null);
  };

  const audience = useMemo(() => resolveAudience(form.audience, data.contacts, data.lists), [form.audience, data.contacts, data.lists]);
  const event = data.events.find((e) => e.id === form.eventId) ?? null;
  const unknown = unknownTokens([form.subject, form.preheader, form.body, form.ctaLabel].join(" "));

  if (existing && existing.status !== "draft") {
    return <ErrorText>This campaign has already been sent and can&rsquo;t be edited.</ErrorText>;
  }

  function applyTemplate(templateId: string) {
    const t = data.templates.find((x) => x.id === templateId);
    if (!t) {
      set("templateId", null);
      return;
    }
    setForm((f) => ({ ...f, templateId: t.id, kind: t.kind, subject: t.subject, preheader: t.preheader, body: t.body, ctaLabel: t.ctaLabel, ctaUrl: t.ctaUrl }));
  }

  function insertToken(token: string) {
    const el = bodyRef.current;
    const text = `{{${token}}}`;
    if (!el) return set("body", form.body + text);
    const start = el.selectionStart ?? form.body.length;
    const end = el.selectionEnd ?? start;
    set("body", form.body.slice(0, start) + text + form.body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function toggleList(listId: string) {
    const listIds = form.audience.listIds.includes(listId)
      ? form.audience.listIds.filter((l) => l !== listId)
      : [...form.audience.listIds, listId];
    set("audience", { ...form.audience, listIds });
  }

  async function save(): Promise<string | null> {
    setError(null);
    setBusy("save");
    const result = await run((repo) => repo.saveCampaign(form, savedId));
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setSavedId(result.value.id);
    setNotice("Draft saved.");
    return result.value.id;
  }

  async function openSend() {
    setConfirmSend(true);
    if (mode !== "live") return;
    setSenders(null);
    setSendersError(null);
    const result = await run((repo) => repo.listSenders());
    if (!result.ok) {
      setSendersError(result.error);
      setSenders([]);
      return;
    }
    setSenders(result.value);
    setSenderId((current) => (result.value.some((s) => s.id === current) ? current : (result.value.find((s) => s.isDefault) ?? result.value[0])?.id ?? ""));
  }

  async function send() {
    setConfirmSend(false);
    const campaignId = await save();
    if (!campaignId) return;
    setBusy("send");
    const result = await run((repo) => repo.sendCampaign(campaignId, mode === "live" ? { senderId: senderId || null } : undefined));
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate({ name: "campaign", id: campaignId });
  }

  async function remove() {
    if (!savedId) return navigate({ name: "campaigns" });
    if (!confirm("Delete this draft campaign?")) return;
    setBusy("delete");
    const result = await run((repo) => repo.deleteCampaign(savedId));
    setBusy(null);
    if (result.ok) navigate({ name: "campaigns" });
    else setError(result.error);
  }

  const previewContacts = audience.recipients.length > 0 ? audience.recipients : data.contacts.filter((c) => c.subscribed);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => navigate({ name: "campaigns" })} className={secondaryButton}>
          <ArrowLeft size={16} /> Campaigns
        </button>
        <h2 className="font-display text-xl text-navy-950">{savedId ? "Edit campaign" : "New campaign"}</h2>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={remove} disabled={busy !== null} className={dangerButton}>
            <Trash2 size={15} /> {savedId ? "Delete" : "Discard"}
          </button>
          <button type="button" onClick={save} disabled={busy !== null} className={secondaryButton}>
            {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : null} Save draft
          </button>
          <button type="button" onClick={openSend} disabled={busy !== null} className={primaryButton}>
            {busy === "send" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {busy === "send" && mode === "live" ? "Sending…" : mode === "mock" ? "Send (simulated)" : "Send"}
          </button>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="grid gap-4 sm:grid-cols-2">
            <Field label="Campaign name" htmlFor="c-name" className="sm:col-span-2">
              <input id="c-name" className={inputClasses} value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Type" htmlFor="c-kind">
              <select id="c-kind" className={inputClasses} value={form.kind} onChange={(e) => set("kind", e.target.value as CampaignKind)}>
                {CAMPAIGN_KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start from template" htmlFor="c-template">
              <select id="c-template" className={inputClasses} value={form.templateId ?? ""} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">— None —</option>
                {data.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sender name" hint="(shown as {{sender_name}})" htmlFor="c-sender">
              <input id="c-sender" className={inputClasses} placeholder="e.g. Team Acme" value={form.senderName} onChange={(e) => set("senderName", e.target.value)} />
            </Field>
            <Field label="Event" hint={form.kind === "invitation" ? "(required)" : "(optional)"} htmlFor="c-event">
              <select id="c-event" className={inputClasses} value={form.eventId ?? ""} onChange={(e) => set("eventId", e.target.value || null)}>
                <option value="">— No event —</option>
                {data.events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-navy-950">Audience</p>
              <p className="text-sm text-navy-700/70">
                <span className="font-semibold text-navy-950">{audience.recipients.length}</span> recipient
                {audience.recipients.length === 1 ? "" : "s"}
              </p>
            </div>
            <p className="mt-3 text-xs font-medium text-navy-700/75">Lists</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {data.lists.length === 0 ? <p className="text-sm text-navy-700/60">No lists yet.</p> : null}
              {data.lists.map((l) => {
                const on = form.audience.listIds.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleList(l.id)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm",
                      on ? "border-gold-500 bg-gold-100 text-navy-950" : "border-navy-950/12 text-navy-700/75 hover:border-navy-950/30",
                    )}
                  >
                    {l.name} <span className="text-navy-700/50">({l.contactIds.length})</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setPickContacts(true)} className={secondaryButton}>
                <Users size={15} /> Pick contacts ({form.audience.contactIds.length})
              </button>
              {audience.unsubscribed.length > 0 ? (
                <span className="text-xs text-navy-700/60">{audience.unsubscribed.length} unsubscribed will be skipped</span>
              ) : null}
              {audience.duplicates > 0 ? <span className="text-xs text-navy-700/60">{audience.duplicates} duplicate email(s) merged</span> : null}
            </div>
          </Card>

          <Card className="space-y-4">
            <Field label="Subject" htmlFor="c-subject">
              <input id="c-subject" className={inputClasses} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
            </Field>
            <Field label="Preview text" hint="(shown after the subject in most inboxes)" htmlFor="c-pre">
              <input id="c-pre" className={inputClasses} value={form.preheader} onChange={(e) => set("preheader", e.target.value)} />
            </Field>
            <Field label="Message" hint="(blank line = new paragraph)" htmlFor="c-body">
              <textarea
                id="c-body"
                ref={bodyRef}
                rows={10}
                className={cn(inputClasses, "resize-y font-[inherit] leading-relaxed")}
                value={form.body}
                onChange={(e) => set("body", e.target.value)}
              />
            </Field>
            <div>
              <p className="text-xs font-medium text-navy-700/75">Insert personalisation</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {MAILER_TOKENS.map((t) => (
                  <button
                    key={t.token}
                    type="button"
                    onClick={() => insertToken(t.token)}
                    className="rounded-md border border-navy-950/10 bg-navy-950/[0.03] px-2 py-1 font-mono text-xs text-navy-700 hover:border-gold-500"
                    title={`${t.label}, e.g. ${t.example}`}
                  >
                    {`{{${t.token}}}`}
                  </button>
                ))}
                {/* The Brand Settings logo, at the top of the email — on/off per campaign. */}
                <label
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                    savedLogo ? "cursor-pointer border-navy-950/10 bg-navy-950/[0.03] text-navy-700 hover:border-gold-500" : "border-navy-950/[0.06] text-navy-700/45",
                  )}
                  title={savedLogo ? "Show the Brand Settings logo at the top of this email" : "Upload a logo in Brand Settings first"}
                >
                  <input
                    type="checkbox"
                    checked={savedLogo ? form.showLogo !== false : false}
                    disabled={!savedLogo}
                    onChange={(e) => set("showLogo", e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--color-gold-500)]"
                  />
                  Logo
                </label>
              </div>
              {savedLogo ? null : <p className="mt-1.5 text-xs text-navy-700/50">Upload a logo in Brand Settings to add it to emails.</p>}
              {unknown.length > 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  Unknown token{unknown.length > 1 ? "s" : ""}: {unknown.map((u) => `{{${u}}}`).join(", ")} — {unknown.length > 1 ? "they" : "it"} will appear as typed.
                </p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Button label" hint="(optional)" htmlFor="c-cta">
                <input id="c-cta" className={inputClasses} placeholder="e.g. RSVP now" value={form.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} />
              </Field>
              <Field label="Button link" hint="(https://…)" htmlFor="c-url">
                <input id="c-url" className={inputClasses} placeholder="https://" value={form.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} />
              </Field>
            </div>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-4 xl:self-start">
          <p className="mb-3 font-medium text-navy-950">Preview</p>
          <EmailPreview kind={form.kind} content={form} senderName={form.senderName} event={event} contacts={previewContacts} showLogo={form.showLogo !== false} />
        </Card>
      </div>

      {pickContacts ? (
        <ContactPicker
          selected={form.audience.contactIds}
          onClose={() => setPickContacts(false)}
          onDone={(contactIds) => {
            set("audience", { ...form.audience, contactIds });
            setPickContacts(false);
          }}
        />
      ) : null}

      {confirmSend ? (
        <Modal title={mode === "mock" ? "Send (simulated)?" : "Send campaign?"} onClose={() => setConfirmSend(false)}>
          <p className="text-sm text-navy-700/80">
            &ldquo;{form.name}&rdquo; will go to <strong>{audience.recipients.length}</strong> subscribed contact
            {audience.recipients.length === 1 ? "" : "s"}. Once sent it can&rsquo;t be edited.
          </p>
          {mode === "mock" ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Mock mode: <strong>no real email is sent.</strong> Delivery, bounces and clicks are simulated so you can see how the
              analytics work.
            </p>
          ) : null}
          {mode === "live" ? (
            <div className="mt-4 space-y-2">
              {senders === null ? (
                <p className="flex items-center gap-2 text-sm text-navy-700/70">
                  <Loader2 size={14} className="animate-spin" /> Loading your verified email settings…
                </p>
              ) : senders.length === 0 ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {sendersError ??
                    "There's no verified email setting yet. Open Email Settings, save your provider, then run Test SMTP Connection and Send Test Email."}
                </p>
              ) : (
                <Field label="Send from" htmlFor="c-sender">
                  <select id="c-sender" className={inputClasses} value={senderId} onChange={(e) => setSenderId(e.target.value)}>
                    {senders.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} — {form.senderName.trim() || s.senderName} &lt;{s.fromEmail}&gt;
                        {s.isDefault ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                <strong>This sends real email</strong> — each person gets their own copy with an unsubscribe link. Keep this page open
                until it finishes.
              </p>
            </div>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmSend(false)} className={secondaryButton}>
              Cancel
            </button>
            <button type="button" onClick={send} disabled={mode === "live" && !senderId} className={primaryButton}>
              <Send size={15} /> {mode === "mock" ? "Simulate send" : "Send now"}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function ContactPicker({ selected, onClose, onDone }: { selected: string[]; onClose: () => void; onDone: (ids: string[]) => void }) {
  const { data } = useMailer();
  const [picked, setPicked] = useState(() => new Set(selected));
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = data.contacts.filter(
    (c) => !q || contactDisplayName(c).toLowerCase().includes(q) || c.email.includes(q) || c.company.toLowerCase().includes(q),
  );

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal title="Pick contacts" onClose={onClose}>
      <SearchInput value={query} onChange={setQuery} placeholder="Search name, email or company..." />
      <div className="mt-3 max-h-80 divide-y divide-navy-950/5 overflow-y-auto rounded-xl border border-navy-950/10">
        {shown.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-navy-950/[0.02]">
            <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-[var(--color-gold-500)]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-navy-950">{contactDisplayName(c)}</span>
              <span className="block truncate text-xs text-navy-700/60">
                {c.email}
                {c.company ? ` · ${c.company}` : ""}
              </span>
            </span>
            {!c.subscribed ? <span className="text-xs text-navy-700/50">Unsubscribed</span> : null}
          </label>
        ))}
        {shown.length === 0 ? <p className="px-3 py-6 text-center text-sm text-navy-700/60">No contacts match.</p> : null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-sm text-navy-700/70">{picked.size} selected</span>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={() => onDone([...picked])} className={primaryButton}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
