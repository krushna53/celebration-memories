import "server-only";

import { verifyMediaLink } from "@/lib/media-url";
import { DEFAULT_EVENT_TIMEZONE, utcIsoToZonedInputValue } from "@/lib/timezone";
import type { EventRecord } from "@/types/event";
import { publicMediaUrl } from "@/services/uploads";
import { FORM_GROUPS, formDefaults } from "@/features/sacred-garden/lib/invitation-form";

/**
 * The Sacred Garden create-page design as it is kept on the event
 * (events.design_config): one string per form field. Pictures, video and
 * music the couple uploaded live in Storage and are stored as
 * "media:<bucket>/<path>" refs, turned into signed links only when shown.
 */
export type Design = Record<string, string>;

type FieldSpec = { type: string; choices?: string[] };

const MAX_TEXT = 5000;
const REF = /^media:(gallery|audio)\/(.+)$/;
const SIGNED_LINK = /^\/media\/(gallery|audio)\/([^?]+)\?e=(\d+)&s=([^&]+)$/;

/** Every form field's type (and allowed choices), from the form's own definition. */
const SPECS: Map<string, FieldSpec> = new Map(
  (FORM_GROUPS as unknown as { fields: [string, string, string?, [string, string][]?][] }[])
    .flatMap((group) => group.fields)
    .map(([key, , type = "text", choices]) => [key, { type, choices: choices?.map(([value]) => value) }]),
);
// set by the create page itself, not typed by the couple
SPECS.set("envelopeFilm", { type: "url" });
SPECS.set("envelopeLetters", { type: "text" });

/** A site path ("/invite-art/…") or an https link — never data:, javascript: or a protocol-relative "//". */
const isLink = (value: string) => /^https:\/\/[^\s]+$/i.test(value) || /^\/(?!\/)[^\s]*$/.test(value);

/** A signed /media link shown in the editor back into the ref it was made from (only this event's own files). */
function refFromSignedLink(value: string, eventId: string): string | null {
  const m = SIGNED_LINK.exec(value);
  if (!m) return null;
  const [, bucket = "", encoded = "", expires = "", signature = ""] = m;
  const path = encoded.split("/").map(decodeURIComponent).join("/");
  const check = verifyMediaLink(bucket, path, expires, decodeURIComponent(signature), { allowExpired: true });
  return check.ok && path.startsWith(`${eventId}/design/`) ? `media:${bucket}/${path}` : null;
}

/**
 * Checks a design sent by the create page before it is saved on `eventId`.
 * Unknown keys are dropped; a bad value is an error naming the field.
 */
export function cleanDesign(input: unknown, eventId: string): Design {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid website data.");
  const design: Design = {};
  for (const [key, spec] of SPECS) {
    const raw = (input as Record<string, unknown>)[key];
    const value = typeof raw === "string" ? raw.trim() : String((formDefaults as Record<string, unknown>)[key] ?? "");
    if (value.length > MAX_TEXT) throw new Error(`"${key}" is too long.`);
    if (spec.type === "select" && !spec.choices?.includes(value)) throw new Error(`Pick one of the choices for "${key}".`);
    if (spec.type === "color" && !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`"${key}" must be a colour like #b8925a.`);
    if (["image", "video", "audio", "url"].includes(spec.type) && value) {
      const ref = REF.exec(value);
      if (ref) {
        if (!ref[2]?.startsWith(`${eventId}/design/`) || ref[2].includes("..")) throw new Error(`"${key}" points to a file of another event.`);
      } else {
        const fromLink = refFromSignedLink(value, eventId);
        if (fromLink) { design[key] = fromLink; continue; }
        if (!isLink(value)) throw new Error(`"${key}" must be an uploaded file or an https link.`);
      }
    }
    design[key] = value;
  }
  return design;
}

/** The design with its media refs turned into links a browser can load. */
export function resolveDesignMedia(design: Design): Design {
  return Object.fromEntries(
    Object.entries(design).map(([key, value]) => {
      const ref = typeof value === "string" ? REF.exec(value) : null;
      return [key, ref ? publicMediaUrl(ref[1] ?? "", ref[2] ?? "") : value];
    }),
  );
}

/**
 * What the form opens with for a draft: its saved design, else the sample
 * with whatever the wizard already knows (names, date, venue, dress code, link).
 */
export function designFormFor(event: EventRecord): Design {
  const defaults = formDefaults as Design;
  if (event.designConfig) return { ...defaults, ...resolveDesignMedia(event.designConfig) };
  // a fresh draft is called "New Event" until the host names it
  const named = event.honoreeName.trim() !== "New Event";
  const [groom = "", bride = ""] = named ? event.honoreeName.split(/\s*(?:&|\band\b)\s*/i).map((n) => n.trim()) : [];
  return {
    ...defaults,
    ...(groom ? { groom } : {}),
    ...(bride ? { bride } : {}),
    ...(named ? { date: utcIsoToZonedInputValue(event.startAt, event.timezone || DEFAULT_EVENT_TIMEZONE) } : {}),
    ...(event.venueName ? { venueName: event.venueName, venueMap: [event.venueName, event.venueAddress].filter(Boolean).join(", ") } : {}),
    ...(event.venueAddress ? { venueAddress: event.venueAddress } : {}),
    ...(event.dressCode ? { dress: event.dressCode } : {}),
    slug: event.slug.startsWith("draft-") ? "" : event.slug,
  };
}
