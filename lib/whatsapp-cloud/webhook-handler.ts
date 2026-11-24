import type { WhatsAppWebhookEvent } from "./types";

/**
 * Turns a (signature-verified) Meta webhook body into a flat list of
 * events. Defensive about shape — anything unexpected is skipped rather
 * than throwing, since one malformed entry shouldn't drop the rest of a
 * batch. Returns null when the body isn't a WhatsApp Business Account
 * notification at all (→ 400).
 */

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

function toIso(unixSeconds: unknown): string {
  const n = Number(unixSeconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString();
}

function parseErrors(v: unknown): Array<{ code: number; title: string }> {
  return asArray(v)
    .filter(isObject)
    .map((e) => {
      const data = isObject(e.error_data) ? e.error_data : null;
      const title = str(data?.details) ?? str(e.title) ?? str(e.message) ?? "Unknown error";
      return { code: Number(e.code) || 0, title: title.slice(0, 300) };
    });
}

function inboundText(message: Json): string | null {
  if (isObject(message.text)) return str(message.text.body);
  if (isObject(message.button)) return str(message.button.text);
  if (isObject(message.interactive)) {
    const reply = isObject(message.interactive.button_reply) ? message.interactive.button_reply : isObject(message.interactive.list_reply) ? message.interactive.list_reply : null;
    return str(reply?.title);
  }
  return null;
}

const STATUSES = new Set(["sent", "delivered", "read", "failed"]);

export function parseWebhookPayload(body: unknown): WhatsAppWebhookEvent[] | null {
  if (!isObject(body) || body.object !== "whatsapp_business_account") return null;
  const events: WhatsAppWebhookEvent[] = [];

  for (const entry of asArray(body.entry).filter(isObject)) {
    for (const change of asArray(entry.changes).filter(isObject)) {
      if (change.field !== "messages" || !isObject(change.value)) continue;
      const value = change.value;

      for (const s of asArray(value.statuses).filter(isObject)) {
        const wamid = str(s.id);
        const status = str(s.status);
        if (!wamid || !status || !STATUSES.has(status)) continue;
        events.push({
          kind: "status",
          dedupeKey: `status:${wamid}:${status}`,
          wamid,
          status: status as "sent" | "delivered" | "read" | "failed",
          recipientPhone: str(s.recipient_id) ?? "",
          timestamp: toIso(s.timestamp),
          errors: parseErrors(s.errors),
          raw: s,
        });
      }

      for (const m of asArray(value.messages).filter(isObject)) {
        const wamid = str(m.id);
        const from = str(m.from);
        if (!wamid || !from) continue;
        events.push({
          kind: "message",
          dedupeKey: `message:${wamid}`,
          wamid,
          fromPhone: from.replace(/\D/g, ""),
          timestamp: toIso(m.timestamp),
          messageType: str(m.type) ?? "unknown",
          text: inboundText(m),
          raw: m,
        });
      }

      const errors = parseErrors(value.errors);
      if (errors.length > 0) {
        const phoneNumberId = isObject(value.metadata) ? str(value.metadata.phone_number_id) : null;
        events.push({
          kind: "error",
          dedupeKey: `error:${phoneNumberId ?? "?"}:${errors.map((e) => e.code).join(",")}:${toIso(entry.time ?? null).slice(0, 16)}`,
          errors,
          raw: value.errors,
        });
      }
    }
  }
  return events;
}
