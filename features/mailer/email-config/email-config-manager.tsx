"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  Send,
  Server,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";

import type {
  DnsRecordCheck,
  DnsRecordStatus,
  EmailConfigInput,
  EmailConfigState,
  EmailConfigView,
  EmailProviderId,
} from "@/types/mailer-email-config";
import { EMAIL_PROVIDERS, encryptionForPort, getProvider, SMTP_PORTS } from "@/lib/mailer/email-config/providers";
import { LOCAL_SMTP_PORT } from "@/lib/mailer/email-config/local-smtp";
import { EMAIL_CONFIG_STATE_LABELS, emailConfigState } from "@/lib/mailer/email-config/status";
import { DNS_STATUS_LABELS } from "@/lib/mailer/email-config/dns-evaluate";
import { emailDomain } from "@/lib/mailer/email-config/validation";
import {
  checkEmailConfigDomainAction,
  deleteEmailConfigAction,
  saveEmailConfigAction,
  sendEmailConfigTestEmailAction,
  testEmailConfigConnectionAction,
} from "@/features/mailer/email-config/actions";
import { Card, ErrorText, Field, formatDateTime, inputClasses, primaryButton, secondaryButton, dangerButton } from "@/features/mailer/components/ui";
import { cn } from "@/lib/utils";

/** The server actions the page calls — the local preview swaps in its own dev-only set. */
export interface EmailConfigActions {
  save: typeof saveEmailConfigAction;
  remove: typeof deleteEmailConfigAction;
  testConnection: typeof testEmailConfigConnectionAction;
  sendTestEmail: typeof sendEmailConfigTestEmailAction;
  checkDomain: typeof checkEmailConfigDomainAction;
}

const DEFAULT_ACTIONS: EmailConfigActions = {
  save: saveEmailConfigAction,
  remove: deleteEmailConfigAction,
  testConnection: testEmailConfigConnectionAction,
  sendTestEmail: sendEmailConfigTestEmailAction,
  checkDomain: checkEmailConfigDomainAction,
};

const STATE_STYLE: Record<EmailConfigState, { className: string; icon: typeof CheckCircle2 }> = {
  incomplete: { className: "bg-amber-50 text-amber-800 border-amber-200", icon: AlertTriangle },
  untested: { className: "bg-navy-950/[0.05] text-navy-700 border-navy-950/10", icon: Circle },
  connection_failed: { className: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  connection_ok: { className: "bg-sky-50 text-sky-800 border-sky-200", icon: CheckCircle2 },
  domain_pending: { className: "bg-amber-50 text-amber-800 border-amber-200", icon: ShieldCheck },
  verified: { className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ShieldCheck },
};

const DNS_STYLE: Record<DnsRecordStatus, string> = {
  verified: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-800",
  not_configured: "bg-navy-950/[0.06] text-navy-700",
  issue: "bg-red-50 text-red-700",
};

function StateBadge({ state }: { state: EmailConfigState }) {
  const { className, icon: Icon } = STATE_STYLE[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", className)}>
      <Icon size={13} aria-hidden="true" />
      {EMAIL_CONFIG_STATE_LABELS[state].label}
    </span>
  );
}

function emptyInput(): EmailConfigInput {
  const p = getProvider("google");
  return {
    label: "",
    provider: p.id,
    senderName: "",
    fromEmail: "",
    replyToEmail: "",
    replyToName: "",
    smtpHost: p.host,
    smtpPort: p.port,
    encryption: p.encryption,
    smtpUsername: p.username,
    authEnabled: true,
    newPassword: "",
    dkimSelector: p.dkimSelector ?? "",
    isDefault: false,
    sendingEnabled: true,
  };
}

function inputFrom(c: EmailConfigView): EmailConfigInput {
  return {
    label: c.label,
    provider: c.provider,
    senderName: c.senderName,
    fromEmail: c.fromEmail,
    replyToEmail: c.replyToEmail ?? "",
    replyToName: c.replyToName ?? "",
    smtpHost: c.smtpHost,
    smtpPort: c.smtpPort,
    encryption: c.encryption,
    smtpUsername: c.smtpUsername ?? "",
    authEnabled: c.authEnabled,
    newPassword: "",
    dkimSelector: c.dkimSelector ?? "",
    isDefault: c.isDefault,
    sendingEnabled: c.sendingEnabled,
  };
}

export function EmailConfigManager({
  initialConfigs,
  setupProblem,
  encryptionReady,
  adminEmail,
  backHref = "/admin/mailer",
  actions = DEFAULT_ACTIONS,
  localSmtpAllowed = false,
}: {
  initialConfigs: EmailConfigView[];
  setupProblem: string | null;
  encryptionReady: boolean;
  adminEmail: string;
  /** Where "← Event Mailer" goes (the local preview passes its own page). */
  backHref?: string;
  actions?: EmailConfigActions;
  /** Show the development-only "Local test (Mailpit)" provider (lib/mailer/email-config/local-smtp.ts). */
  localSmtpAllowed?: boolean;
}) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [selected, setSelected] = useState<string | "new" | null>(initialConfigs[0]?.id ?? (setupProblem ? null : "new"));
  const current = configs.find((c) => c.id === selected) ?? null;

  function upsert(view: EmailConfigView) {
    setConfigs((list) => {
      const others = list.filter((c) => c.id !== view.id).map((c) => (view.isDefault ? { ...c, isDefault: false } : c));
      return [...others, view].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    });
    setSelected(view.id);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-navy-700/70 hover:text-navy-950">
            <ArrowLeft size={14} /> Event Mailer
          </Link>
          <h1 className="mt-1 font-display text-2xl text-navy-950">Email Configuration</h1>
          <p className="mt-1 max-w-2xl text-sm text-navy-700/65">
            Send greetings, invitations and announcements from your company&rsquo;s own email address, through your own email provider.
          </p>
        </div>
        {!setupProblem ? (
          <button type="button" onClick={() => setSelected("new")} className={primaryButton}>
            <Plus size={15} /> Add configuration
          </button>
        ) : null}
      </div>

      {setupProblem ? <ErrorText>{setupProblem}</ErrorText> : null}
      {!encryptionReady && !setupProblem ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          Password encryption isn&rsquo;t set up on this server yet (<code>MAILER_CREDENTIAL_ENCRYPTION_KEY</code>), so SMTP passwords can&rsquo;t be saved.
        </p>
      ) : null}

      {!setupProblem ? (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <Card className="h-fit p-3 sm:p-3">
            <p className="px-1 pb-2 text-xs font-medium text-navy-700/60">Your configurations</p>
            {configs.length === 0 ? <p className="px-1 pb-1 text-sm text-navy-700/60">None yet.</p> : null}
            <ul className="space-y-1.5">
              {configs.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c.id)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left transition",
                      selected === c.id ? "border-gold-500 bg-gold-100/50" : "border-transparent hover:bg-navy-950/[0.03]",
                    )}
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-navy-950">
                      <span className="truncate">{c.label}</span>
                      {c.isDefault ? <span className="shrink-0 rounded bg-navy-950/[0.06] px-1.5 text-[11px] text-navy-700">Default</span> : null}
                    </p>
                    <p className="truncate text-xs text-navy-700/60">{c.fromEmail}</p>
                    <div className="mt-1.5">
                      <StateBadge state={emailConfigState(c)} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {selected ? (
            <ConfigEditor
              key={selected}
              config={current}
              encryptionReady={encryptionReady}
              adminEmail={adminEmail}
              actions={actions}
              localSmtpAllowed={localSmtpAllowed}
              onChanged={upsert}
              onDeleted={(id) => {
                const rest = configs.filter((c) => c.id !== id);
                setConfigs(rest);
                setSelected(rest[0]?.id ?? "new");
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Section({ step, title, icon: Icon, children }: { step: number; title: string; icon: typeof Mail; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 font-medium text-navy-950">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-950 text-xs text-white">{step}</span>
        <Icon size={16} className="text-navy-700/60" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Notice({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={cn("mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm", ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}
    >
      {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

function ConfigEditor({
  config,
  encryptionReady,
  adminEmail,
  actions,
  localSmtpAllowed,
  onChanged,
  onDeleted,
}: {
  config: EmailConfigView | null;
  encryptionReady: boolean;
  adminEmail: string;
  actions: EmailConfigActions;
  localSmtpAllowed: boolean;
  onChanged: (view: EmailConfigView) => void;
  onDeleted: (id: string) => void;
}) {
  const [saved, setSaved] = useState<EmailConfigInput>(() => (config ? inputFrom(config) : emptyInput()));
  const [form, setForm] = useState<EmailConfigInput>(saved);
  const [replacingPassword, setReplacingPassword] = useState(!config?.hasPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "delete" | "test" | "email" | "dns">(null);
  const [error, setError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [emailResult, setEmailResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testRecipient, setTestRecipient] = useState(adminEmail);

  const preset = getProvider(form.provider);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  const state = config ? emailConfigState(config) : null;
  const set = <K extends keyof EmailConfigInput>(k: K, v: EmailConfigInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function pickProvider(id: EmailProviderId) {
    const next = getProvider(id);
    const prev = getProvider(form.provider);
    setForm((f) => ({
      ...f,
      provider: id,
      // Replace values that were just the previous provider's defaults; keep anything the admin typed.
      smtpHost: !f.smtpHost || f.smtpHost === prev.host ? next.host : f.smtpHost,
      smtpPort: next.port,
      encryption: next.encryption,
      smtpUsername: !f.smtpUsername || f.smtpUsername === prev.username ? next.username : f.smtpUsername,
      dkimSelector: !f.dkimSelector || f.dkimSelector === (prev.dkimSelector ?? "") ? (next.dkimSelector ?? "") : f.dkimSelector,
      // Mailpit has no login; every other provider keeps (or needs) one.
      authEnabled: next.id === "local" ? false : next.allowsNoAuth ? f.authEnabled : true,
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    setSaveNote(null);
    const result = await actions.save(form, config?.id ?? null);
    setBusy(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    // The password field is cleared right away; the server never sends it back.
    const clean = inputFrom(result.data);
    setSaved(clean);
    setForm(clean);
    setReplacingPassword(!result.data.hasPassword);
    setShowPassword(false);
    setTestResult(null);
    setEmailResult(null);
    setSaveNote(
      result.data.connectionStatus === "untested"
        ? "Saved. These settings aren't verified yet — run Test SMTP Connection next."
        : "Saved.",
    );
    onChanged(result.data);
  }

  async function remove() {
    if (!config || !confirm(`Delete "${config.label}"? Its saved password is deleted too.`)) return;
    setBusy("delete");
    const result = await actions.remove(config.id);
    setBusy(null);
    if (result.success) onDeleted(config.id);
    else setError(result.error);
  }

  async function testConnection() {
    if (!config) return;
    setBusy("test");
    setTestResult(null);
    const result = await actions.testConnection(config.id);
    setBusy(null);
    if (!result.success) return setTestResult({ ok: false, message: result.error });
    setTestResult({ ok: result.data.ok, message: result.data.message });
    onChanged(result.data.config);
  }

  async function sendTest() {
    if (!config) return;
    setBusy("email");
    setEmailResult(null);
    const result = await actions.sendTestEmail(config.id, testRecipient);
    setBusy(null);
    if (!result.success) return setEmailResult({ ok: false, message: result.error });
    setEmailResult({ ok: result.data.ok, message: result.data.message + (result.data.messageId ? ` Message ID: ${result.data.messageId}` : "") });
    onChanged(result.data.config);
  }

  async function checkDns() {
    if (!config) return;
    setBusy("dns");
    setError(null);
    const result = await actions.checkDomain(config.id);
    setBusy(null);
    if (result.success) onChanged(result.data);
    else setError(result.error);
  }

  const savedNotDirty = Boolean(config) && !dirty;
  const needsSaveHint = !config ? "Save the configuration first." : dirty ? "Save your changes first." : null;
  const domain = emailDomain(form.fromEmail);

  return (
    <div className="space-y-4">
      {/* 8. Configuration status */}
      <Card className={cn("border", state ? STATE_STYLE[state].className.split(" ").find((c) => c.startsWith("border-")) : "")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium text-navy-700/60">Configuration status</p>
            {state ? (
              <>
                <div className="mt-1.5">
                  <StateBadge state={state} />
                </div>
                <p className="mt-2 text-sm text-navy-700/75">{EMAIL_CONFIG_STATE_LABELS[state].help}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-navy-700/75">New configuration — fill in the steps below and save.</p>
            )}
          </div>
          <ol className="space-y-1 text-sm">
            {[
              { done: Boolean(config), label: "Saved" },
              { done: config?.connectionStatus === "ok", label: "Connection tested" },
              { done: Boolean(config?.verifiedAt), label: "Test email accepted" },
              { done: config?.domainCheck?.overall === "verified", label: "SPF, DKIM & DMARC verified" },
            ].map((s) => (
              <li key={s.label} className={cn("flex items-center gap-2", s.done ? "text-emerald-700" : "text-navy-700/55")}>
                {s.done ? <CheckCircle2 size={15} /> : <Circle size={15} />} {s.label}
              </li>
            ))}
          </ol>
        </div>
        {config?.connectionStatus === "failed" && config.connectionError ? <Notice ok={false}>{config.connectionError}</Notice> : null}
      </Card>

      <form onSubmit={save} className="space-y-4" noValidate>
        {/* 1. Provider */}
        <Section step={1} title="Email provider" icon={Server}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {EMAIL_PROVIDERS.filter((p) => !p.localOnly || localSmtpAllowed || form.provider === p.id).map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={form.provider === p.id}
                onClick={() => pickProvider(p.id)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left text-sm transition",
                  form.provider === p.id ? "border-gold-500 bg-gold-100/60 text-navy-950" : "border-navy-950/10 text-navy-700/80 hover:border-navy-950/25",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-navy-700/60">{preset.limitsNote}</p>
          {preset.caution ? (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {preset.caution}
            </p>
          ) : null}
        </Section>

        {/* 2. Sender information */}
        <Section step={2} title="Sender information" icon={Mail}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Configuration name" hint="(only you see this)" htmlFor="ec-label" className="sm:col-span-2">
              <input id="ec-label" className={inputClasses} value={form.label} maxLength={60} placeholder="HR greetings" onChange={(e) => set("label", e.target.value)} />
            </Field>
            <Field label="Sender display name" hint="(default sender name)" htmlFor="ec-sender">
              <input id="ec-sender" className={inputClasses} value={form.senderName} maxLength={80} placeholder="ABC Technologies HR Team" onChange={(e) => set("senderName", e.target.value)} />
            </Field>
            <Field label="From email address" htmlFor="ec-from">
              <input id="ec-from" type="email" className={inputClasses} value={form.fromEmail} placeholder="greetings@abc.com" onChange={(e) => set("fromEmail", e.target.value)} />
            </Field>
            <Field label="Reply-To email" hint="(optional, default reply-to)" htmlFor="ec-reply">
              <input id="ec-reply" type="email" className={inputClasses} value={form.replyToEmail} placeholder="hr@abc.com" onChange={(e) => set("replyToEmail", e.target.value)} />
            </Field>
            <Field label="Reply-To name" hint="(optional)" htmlFor="ec-reply-name">
              <input id="ec-reply-name" className={inputClasses} value={form.replyToName} maxLength={80} placeholder="HR Team" onChange={(e) => set("replyToName", e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* 3. SMTP credentials */}
        <Section step={3} title="SMTP settings" icon={KeyRound}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SMTP host" htmlFor="ec-host" className="sm:col-span-2">
              <input id="ec-host" className={inputClasses} value={form.smtpHost} placeholder="smtp.example.com" autoComplete="off" onChange={(e) => set("smtpHost", e.target.value)} />
            </Field>
            <Field label="Port" htmlFor="ec-port">
              <select
                id="ec-port"
                className={inputClasses}
                value={form.smtpPort}
                onChange={(e) => {
                  const port = Number(e.target.value);
                  setForm((f) => ({ ...f, smtpPort: port, encryption: encryptionForPort(port) }));
                }}
              >
                {form.provider === "local" ? (
                  <option value={LOCAL_SMTP_PORT}>{LOCAL_SMTP_PORT} (Mailpit)</option>
                ) : (
                  SMTP_PORTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                      {p === 465 ? " (SSL/TLS)" : p === 25 ? " (often blocked)" : " (STARTTLS)"}
                    </option>
                  ))
                )}
              </select>
            </Field>
            <Field label="Encryption" htmlFor="ec-enc">
              <select id="ec-enc" className={inputClasses} value={form.encryption} onChange={(e) => set("encryption", e.target.value as EmailConfigInput["encryption"])}>
                {form.provider === "local" ? (
                  <option value="none">None (local Mailpit only)</option>
                ) : (
                  <>
                    <option value="ssl">SSL/TLS</option>
                    <option value="starttls">STARTTLS</option>
                  </>
                )}
              </select>
            </Field>
            {preset.allowsNoAuth ? (
              <label className="flex items-center gap-2 text-sm text-navy-950 sm:col-span-2">
                <input type="checkbox" checked={form.authEnabled} onChange={(e) => set("authEnabled", e.target.checked)} className="h-4 w-4 accent-[var(--color-gold-500)]" />
                Server requires a username and password
              </label>
            ) : null}
            {form.authEnabled ? (
              <>
                <Field label="SMTP username" htmlFor="ec-user" className="sm:col-span-2">
                  <input id="ec-user" className={inputClasses} value={form.smtpUsername} autoComplete="off" onChange={(e) => set("smtpUsername", e.target.value)} />
                  <p className="mt-1 text-xs text-navy-700/55">{preset.usernameHint}</p>
                </Field>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-navy-700/75">{preset.passwordLabel}</p>
                  {config?.hasPassword && !replacingPassword ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 rounded-xl border border-navy-950/10 bg-navy-950/[0.02] px-3 py-2 text-sm">
                      <span className="font-mono tracking-widest text-navy-700/70">••••••••••••</span>
                      <span className="text-xs text-navy-700/55">
                        Saved{config.passwordUpdatedAt ? ` ${formatDateTime(config.passwordUpdatedAt)}` : ""} · never shown again
                      </span>
                      <button type="button" onClick={() => setReplacingPassword(true)} className="ml-auto text-sm font-medium text-gold-600 hover:text-gold-500">
                        Replace password
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1.5">
                      <div className="relative">
                        <input
                          id="ec-pass"
                          type={showPassword ? "text" : "password"}
                          className={cn(inputClasses, "pr-10")}
                          value={form.newPassword}
                          autoComplete="new-password"
                          spellCheck={false}
                          aria-label={preset.passwordLabel}
                          disabled={!encryptionReady}
                          onChange={(e) => set("newPassword", e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-navy-700/55 hover:text-navy-950"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-navy-700/55">
                        {preset.passwordHint} Stored encrypted; it can be replaced but never viewed.
                      </p>
                      {config?.hasPassword ? (
                        <button
                          type="button"
                          onClick={() => {
                            set("newPassword", "");
                            setReplacingPassword(false);
                          }}
                          className="mt-1 text-xs text-navy-700/60 underline"
                        >
                          Keep the saved password
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </Section>

        {/* Additional settings + 6. Save */}
        <Card>
          <div className="flex flex-col gap-2 text-sm text-navy-950">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => set("isDefault", e.target.checked)} className="h-4 w-4 accent-[var(--color-gold-500)]" />
              Default configuration for new campaigns
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.sendingEnabled} onChange={(e) => set("sendingEnabled", e.target.checked)} className="h-4 w-4 accent-[var(--color-gold-500)]" />
              Email sending enabled (turn off to pause all campaigns using this sender)
            </label>
          </div>
          <div className="mt-4 space-y-3">
            <ErrorText>{error}</ErrorText>
            {saveNote && !dirty ? <Notice ok>{saveNote}</Notice> : null}
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={busy !== null || (Boolean(config) && !dirty)} className={primaryButton}>
                {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : null} Save configuration
              </button>
              {config && dirty ? (
                <button type="button" onClick={() => setForm(saved)} className={secondaryButton}>
                  Discard changes
                </button>
              ) : null}
              {config ? (
                <button type="button" onClick={remove} disabled={busy !== null} className={cn(dangerButton, "ml-auto")}>
                  <Trash2 size={15} /> Delete
                </button>
              ) : null}
            </div>
          </div>
        </Card>
      </form>

      {/* 4. Connection test */}
      <Section step={4} title="Test SMTP connection" icon={Server}>
        <p className="text-sm text-navy-700/70">Connects to the server, checks TLS and signs in — without sending anything.</p>
        <button type="button" onClick={testConnection} disabled={!savedNotDirty || busy !== null} className={cn(secondaryButton, "mt-3")}>
          {busy === "test" ? <Loader2 size={15} className="animate-spin" /> : <Server size={15} />} Test SMTP Connection
        </button>
        {needsSaveHint ? <p className="mt-2 text-xs text-navy-700/55">{needsSaveHint}</p> : null}
        {testResult ? <Notice ok={testResult.ok}>{testResult.message}</Notice> : null}
      </Section>

      {/* 7. Send test email */}
      <Section step={5} title="Send a test email" icon={Send}>
        <p className="text-sm text-navy-700/70">Sends a short sample email with this sender identity. The configuration is verified only when the server accepts it.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            aria-label="Test recipient email"
            className={cn(inputClasses, "sm:flex-1")}
            value={testRecipient}
            placeholder="you@yourcompany.com"
            onChange={(e) => setTestRecipient(e.target.value)}
          />
          <button type="button" onClick={sendTest} disabled={!savedNotDirty || busy !== null || !testRecipient.trim()} className={primaryButton}>
            {busy === "email" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send Test Email
          </button>
        </div>
        {needsSaveHint ? <p className="mt-2 text-xs text-navy-700/55">{needsSaveHint}</p> : null}
        {emailResult ? <Notice ok={emailResult.ok}>{emailResult.message}</Notice> : null}
      </Section>

      {/* 5. Domain authentication */}
      <Section step={6} title="Domain authentication (SPF, DKIM, DMARC)" icon={Globe}>
        <p className="text-sm text-navy-700/70">
          These DNS records on <strong>{domain || "your From domain"}</strong> tell inboxes your provider may send for you. A working SMTP login does not mean they&rsquo;re set up — this check reads public DNS.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="DKIM selector" hint="(from your provider)" htmlFor="ec-dkim">
            <input id="ec-dkim" className={inputClasses} value={form.dkimSelector} placeholder="e.g. google, s1, selector1" onChange={(e) => set("dkimSelector", e.target.value)} />
          </Field>
          <button type="button" onClick={checkDns} disabled={!savedNotDirty || busy !== null} className={secondaryButton}>
            {busy === "dns" ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />} Check DNS records
          </button>
        </div>
        {dirty && form.dkimSelector !== saved.dkimSelector ? <p className="mt-2 text-xs text-navy-700/55">Save to use the new DKIM selector.</p> : null}

        {config?.domainCheck ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-navy-700/55">
              {config.domainCheck.domain} · checked {formatDateTime(config.domainCheck.checkedAt)}
            </p>
            {(["spf", "dkim", "dmarc"] as const).map((k) => (
              <DnsRow key={k} name={k.toUpperCase()} check={config.domainCheck![k]} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-navy-700/55">Not checked yet.</p>
        )}

        <details className="mt-4 rounded-xl bg-navy-950/[0.025] px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-navy-950">DNS records for {preset.label}</summary>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-navy-700/80">
            {preset.dnsHelp.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-navy-700/55">Your provider&rsquo;s dashboard shows the exact values for your domain — copy them from there.</p>
        </details>
      </Section>
    </div>
  );
}

function DnsRow({ name, check }: { name: string; check: DnsRecordCheck }) {
  return (
    <div className="rounded-xl border border-navy-950/[0.07] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-14 text-sm font-medium text-navy-950">{name}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", DNS_STYLE[check.status])}>{DNS_STATUS_LABELS[check.status]}</span>
      </div>
      <p className="mt-1 text-sm text-navy-700/75">{check.detail}</p>
      {check.record ? <code className="mt-1 block break-all rounded bg-navy-950/[0.04] px-2 py-1 text-xs text-navy-700/80">{check.record}</code> : null}
    </div>
  );
}
