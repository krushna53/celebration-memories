/**
 * Company Holiday Calendar (Event Mailer → Holiday Calendar). Shared by the
 * page (features/mailer/components/holiday-calendar-view.tsx) and the server
 * (services/company-holidays.ts). Holiday dates are never defined here —
 * they come from Firestore's holidayMaster collection (seeded on the server
 * from services/holiday-seed.ts); this file only holds labels and validation.
 */

export type HolidayType = "national" | "religious" | "regional" | "optional";

export const HOLIDAY_GROUPS: { type: HolidayType; label: string; short: string }[] = [
  { type: "national", label: "National Holidays", short: "National" },
  { type: "religious", label: "Religious & Festival Holidays", short: "Religious & Festival" },
  { type: "regional", label: "Regional Holidays", short: "Regional" },
  { type: "optional", label: "Optional Holidays", short: "Optional" },
];

export const HOLIDAY_TYPES = HOLIDAY_GROUPS.map((g) => g.type);

export function isHolidayType(value: unknown): value is HolidayType {
  return typeof value === "string" && (HOLIDAY_TYPES as string[]).includes(value);
}

/** A predefined holiday (Firestore holidayMaster). */
export interface MasterHoliday {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  type: HolidayType;
  countryCode: string;
  stateCode: string | null;
  year: number;
  /** Added later (Fetch with AI), not part of the official list the app ships with — the owner can remove it. */
  addedByAi?: boolean;
}

/** A holiday in the company's calendar (Firestore companyHolidays). masterId null = custom. */
export interface CompanyHoliday {
  id: string;
  masterId: string | null;
  name: string;
  date: string;
  type: HolidayType;
  year: number;
  isOptional: boolean;
  isActive: boolean;
}

/** A custom holiday as edited on the page; no id = not saved yet. */
export interface CustomHolidayInput {
  id?: string;
  name: string;
  date: string;
  type: HolidayType;
}

export const COUNTRY_NAMES: Record<string, string> = { IN: "India" };

/** Labels for the state dropdown; which states appear depends on the seeded holidays. */
export const STATE_NAMES: Record<string, string> = {
  AN: "Andaman and Nicobar Islands",
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CG: "Chhattisgarh",
  CH: "Chandigarh",
  DL: "Delhi",
  GA: "Goa",
  GJ: "Gujarat",
  HP: "Himachal Pradesh",
  HR: "Haryana",
  JH: "Jharkhand",
  JK: "Jammu and Kashmir",
  KA: "Karnataka",
  KL: "Kerala",
  LA: "Ladakh",
  MH: "Maharashtra",
  ML: "Meghalaya",
  MN: "Manipur",
  MP: "Madhya Pradesh",
  MZ: "Mizoram",
  NL: "Nagaland",
  OD: "Odisha",
  PB: "Punjab",
  PY: "Puducherry",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TG: "Telangana",
  TN: "Tamil Nadu",
  TR: "Tripura",
  UK: "Uttarakhand",
  UP: "Uttar Pradesh",
  WB: "West Bengal",
};

export const MIN_HOLIDAY_YEAR = 2000;
export const MAX_HOLIDAY_YEAR = 2100;

export function isValidYear(year: unknown): year is number {
  return typeof year === "number" && Number.isInteger(year) && year >= MIN_HOLIDAY_YEAR && year <= MAX_HOLIDAY_YEAR;
}

export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value);
}

export function isStateCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{2,3}$/.test(value);
}

/** Holiday ids are plain Firestore document ids (no "/" or ".."). */
export function isHolidayId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

/** A real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Same holiday = same date and same name (ignoring case and spaces). */
export function holidayKey(name: string, date: string): string {
  return `${date}|${name.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

/** "Mon, 26 Jan 2026" — a calendar date, so no timezone shift. */
export function formatHolidayDate(date: string): string {
  if (!isIsoDate(date)) return date;
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  // Built by hand so the server and every browser show exactly the same text.
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${d} ${MONTHS[m - 1]} ${y}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function holidayTypeLabel(type: HolidayType): string {
  return HOLIDAY_GROUPS.find((g) => g.type === type)?.short ?? type;
}

/**
 * Checks one custom holiday for `year`. `taken` holds holidayKey()s of every
 * other holiday in the calendar, so the same holiday can't be added twice.
 * Returns an error message, or null when it's fine.
 */
export function customHolidayError(input: CustomHolidayInput, year: number, taken: ReadonlySet<string>): string | null {
  const name = input.name.trim();
  if (!name) return "Give the holiday a name.";
  if (name.length > 120) return "Keep the holiday name under 120 characters.";
  if (!isIsoDate(input.date)) return "Pick a valid date.";
  if (Number(input.date.slice(0, 4)) !== year) return `The date must be in ${year}.`;
  if (!isHolidayType(input.type)) return "Pick a category.";
  if (taken.has(holidayKey(name, input.date))) return `"${name}" is already in the calendar on ${formatHolidayDate(input.date)}.`;
  return null;
}

/** Cleans what the browser sent for a save; returns an error message instead when something is off. */
export function cleanSaveInput(
  input: unknown,
): { ok: true; year: number; masterIds: string[]; custom: CustomHolidayInput[] } | { ok: false; error: string } {
  const value = input as { year?: unknown; masterIds?: unknown; custom?: unknown } | null;
  if (!value || !isValidYear(value.year)) return { ok: false, error: "Pick a calendar year." };
  const year = value.year;
  if (!Array.isArray(value.masterIds) || value.masterIds.length > 500 || !value.masterIds.every(isHolidayId)) {
    return { ok: false, error: "The holiday selection couldn't be read. Reload the page and try again." };
  }
  if (!Array.isArray(value.custom) || value.custom.length > 200) return { ok: false, error: "Too many custom holidays." };
  const custom: CustomHolidayInput[] = [];
  const taken = new Set<string>();
  for (const raw of value.custom as unknown[]) {
    const c = raw as Partial<CustomHolidayInput> | null;
    const item: CustomHolidayInput = {
      ...(isHolidayId(c?.id) ? { id: c!.id } : {}),
      name: typeof c?.name === "string" ? c.name.trim().replace(/\s+/g, " ") : "",
      date: typeof c?.date === "string" ? c.date : "",
      type: isHolidayType(c?.type) ? c.type : ("" as HolidayType),
    };
    const error = customHolidayError(item, year, taken);
    if (error) return { ok: false, error };
    taken.add(holidayKey(item.name, item.date));
    custom.push(item);
  }
  return { ok: true, year, masterIds: [...new Set(value.masterIds as string[])], custom };
}
