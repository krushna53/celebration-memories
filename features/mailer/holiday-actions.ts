"use server";

import { getCurrentAdmin } from "@/services/admin-auth";
import {
  cleanSaveInput,
  isCountryCode,
  isHolidayId,
  isHolidayType,
  isIsoDate,
  isStateCode,
  isValidYear,
  type CompanyHoliday,
} from "@/lib/holidays";
import { fetchHolidaysWithAi, HolidayAiError, type AiHolidayResult } from "@/lib/holidays-ai";
import {
  addMasterHolidays,
  removeMasterHolidays,
  AI_DAILY_LIMIT,
  cachedAiHolidays,
  consumeAiSearch,
  HolidayInputError,
  HolidaySetupError,
  loadHolidayCalendar,
  saveHolidayCalendar,
  storeAiHolidays,
  type HolidayCalendar,
} from "@/services/company-holidays";

export type HolidayResult<T> = { success: true; data: T } | { success: false; error: string; setupPending?: boolean };

/**
 * Event Mailer → Holiday Calendar. The company is the signed-in owner/client
 * admin (admins.id), never an id from the browser. The data lives in
 * Firestore under that company (services/company-holidays.ts).
 */
async function company(): Promise<{ id: string; isOwner: boolean } | null> {
  const admin = await getCurrentAdmin();
  if (!admin || (admin.role !== "client" && admin.role !== "owner")) return null;
  return { id: admin.id, isOwner: admin.role === "owner" };
}

async function companyId(): Promise<string | null> {
  return (await company())?.id ?? null;
}

function failure(err: unknown): { success: false; error: string; setupPending?: boolean } {
  if (err instanceof HolidaySetupError) return { success: false, error: err.message, setupPending: true };
  if (err instanceof HolidayInputError || err instanceof HolidayAiError) return { success: false, error: err.message };
  return { success: false, error: err instanceof Error ? err.message : "Something went wrong. Please try again." };
}

export async function loadHolidayCalendarAction(input: { year: number; countryCode: string; stateCode: string | null }): Promise<HolidayResult<HolidayCalendar>> {
  const who = await company();
  if (!who) return { success: false, error: "Sign in with your company's admin account to manage the holiday calendar." };
  const id = who.id;
  const year = isValidYear(input?.year) ? input.year : new Date().getFullYear();
  const country = isCountryCode(input?.countryCode) ? input.countryCode : "IN";
  const state = isStateCode(input?.stateCode) ? input.stateCode : null;
  try {
    return { success: true, data: { ...(await loadHolidayCalendar(id, year, country, state)), canManageList: who.isOwner } };
  } catch (err) {
    return failure(err);
  }
}

export async function saveHolidayCalendarAction(input: { year: number; masterIds: string[]; custom: unknown[] }): Promise<HolidayResult<CompanyHoliday[]>> {
  const id = await companyId();
  if (!id) return { success: false, error: "Sign in with your company's admin account to manage the holiday calendar." };
  const clean = cleanSaveInput(input);
  if (!clean.ok) return { success: false, error: clean.error };
  try {
    return { success: true, data: await saveHolidayCalendar(id, clean.year, clean.masterIds, clean.custom) };
  } catch (err) {
    return failure(err);
  }
}

export interface AiHolidaySearch {
  result: AiHolidayResult;
  /** When the search ran (a recent search for the same year/state is reused). */
  fetchedAt: string;
  cached: boolean;
  /** Platform owner: suggestions are added to the list for every company. Others add them to their own calendar. */
  canPublish: boolean;
}

/**
 * "Fetch with AI": searches the web for the official holiday list of the
 * year (lib/holidays-ai.ts). A search from the last 24 hours for the same
 * country/year/state is reused; new searches count towards the company's
 * daily limit (the platform owner has none).
 */
export async function fetchHolidaysWithAiAction(input: { year: number; countryCode: string; stateCode: string | null; refresh?: boolean }): Promise<HolidayResult<AiHolidaySearch>> {
  const who = await company();
  if (!who) return { success: false, error: "Sign in with your company's admin account to manage the holiday calendar." };
  if (!isValidYear(input?.year)) return { success: false, error: "Pick a calendar year." };
  const year = input.year;
  const country = isCountryCode(input?.countryCode) ? input.countryCode : "IN";
  const state = isStateCode(input?.stateCode) ? input.stateCode : null;
  try {
    if (!input.refresh) {
      const cached = await cachedAiHolidays(country, year, state);
      if (cached) return { success: true, data: { ...cached, cached: true, canPublish: who.isOwner } };
    }
    if (!who.isOwner && !(await consumeAiSearch(who.id))) {
      return { success: false, error: `You've used today's ${AI_DAILY_LIMIT} AI searches. Try again tomorrow.` };
    }
    const result = await fetchHolidaysWithAi(year, country, state);
    const fetchedAt = await storeAiHolidays(country, year, state, result);
    return { success: true, data: { result, fetchedAt, cached: false, canPublish: who.isOwner } };
  } catch (err) {
    return failure(err);
  }
}

/** Platform owner: adds reviewed AI suggestions to the predefined holiday list for every company. */
export async function publishAiHolidaysAction(input: { countryCode: string; holidays: unknown[] }): Promise<HolidayResult<{ added: number }>> {
  const who = await company();
  if (!who?.isOwner) return { success: false, error: "Only the platform owner can add holidays to the list for everyone." };
  const country = isCountryCode(input?.countryCode) ? input.countryCode : "IN";
  if (!Array.isArray(input?.holidays) || input.holidays.length === 0 || input.holidays.length > 150) {
    return { success: false, error: "Pick the holidays to add." };
  }
  const rows = [];
  for (const raw of input.holidays) {
    const h = raw as { name?: unknown; date?: unknown; type?: unknown; stateCode?: unknown } | null;
    const name = typeof h?.name === "string" ? h.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 120 || !isIsoDate(h?.date) || !isValidYear(Number(h.date.slice(0, 4))) || !isHolidayType(h?.type)) {
      return { success: false, error: "Some suggestions couldn't be read. Search again and retry." };
    }
    const stateCode = isStateCode(h.stateCode) ? h.stateCode : null;
    if ((h.type === "regional") !== (stateCode !== null)) return { success: false, error: "Regional holidays need a state; others mustn't have one." };
    rows.push({ name, date: h.date, type: h.type, stateCode });
  }
  try {
    return { success: true, data: { added: await addMasterHolidays(country, rows) } };
  } catch (err) {
    return failure(err);
  }
}

/** Platform owner: removes holidays that were added with AI from the list for every company. */
export async function removeListHolidaysAction(input: { ids: unknown[] }): Promise<HolidayResult<{ removed: number }>> {
  const who = await company();
  if (!who?.isOwner) return { success: false, error: "Only the platform owner can remove holidays from the list." };
  const ids = Array.isArray(input?.ids) ? input.ids.filter(isHolidayId) : [];
  if (ids.length === 0 || ids.length > 500) return { success: false, error: "Pick the holidays to remove." };
  try {
    return { success: true, data: { removed: await removeMasterHolidays(ids) } };
  } catch (err) {
    return failure(err);
  }
}
