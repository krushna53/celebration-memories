import { WHATSAPP_CATEGORIES, type WhatsAppCategory, type WhatsAppOutgoingPayload, type WhatsAppTemplateMap } from "./types";

/**
 * Builders for the /messages request bodies. Template parameters are
 * named (WHATSAPP_CATEGORIES[category].params) so callers can't get the
 * {{1}}/{{2}} order wrong, and are validated before anything is queued.
 */

export type BuildResult = { ok: true; payload: WhatsAppOutgoingPayload } | { ok: false; error: string };

/** Meta's body-parameter limits: no newlines/tabs, at most 4 consecutive spaces, and a sane length. */
export function sanitizeTemplateParam(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, 900);
}

export function resolveTemplate(category: WhatsAppCategory, map: WhatsAppTemplateMap): { name: string; language: string } {
  const mapped = map[category];
  const spec = WHATSAPP_CATEGORIES[category];
  return mapped?.name ? { name: mapped.name, language: mapped.language || spec.defaultLanguage } : { name: spec.defaultTemplate, language: spec.defaultLanguage };
}

export function buildTemplatePayload(
  category: WhatsAppCategory,
  values: Record<string, string | null | undefined>,
  map: WhatsAppTemplateMap = {},
): BuildResult {
  const spec = WHATSAPP_CATEGORIES[category];
  const { name, language } = resolveTemplate(category, map);
  const parameters: Array<{ type: "text"; text: string }> = [];
  for (const key of spec.params) {
    const text = sanitizeTemplateParam(values[key] ?? "");
    if (!text) return { ok: false, error: `Missing template value "${key}".` };
    parameters.push({ type: "text", text });
  }
  return {
    ok: true,
    payload: {
      type: "template",
      template: {
        name,
        language: { code: language },
        ...(parameters.length > 0 ? { components: [{ type: "body" as const, parameters }] } : {}),
      },
    },
  };
}

export function buildTextPayload(body: string): BuildResult {
  const text = body.trim();
  if (!text) return { ok: false, error: "Message is empty." };
  if (text.length > 4096) return { ok: false, error: "Message is longer than WhatsApp's 4096-character limit." };
  return { ok: true, payload: { type: "text", text: { body: text, preview_url: /https?:\/\//.test(text) } } };
}

function httpsUrl(link: string): boolean {
  try {
    return new URL(link).protocol === "https:";
  } catch {
    return false;
  }
}

export function buildImagePayload(link: string, caption?: string): BuildResult {
  if (!httpsUrl(link)) return { ok: false, error: "Image link must be an https URL." };
  return { ok: true, payload: { type: "image", image: { link, ...(caption ? { caption: caption.slice(0, 1024) } : {}) } } };
}

export function buildDocumentPayload(link: string, filename?: string, caption?: string): BuildResult {
  if (!httpsUrl(link)) return { ok: false, error: "Document link must be an https URL." };
  return {
    ok: true,
    payload: {
      type: "document",
      document: { link, ...(filename ? { filename: filename.slice(0, 240) } : {}), ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
    },
  };
}

/** The full Graph API body for one recipient. */
export function toGraphBody(phone: string, payload: WhatsAppOutgoingPayload): Record<string, unknown> {
  return { messaging_product: "whatsapp", recipient_type: "individual", to: phone, ...payload };
}
