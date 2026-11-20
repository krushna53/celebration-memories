import type { AutomationKind, CampaignKind, MailerEmailContent } from "@/types/mailer";
import { escapeHtml, renderTokens, type TokenValues } from "@/lib/mailer/tokens";

/**
 * Builds the responsive HTML email for a campaign/template — table layout
 * and inline styles so it renders the same in Gmail, Outlook and phone
 * mail apps, plus one media query that tightens padding on narrow screens.
 *
 * The body is plain text written by the host: it is HTML-escaped, then
 * blank lines become paragraphs and single newlines become <br>. Token
 * values are escaped too, so nothing a contact's name or a CSV import
 * contains can inject markup into the email.
 */

interface Theme {
  headerBg: string;
  headerText: string;
  accent: string;
  pageBg: string;
  cardBg: string;
  text: string;
  muted: string;
  ornament: string;
  eyebrow: string;
}

/** Campaign types plus the automatic birthday/anniversary emails. */
export type EmailTheme = CampaignKind | AutomationKind;

const THEMES: Record<EmailTheme, Theme> = {
  diwali: {
    headerBg: "#5b1a1a",
    headerText: "#ffd27a",
    accent: "#e8a33d",
    pageBg: "#fbf3e6",
    cardBg: "#ffffff",
    text: "#3b2314",
    muted: "#8a6f5a",
    ornament: "🪔 ✨ 🪔",
    eyebrow: "Happy Diwali",
  },
  new_year: {
    headerBg: "#1e1b4b",
    headerText: "#f5d58a",
    accent: "#ff6b57",
    pageBg: "#eef0f8",
    cardBg: "#ffffff",
    text: "#1e1b4b",
    muted: "#6b6a8a",
    ornament: "✨ 🎆 ✨",
    eyebrow: "Happy New Year",
  },
  invitation: {
    headerBg: "#ff6b57",
    headerText: "#ffffff",
    accent: "#e5503c",
    pageBg: "#fdf6ec",
    cardBg: "#ffffff",
    text: "#1e1b4b",
    muted: "#6b6a8a",
    ornament: "💌",
    eyebrow: "You're invited",
  },
  announcement: {
    headerBg: "#1e1b4b",
    headerText: "#ffffff",
    accent: "#ff6b57",
    pageBg: "#f4f4f7",
    cardBg: "#ffffff",
    text: "#1e1b4b",
    muted: "#6b6a8a",
    ornament: "📣",
    eyebrow: "Announcement",
  },
  birthday: {
    headerBg: "#be185d",
    headerText: "#ffffff",
    accent: "#db2777",
    pageBg: "#fdf2f8",
    cardBg: "#ffffff",
    text: "#3b0a24",
    muted: "#8a5a72",
    ornament: "🎂 🎈 🎉",
    eyebrow: "Happy Birthday",
  },
  hr_birthday_reminder: {
    headerBg: "#1e1b4b",
    headerText: "#ffffff",
    accent: "#ff6b57",
    pageBg: "#eef0f8",
    cardBg: "#ffffff",
    text: "#1e1b4b",
    muted: "#6b6a8a",
    ornament: "🔔",
    eyebrow: "Birthday reminder",
  },
  work_anniversary: {
    headerBg: "#0f766e",
    headerText: "#ecfeff",
    accent: "#0d9488",
    pageBg: "#effaf8",
    cardBg: "#ffffff",
    text: "#123b37",
    muted: "#5b7d78",
    ornament: "🎉 🏆 🎉",
    eyebrow: "Work Anniversary",
  },
};

/** Only http(s) links become a button — anything else (javascript:, data:, typos) is dropped. */
export function safeHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function bodyToHtml(body: string, color: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${color};">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n");
}

export interface RenderedEmail {
  subject: string;
  preheader: string;
  html: string;
  /** Plain-text alternative (sent alongside the HTML; some mail apps and spam filters prefer it). */
  text: string;
}

export function renderEmail(
  kind: EmailTheme,
  content: MailerEmailContent,
  values: TokenValues,
  /** The recipient's own unsubscribe link (live sends); previews leave it out. */
  options: { unsubscribeUrl?: string | null } = {},
): RenderedEmail {
  const unsubscribeHref = options.unsubscribeUrl ? safeHttpUrl(options.unsubscribeUrl) : null;
  const t = THEMES[kind];
  const subject = renderTokens(content.subject, values);
  const preheader = renderTokens(content.preheader, values);
  const body = renderTokens(content.body, values);
  const ctaLabel = renderTokens(content.ctaLabel, values).trim();
  const ctaUrl = safeHttpUrl(renderTokens(content.ctaUrl, values));
  const sentBy = values.sender_name ? `Sent by ${escapeHtml(values.sender_name)} via EveryMoment.` : "Sent via EveryMoment.";

  const button =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px;">
          <tr><td style="border-radius:999px;background:${t.accent};">
            <a href="${escapeHtml(ctaUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(ctaLabel)}</a>
          </td></tr>
        </table>`
      : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(subject)}</title>
<style>
  body { margin:0; padding:0; }
  @media (max-width: 620px) {
    .em-outer { padding:12px !important; }
    .em-pad { padding:24px 20px !important; }
    .em-title { font-size:24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${t.pageBg};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${t.pageBg};">
  <tr><td class="em-outer" align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${t.cardBg};border-radius:16px;overflow:hidden;">
      <tr><td class="em-pad" align="center" style="background:${t.headerBg};padding:36px 32px;">
        <div style="font-size:26px;line-height:1;">${t.ornament}</div>
        <div style="margin-top:14px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${t.headerText};opacity:0.85;">${escapeHtml(t.eyebrow)}</div>
        <h1 class="em-title" style="margin:10px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.25;font-weight:normal;color:${t.headerText};">${escapeHtml(subject)}</h1>
      </td></tr>
      <tr><td class="em-pad" style="padding:36px 40px 28px;">
        ${bodyToHtml(body, t.text)}
        ${button}
      </td></tr>
      <tr><td class="em-pad" style="padding:20px 40px 32px;border-top:1px solid rgba(0,0,0,0.06);">
        <p style="margin:0;font-size:13px;line-height:1.6;color:${t.muted};">${sentBy}</p>
        <p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:${t.muted};">Don't want these emails? <a href="${unsubscribeHref ? escapeHtml(unsubscribeHref) : "#"}" target="_blank" style="color:${t.muted};">Unsubscribe</a>.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    body.replace(/\r\n/g, "\n").trim(),
    ctaLabel && ctaUrl ? `${ctaLabel}: ${ctaUrl}` : "",
    "--",
    values.sender_name ? `Sent by ${values.sender_name} via EveryMoment.` : "Sent via EveryMoment.",
    unsubscribeHref ? `Unsubscribe: ${unsubscribeHref}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject, preheader, html, text };
}
