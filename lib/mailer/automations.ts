import type {
  AutomationKind,
  AutomationLogEntry,
  AutomationSettings,
  MailerContact,
  MailerData,
  MailerEmailContent,
} from "@/types/mailer";
import { contactDisplayName } from "@/lib/mailer/email";
import { formatMailerDate } from "@/lib/mailer/tokens";

/**
 * Birthday & work-anniversary automations — the pure rules, shared by mock
 * mode (simulated in the browser) and live mode (services/mailer/automations.ts
 * sends for real, once a day).
 *
 * Dates are calendar dates (YYYY-MM-DD, no time), compared against "today"
 * in India time — never the server clock's own day, which is UTC on Netlify
 * and would send a day early/late around midnight.
 *
 * Every email has a key (e.g. "birthday:<contactId>:2026"); a key already
 * in the log as sent/sending/simulated is never sent again, so running the
 * job twice in a day — or a retry after a crash — can't send duplicates.
 */

export const AUTOMATION_TIMEZONE = "Asia/Kolkata";
/** Local hour (in AUTOMATION_TIMEZONE) from which the daily job sends. */
export const AUTOMATION_SEND_HOUR = 9;
export const AUTOMATION_LOG_LIMIT = 500;

// --- calendar dates -------------------------------------------------------

interface Ymd {
  y: number;
  m: number;
  d: number;
}

export function parseYmd(value: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function isValidCalendarDate(value: string): boolean {
  return parseYmd(value) !== null && Number(value.slice(0, 4)) >= 1900;
}

/**
 * A date typed by a person or found in a CSV → YYYY-MM-DD. Accepts
 * 2026-11-19, 19-11-2026, 19/11/2026 and 19.11.2026 (day first, as in
 * India). Returns "" for blank and null when it can't be read.
 */
export function normalizeDateInput(value: string): string | null {
  const text = (value ?? "").trim();
  if (!text) return "";
  if (isValidCalendarDate(text)) return text;
  const match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (!match) return null;
  const candidate = ymd(Number(match[3]), Number(match[2]), Number(match[1]));
  return isValidCalendarDate(candidate) ? candidate : null;
}

function ymd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Today's calendar date in `timeZone`. */
export function todayIn(nowMs: number, timeZone = AUTOMATION_TIMEZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nowMs));
}

export function hourIn(nowMs: number, timeZone = AUTOMATION_TIMEZONE): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(nowMs)));
}

export function addDays(day: string, n: number): string {
  const p = parseYmd(day);
  if (!p) return day;
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The yearly date's day in `year` — 29 Feb becomes 28 Feb in non-leap years. */
function inYear(date: Ymd, year: number): string {
  if (date.m === 2 && date.d === 29 && !isLeap(year)) return ymd(year, 2, 28);
  return ymd(year, date.m, date.d);
}

/** Whether a yearly date (birthday, joining date) is celebrated on `day`, and it isn't in the future. */
export function occursOn(dateValue: string, day: string): boolean {
  const date = parseYmd(dateValue);
  const today = parseYmd(day);
  if (!date || !today || dateValue > day) return false;
  return inYear(date, today.y) === day;
}

export function yearsSince(dateValue: string, day: string): number {
  const date = parseYmd(dateValue);
  const today = parseYmd(day);
  return date && today ? today.y - date.y : 0;
}

/** The next day (from `fromDay`, inclusive) a yearly date is celebrated. */
export function nextOccurrence(dateValue: string, fromDay: string): string | null {
  const date = parseYmd(dateValue);
  const from = parseYmd(fromDay);
  if (!date || !from) return null;
  const thisYear = inYear(date, from.y);
  return thisYear >= fromDay ? thisYear : inYear(date, from.y + 1);
}

// --- settings -------------------------------------------------------------

const DEFAULT_CONTENT: Record<AutomationKind, MailerEmailContent> = {
  birthday: {
    subject: "Happy Birthday, {{first_name}}! 🎂",
    preheader: "Wishing you a wonderful year ahead",
    body:
      "Dear {{first_name}},\n\nWishing you a very happy birthday! May the year ahead bring you joy, good health and success.\n\nThank you for everything you bring to the team.\n\nWarm wishes,\n{{sender_name}}",
    ctaLabel: "",
    ctaUrl: "",
  },
  hr_birthday_reminder: {
    subject: "Reminder: {{celebrant_name}}'s birthday is tomorrow",
    preheader: "{{birthday_date}}",
    body:
      "Hi {{first_name}},\n\nA quick reminder that {{celebrant_name}} celebrates their birthday tomorrow ({{birthday_date}}).\n\nA birthday greeting will be sent to them automatically. You may want to plan a wish or a small celebration.\n\n{{sender_name}}",
    ctaLabel: "",
    ctaUrl: "",
  },
  work_anniversary: {
    subject: "Congratulations on {{years_label}} with us, {{first_name}}! 🎉",
    preheader: "Thank you for being part of the team",
    body:
      "Dear {{first_name}},\n\nToday marks {{years_label}} since you joined us. Thank you for your hard work, dedication and everything you've contributed along the way.\n\nHere's to many more milestones together!\n\nWarm regards,\n{{sender_name}}",
    ctaLabel: "",
    ctaUrl: "",
  },
};

export function defaultAutomationSettings(): AutomationSettings {
  return {
    rules: {
      birthday: { enabled: false, content: { ...DEFAULT_CONTENT.birthday } },
      hr_birthday_reminder: { enabled: false, content: { ...DEFAULT_CONTENT.hr_birthday_reminder } },
      work_anniversary: { enabled: false, content: { ...DEFAULT_CONTENT.work_anniversary } },
    },
    senderId: null,
    senderName: "",
  };
}

export function defaultAutomationContent(kind: AutomationKind): MailerEmailContent {
  return { ...DEFAULT_CONTENT[kind] };
}

/** The saved settings, with defaults filled in for anything missing (older data, new rules). */
export function automationSettingsOf(data: Pick<MailerData, "automations">): AutomationSettings {
  const base = defaultAutomationSettings();
  const saved = data.automations;
  if (!saved) return base;
  for (const kind of Object.keys(base.rules) as AutomationKind[]) {
    const rule = saved.rules?.[kind];
    if (rule) base.rules[kind] = { enabled: Boolean(rule.enabled), content: { ...base.rules[kind].content, ...rule.content } };
  }
  base.senderId = saved.senderId ?? null;
  base.senderName = saved.senderName ?? "";
  return base;
}

// --- planning -------------------------------------------------------------

export interface AutomationJob {
  key: string;
  kind: AutomationKind;
  /** The person being celebrated. */
  celebrant: MailerContact;
  /** Who gets the email: the celebrant, or an HR contact. */
  recipient: MailerContact;
  occasionDate: string;
  /** Values for the automation-only tokens ({{years}}, {{celebrant_name}}…). */
  tokens: Record<AutomationToken, string>;
}

export const AUTOMATION_TOKENS = [
  { token: "celebrant_name", label: "Birthday/anniversary person's full name" },
  { token: "celebrant_first_name", label: "Their first name" },
  { token: "birthday_date", label: "Their birthday (HR reminder)" },
  { token: "years", label: "Years since joining (number)" },
  { token: "years_label", label: "Years since joining (\"3 years\")" },
] as const;

export type AutomationToken = (typeof AUTOMATION_TOKENS)[number]["token"];

function jobTokens(celebrant: MailerContact, occasionDate: string, years: number): Record<AutomationToken, string> {
  return {
    celebrant_name: contactDisplayName(celebrant),
    celebrant_first_name: celebrant.firstName.trim() || contactDisplayName(celebrant),
    birthday_date: formatMailerDate(occasionDate),
    years: years > 0 ? String(years) : "",
    years_label: years > 0 ? `${years} ${years === 1 ? "year" : "years"}` : "",
  };
}

/** Log keys that mean "already handled — don't send again". */
function handledKeys(log: readonly AutomationLogEntry[] | undefined): Set<string> {
  return new Set((log ?? []).filter((e) => e.status !== "failed").map((e) => e.key));
}

/** Everything due on `today` (YYYY-MM-DD) that hasn't been sent yet. */
export function planAutomations(data: MailerData, today: string): AutomationJob[] {
  const settings = automationSettingsOf(data);
  const done = handledKeys(data.automationLog);
  const year = today.slice(0, 4);
  const jobs: AutomationJob[] = [];
  const subscribed = data.contacts.filter((c) => c.subscribed);

  if (settings.rules.birthday.enabled) {
    for (const c of subscribed) {
      if (!occursOn(c.dateOfBirth, today)) continue;
      jobs.push({ key: `birthday:${c.id}:${year}`, kind: "birthday", celebrant: c, recipient: c, occasionDate: today, tokens: jobTokens(c, today, 0) });
    }
  }

  if (settings.rules.hr_birthday_reminder.enabled) {
    const tomorrow = addDays(today, 1);
    const hrTeam = subscribed.filter((c) => c.roles.includes("hr"));
    // Reminders are about anyone with a birthday tomorrow — even people who opted out of emails themselves.
    for (const celebrant of data.contacts) {
      if (!occursOn(celebrant.dateOfBirth, tomorrow)) continue;
      for (const hr of hrTeam) {
        if (hr.id === celebrant.id) continue;
        jobs.push({
          key: `hr_birthday_reminder:${celebrant.id}:${hr.id}:${tomorrow.slice(0, 4)}`,
          kind: "hr_birthday_reminder",
          celebrant,
          recipient: hr,
          occasionDate: tomorrow,
          tokens: jobTokens(celebrant, tomorrow, 0),
        });
      }
    }
  }

  if (settings.rules.work_anniversary.enabled) {
    for (const c of subscribed) {
      const years = yearsSince(c.joiningDate, today);
      if (years < 1 || !occursOn(c.joiningDate, today)) continue;
      jobs.push({ key: `work_anniversary:${c.id}:${year}`, kind: "work_anniversary", celebrant: c, recipient: c, occasionDate: today, tokens: jobTokens(c, today, years) });
    }
  }

  return jobs.filter((j) => !done.has(j.key));
}

/** Fills the automation-only tokens; the regular ones ({{first_name}}…) are filled by renderEmail. */
export function applyAutomationTokens(content: MailerEmailContent, tokens: Record<AutomationToken, string>): MailerEmailContent {
  const fill = (text: string) =>
    text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, name: string) => {
      const key = name.toLowerCase() as AutomationToken;
      return key in tokens ? tokens[key] : whole;
    });
  return {
    subject: fill(content.subject),
    preheader: fill(content.preheader),
    body: fill(content.body),
    ctaLabel: fill(content.ctaLabel),
    ctaUrl: fill(content.ctaUrl),
  };
}

export function logEntryFor(job: AutomationJob, status: AutomationLogEntry["status"], error: string | null, at: string): AutomationLogEntry {
  return {
    key: job.key,
    kind: job.kind,
    contactId: job.celebrant.id,
    contactName: contactDisplayName(job.celebrant),
    recipientEmail: job.recipient.email,
    occasionDate: job.occasionDate,
    status,
    error,
    at,
  };
}

/** Adds or replaces entries (matched by key), newest first, capped. */
export function mergeLog(log: readonly AutomationLogEntry[] | undefined, entries: readonly AutomationLogEntry[]): AutomationLogEntry[] {
  const keys = new Set(entries.map((e) => e.key));
  return [...entries, ...(log ?? []).filter((e) => !keys.has(e.key))].slice(0, AUTOMATION_LOG_LIMIT);
}

// --- upcoming (for the screen) ---------------------------------------------

export interface UpcomingOccasion {
  date: string;
  kind: "birthday" | "work_anniversary";
  contact: MailerContact;
  /** Work anniversaries: which one. */
  years: number;
}

export function upcomingOccasions(contacts: readonly MailerContact[], today: string, days = 30): UpcomingOccasion[] {
  const last = addDays(today, days);
  const out: UpcomingOccasion[] = [];
  for (const c of contacts) {
    const birthday = c.dateOfBirth ? nextOccurrence(c.dateOfBirth, today) : null;
    if (birthday && birthday <= last && c.dateOfBirth <= today) out.push({ date: birthday, kind: "birthday", contact: c, years: 0 });
    const anniversary = c.joiningDate ? nextOccurrence(c.joiningDate, today) : null;
    if (anniversary && anniversary <= last) {
      const years = yearsSince(c.joiningDate, anniversary);
      if (years >= 1) out.push({ date: anniversary, kind: "work_anniversary", contact: c, years });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
