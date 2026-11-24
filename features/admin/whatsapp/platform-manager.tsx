"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlugZap, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  checkWhatsAppConnectionAction,
  savePlatformWhatsAppSettingsAction,
  sendWhatsAppTestAction,
} from "@/features/admin/whatsapp/actions";
import { WHATSAPP_CATEGORIES, type WhatsAppCategory, type WhatsAppPlatformSettings } from "@/lib/whatsapp-cloud/types";

const labelClasses = "text-xs font-medium uppercase tracking-wide text-navy-700/50";
const inputClasses =
  "mt-1.5 w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const cardClasses = "rounded-xl border border-navy-950/10 bg-white p-5";

type Notice = { kind: "success" | "error"; text: string } | null;

function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p role="status" className={`mt-3 text-sm ${notice.kind === "error" ? "text-red-700" : "text-emerald-700"}`}>
      {notice.text}
    </p>
  );
}

const CATEGORY_KEYS = Object.keys(WHATSAPP_CATEGORIES) as WhatsAppCategory[];

export function PlatformWhatsAppManager({ settings, canSend }: { settings: WhatsAppPlatformSettings; canSend: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [recipients, setRecipients] = useState(settings.testRecipients.join("\n"));
  const [templates, setTemplates] = useState<Record<string, { name: string; language: string }>>(() =>
    Object.fromEntries(CATEGORY_KEYS.map((c) => [c, { name: settings.templates[c]?.name ?? "", language: settings.templates[c]?.language ?? "" }])),
  );
  const [settingsNotice, setSettingsNotice] = useState<Notice>(null);

  const [connection, setConnection] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();

  const [testPhone, setTestPhone] = useState(settings.testRecipients[0] ?? "");
  const [testBody, setTestBody] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [testNotice, setTestNotice] = useState<Notice>(null);
  const [sending, startSending] = useTransition();

  function save() {
    setSettingsNotice(null);
    startTransition(async () => {
      const result = await savePlatformWhatsAppSettingsAction({
        enabled,
        testRecipients: recipients.split(/[\n,]+/).map((r) => r.trim()).filter(Boolean),
        templates: Object.fromEntries(
          Object.entries(templates)
            .filter(([, t]) => t.name.trim())
            .map(([c, t]) => [c, { name: t.name.trim(), language: t.language.trim() || WHATSAPP_CATEGORIES[c as WhatsAppCategory].defaultLanguage }]),
        ),
      });
      setSettingsNotice(result.success ? { kind: "success", text: "Saved." } : { kind: "error", text: result.error });
      if (result.success) router.refresh();
    });
  }

  function check() {
    startChecking(async () => {
      const result = await checkWhatsAppConnectionAction();
      if (!result.success) setConnection(result.error);
      else if (!result.data.ok) setConnection(`Not connected — ${result.data.error}`);
      else
        setConnection(
          `Connected: ${result.data.verifiedName ?? "?"} (${result.data.displayPhoneNumber ?? "?"}), quality ${result.data.qualityRating ?? "unknown"}.`,
        );
    });
  }

  function sendTest() {
    setTestNotice(null);
    startSending(async () => {
      const result = await sendWhatsAppTestAction({ phone: testPhone, body: testBody.trim() || null, confirmed });
      if (!result.success) setTestNotice({ kind: "error", text: result.error });
      else if (result.data.status === "blocked") setTestNotice({ kind: "error", text: result.data.reason ?? "Not sent." });
      else setTestNotice({ kind: result.data.status === "failed" ? "error" : "success", text: `Result: ${result.data.status}. See the log below.` });
      setConfirmed(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className={cardClasses}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg text-navy-950">API connection</h2>
          <Button variant="outline" size="sm" onClick={check} disabled={checking}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
            Check connection
          </Button>
        </div>
        <p className="mt-2 text-sm text-navy-700/70">
          {connection ?? "Asks Meta for the sending number's name and quality rating, using the server's access token."}
        </p>
      </div>

      <div className={cardClasses}>
        <h2 className="font-display text-lg text-navy-950">Settings</h2>
        <label className="mt-4 flex items-start gap-3 text-sm text-navy-950">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>
            WhatsApp messaging on for EveryMoment
            <span className="block text-xs text-navy-700/60">
              Master switch on top of the server&rsquo;s WHATSAPP_ENABLED. Events also need their own switch, and every guest needs consent.
            </span>
          </span>
        </label>

        <label className="mt-5 block">
          <span className={labelClasses}>Verified test recipients (one per line, with country code)</span>
          <textarea rows={3} value={recipients} onChange={(e) => setRecipients(e.target.value)} className={inputClasses} placeholder="919876543210" />
          <span className="mt-1 block text-xs text-navy-700/60">
            While test mode is on (WHATSAPP_TEST_MODE isn&rsquo;t &quot;false&quot;) only these numbers receive anything. Add the same numbers in the
            Meta app&rsquo;s API Setup page while you&rsquo;re on Meta&rsquo;s test number.
          </span>
        </label>

        <div className="mt-6">
          <p className={labelClasses}>Approved templates</p>
          <p className="mt-1 text-xs text-navy-700/60">
            Leave blank to use the default name. A template must be approved in WhatsApp Manager — with its body variables in this exact
            order — before it can be sent.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-navy-700/50">
                <tr>
                  <th className="py-2 pr-3 font-medium">Notification</th>
                  <th className="py-2 pr-3 font-medium">Template name</th>
                  <th className="py-2 pr-3 font-medium">Language</th>
                  <th className="py-2 font-medium">Variables</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-950/5">
                {CATEGORY_KEYS.map((c) => {
                  const spec = WHATSAPP_CATEGORIES[c];
                  const value = templates[c] ?? { name: "", language: "" };
                  return (
                    <tr key={c} className="align-top">
                      <td className="py-2 pr-3 text-navy-950">
                        {spec.label}
                        <span className="block text-xs text-navy-700/50">
                          {spec.scope === "corporate" ? "Corporate (not used yet) · " : ""}
                          {spec.metaCategory}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          aria-label={`${spec.label} template name`}
                          value={value.name}
                          placeholder={spec.defaultTemplate}
                          onChange={(e) => setTemplates((t) => ({ ...t, [c]: { ...value, name: e.target.value } }))}
                          className={inputClasses}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          aria-label={`${spec.label} language`}
                          value={value.language}
                          placeholder={spec.defaultLanguage}
                          onChange={(e) => setTemplates((t) => ({ ...t, [c]: { ...value, language: e.target.value } }))}
                          className={`${inputClasses} w-24`}
                        />
                      </td>
                      <td className="py-2 text-xs text-navy-700/70">
                        {spec.params.length ? spec.params.map((p, i) => `{{${i + 1}}} ${p}`).join(", ") : "none"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5">
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save settings
          </Button>
          <NoticeLine notice={settingsNotice} />
        </div>
      </div>

      <div className={cardClasses}>
        <h2 className="font-display text-lg text-navy-950">Send a test message</h2>
        <p className="mt-1 text-sm text-navy-700/70">
          Goes to a verified test recipient only, at most 10 an hour. Leave the message blank to send the <code>hello_world</code> template
          (or your mapped test template); free text only works within 24 hours of that number messaging you.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClasses}>Recipient</span>
            <select value={testPhone} onChange={(e) => setTestPhone(e.target.value)} className={inputClasses}>
              {settings.testRecipients.length === 0 ? <option value="">Add a test recipient above first</option> : null}
              {settings.testRecipients.map((p) => (
                <option key={p} value={p}>
                  +{p}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClasses}>Free-text message (optional)</span>
            <input value={testBody} onChange={(e) => setTestBody(e.target.value)} maxLength={1000} className={inputClasses} />
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-navy-950">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-4 w-4" />
          Yes, send a real WhatsApp message to this number
        </label>
        <div className="mt-4">
          <Button onClick={sendTest} disabled={sending || !confirmed || !testPhone || !canSend}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send test
          </Button>
          {!canSend ? <p className="mt-2 text-xs text-navy-700/60">Sending is off — set the server env vars and switch messaging on first.</p> : null}
          <NoticeLine notice={testNotice} />
        </div>
      </div>
    </div>
  );
}
