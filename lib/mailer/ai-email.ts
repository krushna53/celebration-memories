import "server-only";
import OpenAI from "openai";

import { CAMPAIGN_KINDS, type CampaignKind } from "@/types/mailer";
import { MAILER_TOKENS } from "@/lib/mailer/tokens";
import { EMAIL_HTML_MAX, sanitizeEmailHtml, wrapEmailDocument } from "@/lib/mailer/html-email";

/**
 * "Generate with AI" for Event Mailer emails: the host describes the email
 * in their own words and OpenAI (the same OPENAI_API_KEY as AI CSS / AI
 * Image) returns a subject, preview text and a complete, email-safe HTML
 * document, which then opens in the CKEditor for editing.
 *
 * The model is asked for inline-styled, table-based HTML that works in
 * Gmail/Outlook, but nothing it writes is trusted: the HTML is sanitized
 * here (lib/mailer/html-email.ts) and again on every save and send.
 */

export class AiEmailError extends Error {}

export interface GenerateEmailParams {
  prompt: string;
  kind: CampaignKind;
  /** The email currently in the editor, to revise instead of starting over. */
  currentHtml?: string | null;
  brand?: { primaryColor: string; secondaryColor: string; hasLogo: boolean } | null;
}

export interface GeneratedEmail {
  subject: string;
  preheader: string;
  html: string;
}

const PROMPT_MAX = 2000;

function instructions(): string {
  const tokens = MAILER_TOKENS.map((t) => `{{${t.token}}} (${t.label}, e.g. "${t.example}")`).join(", ");
  return `You design marketing and greeting emails for "EveryMoment Event Mailer", used by companies to email their employees, clients and guests.

The user describes the email they want. Reply with JSON only: {"subject": string, "preheader": string, "html": string}.

Rules for "html" — a complete HTML email document (<!doctype html><html><head>…</head><body>…</body></html>):
- Built for real email clients (Gmail, Outlook, Apple Mail, phones): table-based layout, a centred 600px-max content table, EVERY style inline (style="…"). No <style> block, no CSS classes, no flexbox/grid, no position, no web fonts, no external CSS.
- Never use <script>, <form>, <input>, <button>, <iframe>, <video>, <svg>, event handlers or JavaScript. Buttons are <a> links styled as buttons inside a table cell.
- Never invent image URLs. The only image allowed is the company logo, written exactly as the text {{logo}} where it should appear (it is replaced with an <img>). Decorate with colour, spacing, borders and emoji instead of images.
- Personalise with these tokens, written exactly like this: ${tokens}. Greet the reader with {{first_name}} and sign off with {{sender_name}}. Do not invent other {{tokens}}.
- Links: use https:// URLs only when the user gives them; otherwise use "#" for button hrefs and mention in no way that they are placeholders.
- Do NOT add an unsubscribe link, unsubscribe text, "view in browser" or a legal footer — the app adds its own footer with the unsubscribe link.
- Accessible: good colour contrast, readable 16px body text, a real heading.
- Write in the language the user writes in (English, Hindi, Hinglish…), keep the copy warm, professional and concise.
- "subject" ≤ 80 characters, "preheader" ≤ 120 characters; both may use tokens.`;
}

function userInput({ prompt, kind, currentHtml, brand }: GenerateEmailParams): string {
  const kindLabel = CAMPAIGN_KINDS.find((k) => k.kind === kind)?.label ?? kind;
  const parts = [`Email type: ${kindLabel}.`];
  if (brand) {
    parts.push(
      `Company brand: primary colour ${brand.primaryColor} (buttons, accents), secondary colour ${brand.secondaryColor} (headings).` +
        (brand.hasLogo ? " The company has a logo — place {{logo}} at the top of the email." : " The company has no logo — don't use {{logo}}."),
    );
  } else {
    parts.push("No brand colours are set — choose a tasteful palette that suits the email type. Don't use {{logo}}.");
  }
  if (currentHtml?.trim()) {
    parts.push(`Revise this existing email according to the request, keeping what the request doesn't change:\n\n${currentHtml.slice(0, EMAIL_HTML_MAX)}`);
  }
  parts.push(`Request:\n${prompt.trim().slice(0, PROMPT_MAX)}`);
  return parts.join("\n\n");
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "preheader", "html"],
  properties: {
    subject: { type: "string" },
    preheader: { type: "string" },
    html: { type: "string" },
  },
} as const;

export async function generateEmailFromPrompt(params: GenerateEmailParams): Promise<GeneratedEmail> {
  if (!params.prompt.trim()) throw new AiEmailError("Describe the email you want first.");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiEmailError("AI email generation isn't configured — add OPENAI_API_KEY to enable it.");
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";

  let raw: string | undefined;
  try {
    const response = await client.responses.create({
      model,
      instructions: instructions(),
      input: userInput(params),
      max_output_tokens: 16_000,
      text: { format: { type: "json_schema", name: "email", schema: SCHEMA, strict: true } },
    });
    raw = response.output_text?.trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new AiEmailError(`AI email generation failed: ${message}`);
  }
  if (!raw) throw new AiEmailError("The AI didn't return an email. Try rephrasing your request.");

  let parsed: { subject?: unknown; preheader?: unknown; html?: unknown };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new AiEmailError("The AI's answer was cut off or malformed. Try a shorter request.");
  }
  const htmlIn = typeof parsed.html === "string" ? parsed.html : "";
  let html = sanitizeEmailHtml(htmlIn);
  if (!/<body\b/i.test(html)) html = wrapEmailDocument(html);
  if (!html.replace(/<[^>]*>/g, "").trim()) throw new AiEmailError("The AI returned an empty email. Try rephrasing your request.");
  if (html.length > EMAIL_HTML_MAX) throw new AiEmailError("The generated email is too large. Ask for a shorter, simpler email.");
  return {
    subject: (typeof parsed.subject === "string" ? parsed.subject : "").trim().slice(0, 200),
    preheader: (typeof parsed.preheader === "string" ? parsed.preheader : "").trim().slice(0, 200),
    html,
  };
}
