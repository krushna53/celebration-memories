import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { DocumentData, Firestore } from "firebase-admin/firestore";

import { mailerFirestore, MailerFirestoreSetupError, mailerTenantDoc } from "@/services/mailer-firestore";
import { HOLIDAY_SEED, HOLIDAY_SEED_VERSION } from "@/services/holiday-seed";
import type { AiHoliday, AiHolidayResult } from "@/lib/holidays-ai";
import {
  formatHolidayDate,
  holidayKey,
  isHolidayType,
  type CompanyHoliday,
  type CustomHolidayInput,
  type HolidayType,
  type MasterHoliday,
} from "@/lib/holidays";

/**
 * Company Holiday Calendar data, in Firestore (the same project as the Event
 * Mailer's live data, services/mailer-firestore.ts):
 *
 *   holidayMaster/{id}                                 predefined holidays (country / state / year)
 *   holidayMeta/catalog                                seed version + the years, countries and states on offer
 *   mailerTenants/{companyId}/companyHolidays/{id}     the company's calendar, one doc per holiday
 *
 * The company is the signed-in owner/client admin (admins.id), resolved on
 * the server (features/mailer/holiday-actions.ts) — never an id from the
 * browser. Only the server's Admin SDK reaches these documents; the
 * project's security rules deny every browser read and write.
 *
 * holidayMaster is filled from services/holiday-seed.ts the first time the
 * page opens (and again when HOLIDAY_SEED_VERSION goes up). Each company
 * holiday doc is "m_<holidayMasterId>" for a predefined holiday and
 * "c_<uuid>" for a custom one, and a save rewrites one year inside a
 * transaction, so a holiday can't be stored twice.
 */

export class HolidaySetupError extends Error {}
export class HolidayInputError extends Error {}

const MASTER = "holidayMaster";
const COUNTRY = "IN";

interface MasterDoc {
  holidayName: string;
  holidayDate: string;
  countryCode: string;
  stateCode: string | null;
  holidayType: HolidayType;
  calendarYear: number;
}

interface CompanyDoc {
  companyId: string;
  holidayMasterId: string | null;
  holidayName: string;
  holidayDate: string;
  holidayType: HolidayType;
  calendarYear: number;
  isOptional: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Catalog {
  version: number;
  years: number[];
  countries: string[];
  states: Record<string, string[]>;
}

function db(): Firestore {
  try {
    return mailerFirestore();
  } catch (err) {
    if (err instanceof MailerFirestoreSetupError) {
      throw new HolidaySetupError("Firebase isn't set up on the server — add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.");
    }
    throw err;
  }
}

function holidaysOf(companyId: string) {
  return mailerTenantDoc(companyId).collection("companyHolidays");
}

/** Stable id for a predefined holiday, so re-seeding updates instead of duplicating. */
export function masterHolidayId(country: string, state: string | null, date: string, name: string): string {
  return createHash("sha256").update(`${country}|${state ?? ""}|${date}|${name.trim().toLowerCase()}`).digest("hex").slice(0, 24);
}

const type = (t: unknown): HolidayType => (isHolidayType(t) ? t : "regional");

/** Ids of the official holidays shipped in services/holiday-seed.ts — everything else in holidayMaster was added later. */
let seedIds: Set<string> | null = null;
function isSeedHoliday(id: string): boolean {
  seedIds ??= new Set(HOLIDAY_SEED.map(([name, date, state]) => masterHolidayId(COUNTRY, state, date, name)));
  return seedIds.has(id);
}

function toMaster(id: string, d: DocumentData): MasterHoliday {
  return {
    addedByAi: !isSeedHoliday(id),
    id,
    name: String(d.holidayName),
    date: String(d.holidayDate),
    type: type(d.holidayType),
    countryCode: String(d.countryCode),
    stateCode: typeof d.stateCode === "string" ? d.stateCode : null,
    year: Number(d.calendarYear),
  };
}

function toCompany(id: string, d: DocumentData): CompanyHoliday {
  return {
    id,
    masterId: typeof d.holidayMasterId === "string" ? d.holidayMasterId : null,
    name: String(d.holidayName),
    date: String(d.holidayDate),
    type: type(d.holidayType),
    year: Number(d.calendarYear),
    isOptional: Boolean(d.isOptional),
    isActive: d.isActive !== false,
  };
}

const byDate = <T extends { date: string; name: string }>(a: T, b: T) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name);

/** Loads the predefined holidays into Firestore when they're missing or out of date. */
async function ensureSeeded(firestore: Firestore): Promise<Catalog> {
  const metaRef = firestore.collection("holidayMeta").doc("catalog");
  const meta = await metaRef.get();
  if (meta.exists && Number(meta.get("version")) >= HOLIDAY_SEED_VERSION) return meta.data() as Catalog;

  const states = new Set<string>();
  const years = new Set<number>();
  const rows = HOLIDAY_SEED.map(([name, date, state, holidayType]) => {
    if (state) states.add(state);
    years.add(Number(date.slice(0, 4)));
    const doc: MasterDoc = { holidayName: name, holidayDate: date, countryCode: COUNTRY, stateCode: state, holidayType, calendarYear: Number(date.slice(0, 4)) };
    return { id: masterHolidayId(COUNTRY, state, date, name), doc };
  });
  // Firestore batches hold up to 500 writes.
  for (let i = 0; i < rows.length; i += 400) {
    const batch = firestore.batch();
    for (const row of rows.slice(i, i + 400)) batch.set(firestore.collection(MASTER).doc(row.id), row.doc);
    await batch.commit();
  }
  // Keep years/states added later (e.g. from Fetch with AI).
  const old = (meta.exists ? meta.data() : null) as Catalog | null;
  const catalog: Catalog = {
    version: HOLIDAY_SEED_VERSION,
    years: [...new Set([...(old?.years ?? []), ...years])].sort((a, b) => a - b),
    countries: [...new Set([...(old?.countries ?? []), COUNTRY])].sort(),
    states: { ...(old?.states ?? {}), [COUNTRY]: [...new Set([...(old?.states?.[COUNTRY] ?? []), ...states])].sort() },
  };
  await metaRef.set(catalog);
  return catalog;
}

// ---------------------------------------------------------------------------
// Fetch with AI (lib/holidays-ai.ts): cache, daily limit, adding to the list
// ---------------------------------------------------------------------------

/** How long one AI search for a country/year/state is reused before searching again. */
const AI_CACHE_MS = 24 * 60 * 60 * 1000;
/** AI searches per company per day (the platform owner has no limit). */
export const AI_DAILY_LIMIT = 10;

function aiCacheRef(firestore: Firestore, country: string, year: number, state: string | null) {
  return firestore.collection("holidayAiCache").doc(`${country}_${year}_${state ?? "ALL"}`);
}

export async function cachedAiHolidays(country: string, year: number, state: string | null): Promise<{ result: AiHolidayResult; fetchedAt: string } | null> {
  try {
    const snap = await aiCacheRef(db(), country, year, state).get();
    if (!snap.exists) return null;
    const fetchedAt = String(snap.get("fetchedAt") ?? "");
    if (!fetchedAt || Date.now() - Date.parse(fetchedAt) > AI_CACHE_MS) return null;
    return { result: snap.get("result") as AiHolidayResult, fetchedAt };
  } catch (err) {
    wrap(err, "read the AI holiday search");
  }
}

export async function storeAiHolidays(country: string, year: number, state: string | null, result: AiHolidayResult): Promise<string> {
  const fetchedAt = new Date().toISOString();
  try {
    await aiCacheRef(db(), country, year, state).set({ fetchedAt, result });
  } catch (err) {
    console.error("[holidays] couldn't cache the AI search", err);
  }
  return fetchedAt;
}

/** Counts one AI search for the company today; false when today's limit is used up. */
export async function consumeAiSearch(companyId: string): Promise<boolean> {
  try {
    const firestore = db();
    const ref = mailerTenantDoc(companyId).collection("usage").doc("holidayAi");
    const today = new Date().toISOString().slice(0, 10);
    return await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = snap.exists && snap.get("day") === today ? Number(snap.get("count")) || 0 : 0;
      if (count >= AI_DAILY_LIMIT) return false;
      tx.set(ref, { day: today, count: count + 1 });
      return true;
    });
  } catch (err) {
    wrap(err, "check the AI search limit");
  }
}

/**
 * Adds reviewed AI holidays to the predefined list (holidayMaster) for every
 * company. Platform owner only — checked by the caller. Same name + date +
 * state as an existing holiday updates it instead of adding a copy.
 */
export async function addMasterHolidays(country: string, holidays: Pick<AiHoliday, "name" | "date" | "type" | "stateCode">[]): Promise<number> {
  try {
    const firestore = db();
    const catalog = await ensureSeeded(firestore);
    const years = new Set(catalog.years ?? []);
    const states = new Set(catalog.states?.[country] ?? []);
    const batch = firestore.batch();
    for (const h of holidays) {
      const year = Number(h.date.slice(0, 4));
      years.add(year);
      if (h.stateCode) states.add(h.stateCode);
      const doc: MasterDoc & { source: string; addedAt: string } = {
        holidayName: h.name,
        holidayDate: h.date,
        countryCode: country,
        stateCode: h.stateCode,
        holidayType: h.type,
        calendarYear: year,
        source: "ai",
        addedAt: new Date().toISOString(),
      };
      batch.set(firestore.collection(MASTER).doc(masterHolidayId(country, h.stateCode, h.date, h.name)), doc);
    }
    batch.set(firestore.collection("holidayMeta").doc("catalog"), {
      ...catalog,
      years: [...years].sort((a, b) => a - b),
      countries: [...new Set([...(catalog.countries ?? []), country])].sort(),
      states: { ...(catalog.states ?? {}), [country]: [...states].sort() },
    });
    await batch.commit();
    return holidays.length;
  } catch (err) {
    wrap(err, "add the holidays");
  }
}

/** Firestore not enabled / unreachable, or credentials refused: a setup problem, not the user's. */
function wrap(err: unknown, what: string): never {
  if (err instanceof HolidaySetupError || err instanceof HolidayInputError) throw err;
  const code = (err as { code?: unknown })?.code;
  if (code === 5 || code === 7 || code === 16 || /NOT_FOUND|PERMISSION_DENIED|UNAUTHENTICATED/.test(String((err as Error)?.message))) {
    console.error(`[holidays] ${what}: Firestore setup`, err);
    throw new HolidaySetupError("Couldn't reach Firestore — check that Firestore is enabled in the Firebase project and the FIREBASE_* settings are correct.");
  }
  console.error(`[holidays] ${what} failed`, err);
  throw new Error(`Couldn't ${what}. Please try again.`);
}

/**
 * Removes holidays that were added to the list later (Fetch with AI).
 * Platform owner only — checked by the caller. The official holidays from
 * services/holiday-seed.ts can't be removed this way (they'd come back on
 * the next seed). Companies that had ticked a removed holiday keep their
 * saved copy until they next save their calendar.
 */
export async function removeMasterHolidays(ids: string[]): Promise<number> {
  try {
    const firestore = db();
    const removable = [...new Set(ids)].filter((id) => !isSeedHoliday(id));
    for (let i = 0; i < removable.length; i += 400) {
      const batch = firestore.batch();
      for (const id of removable.slice(i, i + 400)) batch.delete(firestore.collection(MASTER).doc(id));
      await batch.commit();
    }
    return removable.length;
  } catch (err) {
    wrap(err, "remove the holidays");
  }
}

export interface HolidayCalendar {
  year: number;
  countryCode: string;
  stateCode: string | null;
  /** Predefined holidays for the country (whole-country ones + the chosen state's). */
  master: MasterHoliday[];
  /** The company's saved calendar for the year (every state, plus custom holidays). */
  saved: CompanyHoliday[];
  /** Years with predefined holidays or a saved calendar. */
  years: number[];
  countries: string[];
  /** States with regional holidays in this country. */
  states: string[];
  /** Platform owner: may remove holidays that were added with AI. Set by the action. */
  canManageList?: boolean;
}

export async function loadHolidayCalendar(companyId: string, year: number, countryCode: string, stateCode: string | null): Promise<HolidayCalendar> {
  try {
    const firestore = db();
    const catalog = await ensureSeeded(firestore);
    const [master, saved, savedYears] = await Promise.all([
      firestore.collection(MASTER).where("countryCode", "==", countryCode).where("calendarYear", "==", year).get(),
      holidaysOf(companyId).where("calendarYear", "==", year).get(),
      holidaysOf(companyId).select("calendarYear").get(),
    ]);
    const years = new Set<number>([...(catalog.years ?? []), ...savedYears.docs.map((d) => Number(d.get("calendarYear")))]);
    return {
      year,
      countryCode,
      stateCode,
      master: master.docs
        .map((d) => toMaster(d.id, d.data()))
        .filter((h) => h.stateCode === null || h.stateCode === stateCode)
        .sort(byDate),
      saved: saved.docs.map((d) => toCompany(d.id, d.data())).sort(byDate),
      years: [...years].filter((y) => Number.isInteger(y)).sort((a, b) => a - b),
      countries: catalog.countries ?? [COUNTRY],
      states: catalog.states?.[countryCode] ?? [],
    };
  } catch (err) {
    wrap(err, "load the holiday calendar");
  }
}

/**
 * Replaces the company's calendar for one year — the ticked predefined
 * holidays plus the custom ones — in one transaction. Other years are never
 * touched. The same holiday (same name, same date) is never stored twice: a
 * second predefined copy is skipped, a custom copy is refused.
 */
export async function saveHolidayCalendar(companyId: string, year: number, masterIds: string[], custom: CustomHolidayInput[]): Promise<CompanyHoliday[]> {
  try {
    const firestore = db();
    await ensureSeeded(firestore);
    const col = holidaysOf(companyId);

    return await firestore.runTransaction(async (tx) => {
      // Reads first (Firestore transactions need every read before any write).
      const masterSnaps = masterIds.length ? await tx.getAll(...masterIds.map((id) => firestore.collection(MASTER).doc(id))) : [];
      const existingSnap = await tx.get(col.where("calendarYear", "==", year));
      const existing = new Map(existingSnap.docs.map((d) => [d.id, d.data() as CompanyDoc]));

      const now = new Date().toISOString();
      const taken = new Set<string>();
      const next = new Map<string, CompanyDoc>();

      for (const snap of masterSnaps) {
        // Removed from the list since the page loaded: drop it from the calendar too.
        if (!snap.exists) continue;
        if (Number(snap.get("calendarYear")) !== year) {
          throw new HolidayInputError("Some holidays are no longer available. Reload the page and try again.");
        }
        const m = snap.data() as MasterDoc;
        const key = holidayKey(m.holidayName, m.holidayDate);
        if (taken.has(key)) continue;
        taken.add(key);
        const id = `m_${snap.id}`;
        const prev = existing.get(id);
        next.set(id, {
          companyId,
          holidayMasterId: snap.id,
          holidayName: m.holidayName,
          holidayDate: m.holidayDate,
          holidayType: type(m.holidayType),
          calendarYear: year,
          isOptional: m.holidayType === "optional",
          isActive: true,
          createdAt: prev?.createdAt ?? now,
          updatedAt: prev ? prev.updatedAt : now,
        });
      }

      for (const c of custom) {
        const key = holidayKey(c.name, c.date);
        if (taken.has(key)) throw new HolidayInputError(`"${c.name}" is already in the calendar on ${formatHolidayDate(c.date)}.`);
        taken.add(key);
        // Keep the id only for a custom holiday this company already has in this year.
        const prev = c.id ? existing.get(c.id) : undefined;
        const id = prev && prev.holidayMasterId === null && c.id && !next.has(c.id) ? c.id : `c_${randomUUID()}`;
        const changed = !prev || prev.holidayName !== c.name || prev.holidayDate !== c.date || prev.holidayType !== c.type;
        next.set(id, {
          companyId,
          holidayMasterId: null,
          holidayName: c.name,
          holidayDate: c.date,
          holidayType: c.type,
          calendarYear: year,
          isOptional: c.type === "optional",
          isActive: true,
          createdAt: prev?.createdAt ?? now,
          updatedAt: prev && !changed ? prev.updatedAt : now,
        });
      }

      for (const id of existing.keys()) if (!next.has(id)) tx.delete(col.doc(id));
      for (const [id, doc] of next) tx.set(col.doc(id), doc);

      return [...next].map(([id, doc]) => toCompany(id, doc)).sort(byDate);
    });
  } catch (err) {
    wrap(err, "save the holiday calendar");
  }
}
