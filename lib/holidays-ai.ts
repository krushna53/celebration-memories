import "server-only";
import OpenAI from "openai";

import {
  COUNTRY_NAMES,
  STATE_NAMES,
  holidayKey,
  isHolidayType,
  isIsoDate,
  isStateCode,
  type HolidayType,
} from "@/lib/holidays";

/**
 * "Fetch with AI" for the Holiday Calendar: OpenAI (same OPENAI_API_KEY as
 * the other AI features) searches the web for the official holiday list of a
 * country + year (+ state) and returns it as structured data, every holiday
 * with the page it came from.
 *
 * Nothing it returns is trusted as fact: dates are checked (real, in the
 * year), categories and states are checked, duplicates dropped, and a
 * holiday is marked `verified` only when its source URL is one the web
 * search actually opened. The page shows the result as suggestions that an
 * admin reviews before anything is added.
 */

export class HolidayAiError extends Error {}

export interface AiHoliday {
  name: string;
  /** YYYY-MM-DD */
  date: string;
  type: HolidayType;
  stateCode: string | null;
  /** The date follows the moon (Id, Muharram…) and may shift by a day. */
  mayVary: boolean;
  sourceUrl: string | null;
  /** The source URL is one the web search really opened. */
  verified: boolean;
}

export interface AiHolidayResult {
  /** official = the government list for the year was found; partial = only some; not_found = none published yet. */
  status: "official" | "partial" | "not_found";
  note: string;
  holidays: AiHoliday[];
  sources: { url: string; title: string }[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "note", "holidays"],
  properties: {
    status: { type: "string", enum: ["official", "partial", "not_found"] },
    note: { type: "string" },
    holidays: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "date", "type", "state_code", "may_vary", "source_url"],
        properties: {
          name: { type: "string" },
          date: { type: "string" },
          type: { type: "string", enum: ["national", "religious", "regional", "optional"] },
          state_code: { type: ["string", "null"] },
          may_vary: { type: "boolean" },
          source_url: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

function instructions(year: number, country: string, state: string | null): string {
  const countryName = COUNTRY_NAMES[country] ?? country;
  const stateName = state ? (STATE_NAMES[state] ?? state) : null;
  return `You find official public holidays for companies in ${countryName}. Use web search. Reply with JSON only.

Find the holidays for calendar year ${year}${stateName ? ` and the state of ${stateName} (code ${state})` : ""}.

Sources, in this order of preference:
1. For ${countryName}: the Government of India, Department of Personnel & Training (DoPT) Office Memorandum "List of holidays to be observed in Central Government offices during the year ${year}" (Annexure I = gazetted/closed holidays, Annexure II = restricted holidays), from dopt.gov.in or pages that reproduce it in full (e.g. staffnews.in, government department sites).
${stateName ? `2. For ${stateName}: the state government's official ${year} public holiday notification.` : ""}

Categories ("type"):
- "national": Republic Day, Independence Day, Mahatma Gandhi's Birthday.
- "religious": every other gazetted (closed) holiday in the DoPT list.
- "optional": the DoPT restricted holidays.
- "regional": ${stateName ? `holidays specific to ${stateName} from its state notification (state_code "${state}")` : "do not return any (no state chosen)"}.
state_code is null for all-India holidays.

Strict rules:
- NEVER guess or calculate a date. Only return dates you read in a source for ${year}. Festival dates (Holi, Diwali, Eid, Dussehra…) change every year.
- If the official list for ${year} has not been published yet, set status "not_found", return only holidays with dates fixed by law that never change (Republic Day 26 January, Independence Day 15 August, Mahatma Gandhi's Birthday 2 October, Christmas Day 25 December${stateName ? ", and state formation days with a fixed date" : ""}), and explain in "note".
- status "official" only when you found the full official list; "partial" if only part of it.
- Dates as YYYY-MM-DD. Names as in the source, in English. may_vary = true for holidays whose date depends on the moon (Id-ul-Fitr, Id-ul-Zuha, Muharram, Milad-un-Nabi).
- source_url: the exact page where you read that holiday, or null.
- "note": one or two short sentences for the admin (which list you used, anything to double-check).`;
}

function cleanUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Same page, ignoring tracking parameters / trailing slash, for the "verified" check. */
function pageKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url;
  }
}

export async function fetchHolidaysWithAi(year: number, country: string, state: string | null): Promise<AiHolidayResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new HolidayAiError("Fetch with AI isn't configured — add OPENAI_API_KEY to enable it.");
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";

  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: instructions(year, country, state),
      input: `List the ${year} holidays${state ? ` (with ${STATE_NAMES[state] ?? state} regional holidays)` : ""}.`,
      tools: [{ type: "web_search", user_location: { type: "approximate", country } }],
      include: ["web_search_call.action.sources"],
      text: { format: { type: "json_schema", name: "holidays", schema: SCHEMA, strict: true } },
      max_output_tokens: 16_000,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new HolidayAiError(`Fetch with AI failed: ${message}`);
  }

  // Every page the web search opened or cited — the only URLs that count as "verified".
  const sources = new Map<string, { url: string; title: string }>();
  for (const item of response.output ?? []) {
    if (item.type === "web_search_call" && item.action && "sources" in item.action) {
      for (const s of item.action.sources ?? []) {
        const url = cleanUrl((s as { url?: unknown }).url);
        if (url) sources.set(pageKey(url), { url, title: "" });
      }
    }
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type !== "output_text") continue;
        for (const a of part.annotations ?? []) {
          if (a.type !== "url_citation") continue;
          const url = cleanUrl(a.url);
          if (url) sources.set(pageKey(url), { url, title: a.title ?? "" });
        }
      }
    }
  }

  const raw = response.output_text?.trim();
  if (!raw) throw new HolidayAiError("The AI didn't return a holiday list. Please try again.");
  let parsed: { status?: unknown; note?: unknown; holidays?: unknown };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new HolidayAiError("The AI's answer was cut off. Please try again.");
  }

  const seen = new Set<string>();
  const holidays: AiHoliday[] = [];
  for (const h of Array.isArray(parsed.holidays) ? (parsed.holidays as Record<string, unknown>[]).slice(0, 150) : []) {
    const name = typeof h.name === "string" ? h.name.trim().replace(/\s+/g, " ").slice(0, 120) : "";
    const date = typeof h.date === "string" ? h.date.trim() : "";
    if (!name || !isIsoDate(date) || Number(date.slice(0, 4)) !== year || !isHolidayType(h.type)) continue;
    const stateCode = isStateCode(h.state_code) ? h.state_code : null;
    // Regional holidays only for the chosen state; nothing for other states.
    if (h.type === "regional" ? !state || stateCode !== state : stateCode !== null) continue;
    const key = `${stateCode ?? ""}|${holidayKey(name, date)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const sourceUrl = cleanUrl(h.source_url);
    holidays.push({
      name,
      date,
      type: h.type,
      stateCode,
      mayVary: h.may_vary === true,
      sourceUrl,
      verified: Boolean(sourceUrl && sources.has(pageKey(sourceUrl))),
    });
  }
  holidays.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

  const status = parsed.status === "official" || parsed.status === "partial" ? parsed.status : "not_found";
  return {
    status: holidays.length === 0 ? "not_found" : status,
    note: typeof parsed.note === "string" ? parsed.note.trim().slice(0, 400) : "",
    holidays,
    sources: [...sources.values()].slice(0, 12),
  };
}
