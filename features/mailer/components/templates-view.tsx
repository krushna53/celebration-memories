"use client";

import { useRef, useState } from "react";
import { LayoutTemplate, Pencil, Plus, Send, Trash2 } from "lucide-react";

import { CAMPAIGN_KINDS, type CampaignKind, type MailerTemplate, type MailerTemplateInput } from "@/types/mailer";
import { LOGO_TOKEN, MAILER_TOKENS } from "@/lib/mailer/tokens";
import { brandOf } from "@/lib/mailer/brand";
import { starterEmailHtml } from "@/lib/mailer/email-html";
import { useMailer } from "@/features/mailer/mailer-provider";
import { useMailerNav } from "@/features/mailer/mailer-nav";
import { EmailPreview } from "@/features/mailer/components/email-preview";
import {
  AiEmailGenerator,
  HtmlEmailEditor,
  MessageFormatSwitch,
  plainTextOf,
  type HtmlEmailEditorHandle,
} from "@/features/mailer/components/html-message-tools";
import {
  Card,
  ErrorText,
  Field,
  inputClasses,
  KIND_ICON_BG,
  labelClasses,
  KindTag,
  Modal,
  primaryButton,
  secondaryButton,
  timeAgo,
} from "@/features/mailer/components/ui";
import { cn } from "@/lib/utils";

export function TemplatesView() {
  const { data, run } = useMailer();
  const navigate = useMailerNav();
  const [editing, setEditing] = useState<MailerTemplate | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(t: MailerTemplate) {
    if (!confirm(`Delete the template "${t.name}"?`)) return;
    const result = await run((repo) => repo.deleteTemplate(t.id));
    setError(result.ok ? null : result.error);
  }

  return (
    <Card className="bg-navy-950/[0.015]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-navy-950">Templates</h2>
        <button type="button" onClick={() => setEditing("new")} className={primaryButton}>
          <Plus size={15} /> New template
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.templates.map((t) => (
          <div key={t.id} className="flex flex-col rounded-2xl border border-navy-950/[0.07] bg-white p-4">
            <div className="flex items-start gap-3">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", KIND_ICON_BG[t.kind])}>
                <LayoutTemplate size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-navy-950">{t.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-navy-700/55">
                  <KindTag kind={t.kind} />
                  {t.builtIn ? <span>Built-in</span> : null}
                  {t.html ? <span className="rounded bg-navy-950/[0.06] px-1.5 py-px font-mono text-[10px] text-navy-700">HTML</span> : null}
                  <span>· Updated {timeAgo(t.updatedAt)}</span>
                </p>
              </div>
            </div>
            <p className="mt-3 truncate text-sm text-navy-950">{t.subject}</p>
            <p className="mt-1 line-clamp-2 text-sm text-navy-700/65">{t.body}</p>
            <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
              {!t.builtIn ? (
                <button type="button" onClick={() => remove(t)} aria-label={`Delete ${t.name}`} className="rounded-lg p-1.5 text-navy-700/55 hover:bg-red-50 hover:text-red-700">
                  <Trash2 size={15} />
                </button>
              ) : null}
              <button type="button" onClick={() => setEditing(t)} className={secondaryButton}>
                <Pencil size={14} /> Edit
              </button>
              <button
                type="button"
                onClick={async () => {
                  const result = await run((repo) =>
                    repo.saveCampaign({
                      name: `${t.name} — ${new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`,
                      kind: t.kind,
                      templateId: t.id,
                      senderName: "",
                      eventId: t.kind === "invitation" ? (data.events[0]?.id ?? null) : null,
                      audience: { contactIds: [], listIds: [] },
                      subject: t.subject,
                      preheader: t.preheader,
                      body: t.body,
                      ctaLabel: t.ctaLabel,
                      ctaUrl: t.ctaUrl,
                      html: t.html ?? "",
                    }),
                  );
                  if (result.ok) navigate({ name: "editor", id: result.value.id });
                  else setError(result.error);
                }}
                className={primaryButton}
              >
                <Send size={14} /> Use
              </button>
            </div>
          </div>
        ))}
      </div>
      {editing ? <TemplateForm template={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}

function TemplateForm({ template, onClose }: { template: MailerTemplate | null; onClose: () => void }) {
  const { data, run } = useMailer();
  const [form, setForm] = useState<MailerTemplateInput>(() =>
    template
      ? { name: template.name, kind: template.kind, subject: template.subject, preheader: template.preheader, body: template.body, ctaLabel: template.ctaLabel, ctaUrl: template.ctaUrl, html: template.html ?? "" }
      : { name: "", kind: "announcement", subject: "", preheader: "", body: "Hi {{first_name}},\n\n\n\nThank you,\n{{sender_name}}", ctaLabel: "", ctaUrl: "", html: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof MailerTemplateInput>(k: K, v: MailerTemplateInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const editor = useRef<HtmlEmailEditorHandle | null>(null);
  const isHtml = Boolean(form.html?.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const html = isHtml ? (editor.current?.flush() ?? form.html ?? "") : "";
    const input = { ...form, html, body: html ? plainTextOf(html) : form.body };
    const result = await run((repo) => repo.saveTemplate(input, template?.id));
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Modal title={template ? "Edit template" : "New template"} onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="t-name">
              <input id="t-name" className={inputClasses} value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Type" htmlFor="t-kind">
              <select id="t-kind" className={inputClasses} value={form.kind} onChange={(e) => set("kind", e.target.value as CampaignKind)}>
                {CAMPAIGN_KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Subject" htmlFor="t-subject">
            <input id="t-subject" className={inputClasses} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
          </Field>
          <Field label="Preview text" htmlFor="t-pre">
            <input id="t-pre" className={inputClasses} value={form.preheader} onChange={(e) => set("preheader", e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <MessageFormatSwitch
              isHtml={isHtml}
              onText={() => {
                if (isHtml && !confirm("Switch back to simple text? The HTML design will be removed and only its text kept.")) return;
                set("html", "");
              }}
              onHtml={() => {
                if (!isHtml) set("html", starterEmailHtml(form.kind, form, { brand: brandOf(data) }));
              }}
            />
            <AiEmailGenerator
              kind={form.kind}
              currentHtml={isHtml ? (form.html ?? null) : null}
              onGenerated={(email) => setForm((f) => ({ ...f, subject: email.subject || f.subject, preheader: email.preheader, html: email.html, body: plainTextOf(email.html) }))}
            />
          </div>
          {isHtml ? (
            <div className="space-y-2">
              <p className={labelClasses}>
                Message <span className="font-normal text-navy-700/50">(click Source to see or edit the HTML)</span>
              </p>
              <HtmlEmailEditor html={form.html ?? ""} onChange={(html) => setForm((f) => ({ ...f, html, body: plainTextOf(html) }))} handle={editor} />
              <div className="flex flex-wrap gap-1.5">
                {[...MAILER_TOKENS.map((t) => t.token), LOGO_TOKEN].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      if (!editor.current?.insertText(`{{${t}}}`)) setError("Close the Source view to insert a token, or type it into the HTML.");
                    }}
                    className="rounded-md border border-navy-950/10 bg-navy-950/[0.03] px-2 py-1 font-mono text-xs text-navy-700 hover:border-gold-500"
                  >
                    {`{{${t}}}`}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <Field label="Message" hint="(blank line = new paragraph)" htmlFor="t-body">
                <textarea id="t-body" rows={9} className={cn(inputClasses, "resize-y leading-relaxed")} value={form.body} onChange={(e) => set("body", e.target.value)} />
              </Field>
              <p className="text-xs text-navy-700/60">
                Tokens: {[...MAILER_TOKENS.map((t) => t.token), LOGO_TOKEN].map((t) => `{{${t}}}`).join(" ")}
              </p>
            </>
          )}
          <div className={cn("grid gap-4 sm:grid-cols-2", isHtml && "hidden")}>
            <Field label="Button label" hint="(optional)" htmlFor="t-cta">
              <input id="t-cta" className={inputClasses} value={form.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} />
            </Field>
            <Field label="Button link" htmlFor="t-url">
              <input id="t-url" className={inputClasses} placeholder="https://" value={form.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} />
            </Field>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={secondaryButton}>
              Cancel
            </button>
            <button type="submit" className={primaryButton}>
              {template ? "Save template" : "Create template"}
            </button>
          </div>
        </div>
        <EmailPreview kind={form.kind} content={form} senderName="" event={data.events[0] ?? null} contacts={[]} />
      </form>
    </Modal>
  );
}
