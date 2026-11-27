"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, CalendarDays, CheckCircle2, ChevronDown, ExternalLink, Loader2, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2, X } from "lucide-react";

import {
  COUNTRY_NAMES,
  HOLIDAY_GROUPS,
  STATE_NAMES,
  customHolidayError,
  formatHolidayDate,
  holidayKey,
  holidayTypeLabel,
  type CompanyHoliday,
  type HolidayType,
  type MasterHoliday,
} from "@/lib/holidays";
import {
  fetchHolidaysWithAiAction,
  loadHolidayCalendarAction,
  publishAiHolidaysAction,
  removeListHolidaysAction,
  saveHolidayCalendarAction,
  type AiHolidaySearch,
} from "@/features/mailer/holiday-actions";
import type { AiHoliday } from "@/lib/holidays-ai";
import type { HolidayCalendar } from "@/services/company-holidays";
import { Card, ErrorText, Field, inputClasses, Modal, primaryButton, SearchInput, secondaryButton } from "@/features/mailer/components/ui";
import { cn } from "@/lib/utils";

/**
 * Event Mailer → Holiday Calendar: the company ticks predefined holidays
 * (Firestore holidayMaster, by country / state / year) and adds its own, then
 * saves the year's calendar (services/company-holidays.ts). Unsaved changes are kept per year
 * while switching years; saving one year never touches another.
 */

interface CustomRow {
  /** Stable React key; the saved row's id when it has one. */
  key: string;
  id?: string;
  name: string;
  date: string;
  type: HolidayType;
}

interface Draft {
  masterIds: Set<string>;
  custom: CustomRow[];
}

interface CustomForm {
  key?: string;
  name: string;
  date: string;
  type: HolidayType;
}

const PLACE_KEY = "em-holiday-place";

function draftFrom(saved: CompanyHoliday[]): Draft {
  return {
    masterIds: new Set(saved.filter((h) => h.masterId).map((h) => h.masterId!)),
    custom: saved.filter((h) => !h.masterId).map((h) => ({ key: h.id, id: h.id, name: h.name, date: h.date, type: h.type })),
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  if (a.masterIds.size !== b.masterIds.size || [...a.masterIds].some((id) => !b.masterIds.has(id))) return false;
  if (a.custom.length !== b.custom.length) return false;
  const sig = (c: CustomRow) => `${c.id ?? "new"}|${holidayKey(c.name, c.date)}|${c.type}`;
  const bs = new Set(b.custom.map(sig));
  return a.custom.every((c) => bs.has(sig(c)));
}

let newKey = 0;

export function HolidayCalendarView() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [country, setCountry] = useState("IN");
  const [state, setState] = useState("");
  const [calendar, setCalendar] = useState<HolidayCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ text: string; setup?: boolean } | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saved, setSaved] = useState<Record<number, CompanyHoliday[]>>({});
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Partial<Record<HolidayType | "custom", boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState<CustomForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const request = useRef(0);
  // Fetch with AI: the search result and which suggestions are ticked (by index).
  const [ai, setAi] = useState<{ search: AiHolidaySearch; picked: Set<number> } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [listBusy, setListBusy] = useState(false);

  // Remember the company's country/state choice in this browser.
  useEffect(() => {
    try {
      const place = JSON.parse(localStorage.getItem(PLACE_KEY) ?? "null") as { country?: string; state?: string } | null;
      if (place?.country) setCountry(place.country);
      if (typeof place?.state === "string") setState(place.state);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    const result = await loadHolidayCalendarAction({ year, countryCode: country, stateCode: state || null }).catch(() => ({
      success: false as const,
      error: "Couldn't reach the server. Please try again.",
      setupPending: false,
    }));
    if (id !== request.current) return;
    setLoading(false);
    if (!result.success) {
      setLoadError({ text: result.error, setup: result.setupPending });
      return;
    }
    setLoadError(null);
    setCalendar(result.data);
    setSaved((s) => ({ ...s, [year]: result.data.saved }));
    // Keep unsaved changes for this year if there are any.
    setDrafts((d) => (d[year] ? d : { ...d, [year]: draftFrom(result.data.saved) }));
  }, [year, country, state]);

  useEffect(() => {
    void load();
  }, [load]);

  // AI suggestions belong to one year/state; drop them when that changes.
  useEffect(() => {
    setAi(null);
    setAiError(null);
  }, [year, country, state]);

  const draft = drafts[year] ?? null;
  const savedRows = useMemo(() => saved[year] ?? [], [saved, year]);
  const dirtyYears = useMemo(
    () => Object.entries(drafts).filter(([y, d]) => saved[Number(y)] && !sameDraft(d, draftFrom(saved[Number(y)]!))).map(([y]) => Number(y)),
    [drafts, saved],
  );
  const dirty = dirtyYears.includes(year);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (dirtyYears.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyYears.length]);

  /** Every predefined holiday we know about for this year: the loaded list plus saved ones from other states. */
  const known = useMemo(() => {
    const map = new Map<string, { name: string; date: string; type: HolidayType; stateCode: string | null }>();
    for (const h of savedRows) if (h.masterId) map.set(h.masterId, { name: h.name, date: h.date, type: h.type, stateCode: null });
    for (const m of calendar?.year === year ? calendar.master : []) map.set(m.id, { name: m.name, date: m.date, type: m.type, stateCode: m.stateCode });
    return map;
  }, [calendar, savedRows, year]);

  const master = useMemo(() => (calendar && calendar.year === year ? calendar.master : []), [calendar, year]);
  const query = search.trim().toLowerCase();
  const matches = useCallback(
    (h: { name: string; date: string; type: HolidayType }) =>
      !query || h.name.toLowerCase().includes(query) || formatHolidayDate(h.date).toLowerCase().includes(query) || holidayTypeLabel(h.type).toLowerCase().includes(query),
    [query],
  );
  const visible = useMemo(() => master.filter(matches), [master, matches]);
  // Platform owner: holidays added with AI can be taken off the list again.
  const canManageList = Boolean(calendar?.canManageList);
  const aiAdded = useMemo(() => master.filter((h) => h.addedByAi), [master]);

  /** Everything selected for the year, by date. */
  const selected = useMemo(() => {
    if (!draft) return [];
    const rows: { key: string; name: string; date: string; type: HolidayType; masterId?: string; custom?: CustomRow }[] = [];
    for (const id of draft.masterIds) {
      const h = known.get(id);
      if (h) rows.push({ key: id, name: h.name, date: h.date, type: h.type, masterId: id });
    }
    for (const c of draft.custom) rows.push({ key: c.key, name: c.name, date: c.date, type: c.type, custom: c });
    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  }, [draft, known]);

  function update(change: (d: Draft) => Draft) {
    setNotice(null);
    setDrafts((all) => {
      const current = all[year];
      return current ? { ...all, [year]: change(current) } : all;
    });
  }

  /** holidayKey()s of the selected holidays, optionally leaving one out. */
  function takenKeys(except?: string): Set<string> {
    return new Set(selected.filter((s) => s.key !== except).map((s) => holidayKey(s.name, s.date)));
  }

  function toggle(h: MasterHoliday) {
    if (!draft) return;
    if (draft.masterIds.has(h.id)) {
      update((d) => {
        const ids = new Set(d.masterIds);
        ids.delete(h.id);
        return { ...d, masterIds: ids };
      });
      return;
    }
    if (takenKeys().has(holidayKey(h.name, h.date))) {
      setNotice({ ok: false, text: `"${h.name}" on ${formatHolidayDate(h.date)} is already in the calendar.` });
      return;
    }
    update((d) => ({ ...d, masterIds: new Set(d.masterIds).add(h.id) }));
  }

  function selectMany(list: MasterHoliday[]) {
    if (!draft) return;
    const taken = takenKeys();
    const ids = new Set(draft.masterIds);
    for (const h of list) {
      const key = holidayKey(h.name, h.date);
      if (ids.has(h.id) || taken.has(key)) continue;
      ids.add(h.id);
      taken.add(key);
    }
    update((d) => ({ ...d, masterIds: ids }));
  }

  function clearMany(list: MasterHoliday[]) {
    update((d) => {
      const ids = new Set(d.masterIds);
      for (const h of list) ids.delete(h.id);
      return { ...d, masterIds: ids };
    });
  }

  function clearSelection() {
    if (!draft || draft.masterIds.size === 0) return;
    if (!confirm(`Untick all ${draft.masterIds.size} predefined holidays for ${year}? Custom holidays stay.`)) return;
    update((d) => ({ ...d, masterIds: new Set() }));
  }

  function removeSelected(row: (typeof selected)[number]) {
    if (row.masterId) {
      update((d) => {
        const ids = new Set(d.masterIds);
        ids.delete(row.masterId!);
        return { ...d, masterIds: ids };
      });
    } else if (row.custom) {
      deleteCustom(row.custom);
    }
  }

  function deleteCustom(c: CustomRow) {
    if (!confirm(`Delete the custom holiday "${c.name}"?`)) return;
    update((d) => ({ ...d, custom: d.custom.filter((x) => x.key !== c.key) }));
  }

  function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const item = { name: form.name.trim().replace(/\s+/g, " "), date: form.date, type: form.type };
    const error = customHolidayError(item, year, takenKeys(form.key));
    if (error) {
      setFormError(error);
      return;
    }
    update((d) =>
      form.key
        ? { ...d, custom: d.custom.map((c) => (c.key === form.key ? { ...c, ...item } : c)) }
        : { ...d, custom: [...d.custom, { key: `new-${++newKey}`, ...item }] },
    );
    setForm(null);
    setFormError(null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setNotice(null);
    const result = await saveHolidayCalendarAction({
      year,
      masterIds: [...draft.masterIds],
      custom: draft.custom.map((c) => ({ ...(c.id ? { id: c.id } : {}), name: c.name, date: c.date, type: c.type })),
    }).catch(() => ({ success: false as const, error: "Couldn't reach the server. Please try again." }));
    setSaving(false);
    if (!result.success) {
      setNotice({ ok: false, text: result.error });
      return;
    }
    setSaved((s) => ({ ...s, [year]: result.data }));
    setDrafts((d) => ({ ...d, [year]: draftFrom(result.data) }));
    setNotice({ ok: true, text: `Holiday calendar for ${year} saved — ${result.data.length} holiday${result.data.length === 1 ? "" : "s"}.` });
  }

  /** The predefined holiday already in the list that matches an AI suggestion, if any. */
  function listedMatch(h: AiHoliday): MasterHoliday | undefined {
    const key = holidayKey(h.name, h.date);
    return master.find((m) => m.stateCode === h.stateCode && holidayKey(m.name, m.date) === key);
  }

  async function fetchAi(refresh = false) {
    setAiBusy(true);
    setAiError(null);
    setNotice(null);
    const result = await fetchHolidaysWithAiAction({ year, countryCode: country, stateCode: state || null, refresh }).catch(() => ({
      success: false as const,
      error: "Couldn't reach the server. Please try again.",
    }));
    setAiBusy(false);
    if (!result.success) {
      setAiError(result.error);
      return;
    }
    // Tick every suggestion that isn't already in the list.
    const picked = new Set<number>();
    result.data.result.holidays.forEach((h, i) => {
      if (!listedMatch(h)) picked.add(i);
    });
    setAi({ search: result.data, picked });
  }

  function togglePick(i: number) {
    setAi((a) => {
      if (!a) return a;
      const picked = new Set(a.picked);
      if (picked.has(i)) picked.delete(i);
      else picked.add(i);
      return { ...a, picked };
    });
  }

  /** Owner: add the ticked suggestions to the list for every company, then reload. */
  async function publishAi() {
    if (!ai) return;
    const holidays = ai.search.result.holidays.filter((_, i) => ai.picked.has(i));
    if (holidays.length === 0) return;
    if (!confirm(`Add ${holidays.length} holiday${holidays.length === 1 ? "" : "s"} to the ${year} list for every company? Check the dates against the sources first.`)) return;
    setAiBusy(true);
    const result = await publishAiHolidaysAction({
      countryCode: country,
      holidays: holidays.map((h) => ({ name: h.name, date: h.date, type: h.type, stateCode: h.stateCode })),
    }).catch(() => ({ success: false as const, error: "Couldn't reach the server. Please try again." }));
    setAiBusy(false);
    if (!result.success) {
      setAiError(result.error);
      return;
    }
    setAi(null);
    setNotice({ ok: true, text: `Added ${result.data.added} holiday${result.data.added === 1 ? "" : "s"} to the ${year} list. Tick the ones your company observes and save.` });
    await load();
  }

  /** Company admin: add the ticked suggestions to this company's calendar (ticks listed ones, the rest as custom holidays). */
  function addAiToCalendar() {
    if (!ai || !draft) return;
    const taken = takenKeys();
    const ids = new Set(draft.masterIds);
    const custom = [...draft.custom];
    let added = 0;
    let skipped = 0;
    ai.search.result.holidays.forEach((h, i) => {
      if (!ai.picked.has(i)) return;
      const key = holidayKey(h.name, h.date);
      if (taken.has(key)) {
        skipped++;
        return;
      }
      taken.add(key);
      const listed = listedMatch(h);
      if (listed) ids.add(listed.id);
      else custom.push({ key: `new-${++newKey}`, name: h.name, date: h.date, type: h.type });
      added++;
    });
    update((d) => ({ ...d, masterIds: ids, custom }));
    setAi(null);
    setNotice({
      ok: true,
      text: `Added ${added} holiday${added === 1 ? "" : "s"} to your ${year} calendar${skipped ? ` (${skipped} already there)` : ""}. Click Save Holiday Calendar to keep them.`,
    });
  }

  /** Owner: take AI-added holidays off the list for every company (and out of this calendar's ticks). */
  async function removeFromList(list: MasterHoliday[]) {
    if (list.length === 0) return;
    const what = list.length === 1 ? `"${list[0]!.name}" (${formatHolidayDate(list[0]!.date)})` : `${list.length} AI-added holidays`;
    if (!confirm(`Remove ${what} from the ${year} list for every company? Companies that ticked ${list.length === 1 ? "it" : "them"} lose ${list.length === 1 ? "it" : "them"} the next time they save.`)) return;
    setListBusy(true);
    setNotice(null);
    const result = await removeListHolidaysAction({ ids: list.map((h) => h.id) }).catch(() => ({
      success: false as const,
      error: "Couldn't reach the server. Please try again.",
    }));
    setListBusy(false);
    if (!result.success) {
      setNotice({ ok: false, text: result.error });
      return;
    }
    const gone = new Set(list.map((h) => h.id));
    update((d) => ({ ...d, masterIds: new Set([...d.masterIds].filter((id) => !gone.has(id))) }));
    setNotice({ ok: true, text: `Removed ${result.data.removed} holiday${result.data.removed === 1 ? "" : "s"} from the list.` });
    await load();
  }

  function changePlace(nextCountry: string, nextState: string) {
    setCountry(nextCountry);
    setState(nextState);
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify({ country: nextCountry, state: nextState }));
    } catch {
      /* ignore */
    }
  }

  const years = useMemo(() => {
    const all = new Set<number>([thisYear, thisYear + 1, year, ...(calendar?.years ?? [])]);
    return [...all].sort((a, b) => a - b);
  }, [calendar, thisYear, year]);

  if (loadError && !calendar) {
    return (
      <Card>
        <p className="font-medium text-navy-950">{loadError.setup ? "Holiday calendar not set up yet" : "Couldn't load the holiday calendar"}</p>
        <p className="mt-1 text-sm text-navy-700/70">{loadError.text}</p>
        <button type="button" onClick={() => void load()} className={cn(secondaryButton, "mt-3")}>
          Try again
        </button>
      </Card>
    );
  }

  const groupRows = (type: HolidayType) => visible.filter((h) => h.type === type);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Calendar year" htmlFor="hol-year">
          <select id="hol-year" className={inputClasses} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
                {dirtyYears.includes(y) ? " • unsaved" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Country" htmlFor="hol-country">
          <select id="hol-country" className={inputClasses} value={country} onChange={(e) => changePlace(e.target.value, "")}>
            {(calendar?.countries.length ? calendar.countries : [country]).map((c) => (
              <option key={c} value={c}>
                {COUNTRY_NAMES[c] ?? c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="State" hint="(for regional holidays)" htmlFor="hol-state">
          <select id="hol-state" className={inputClasses} value={state} onChange={(e) => changePlace(country, e.target.value)}>
            <option value="">— All of {COUNTRY_NAMES[country] ?? country} —</option>
            {(calendar?.states ?? []).map((s) => (
              <option key={s} value={s}>
                {STATE_NAMES[s] ?? s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Search holidays" htmlFor="hol-search">
          <SearchInput value={search} onChange={setSearch} placeholder="Name, date or category" />
        </Field>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => selectMany(visible)} disabled={!draft || visible.length === 0} className={secondaryButton}>
              Select all{query ? " shown" : ""}
            </button>
            <button type="button" onClick={clearSelection} disabled={!draft || draft.masterIds.size === 0} className={secondaryButton}>
              Clear selection
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setForm({ name: "", date: `${year}-01-01`, type: "regional" });
              }}
              disabled={!draft}
              className={secondaryButton}
            >
              <Plus size={15} /> Add custom holiday
            </button>
            <button type="button" onClick={() => void fetchAi()} disabled={!draft || aiBusy} className={cn(secondaryButton, "border-gold-500/40")}>
              {aiBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} className="text-gold-700" />} Fetch with AI
            </button>
            {canManageList && aiAdded.length > 0 ? (
              <button
                type="button"
                onClick={() => void removeFromList(aiAdded)}
                disabled={listBusy}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {listBusy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Remove AI-added ({aiAdded.length})
              </button>
            ) : null}
            {loading ? <Loader2 size={16} className="animate-spin text-navy-700/50" aria-label="Loading" /> : null}
            <span className="ml-auto rounded-full bg-gold-100 px-3 py-1 text-sm font-medium text-navy-950" aria-live="polite">
              {selected.length} selected
            </span>
          </div>

          {loadError ? <ErrorText>{loadError.text}</ErrorText> : null}

          {aiBusy && !ai ? (
            <Card className="flex items-center gap-3 border-gold-500/30 bg-gold-100/40">
              <Loader2 size={18} className="shrink-0 animate-spin text-gold-700" />
              <p className="text-sm text-navy-950">
                Searching the official {year} holiday list{state ? ` and ${STATE_NAMES[state] ?? state} holidays` : ""}… this can take up to a minute.
              </p>
            </Card>
          ) : null}
          {aiError ? <ErrorText>{aiError}</ErrorText> : null}

          {ai ? (
            <Card className="space-y-3 border-gold-500/40">
              <div className="flex flex-wrap items-start gap-2">
                <p className="flex items-center gap-1.5 font-medium text-navy-950">
                  <Sparkles size={16} className="text-gold-700" /> AI suggestions for {year}
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    ai.search.result.status === "official" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800",
                  )}
                >
                  {ai.search.result.status === "official" ? "Official list found" : ai.search.result.status === "partial" ? "Partial list" : "Official list not published yet"}
                </span>
                <button type="button" onClick={() => setAi(null)} aria-label="Close suggestions" className="ml-auto rounded-md p-1 text-navy-700/60 hover:bg-navy-950/5">
                  <X size={15} />
                </button>
              </div>
              {ai.search.result.note ? <p className="text-sm text-navy-700/75">{ai.search.result.note}</p> : null}
              <p className="text-xs text-navy-700/55">
                AI can make mistakes — check each date against its source before adding.{" "}
                {ai.search.cached ? `Searched ${new Date(ai.search.fetchedAt).toLocaleString("en-IN")}.` : null}
              </p>

              {ai.search.result.holidays.length === 0 ? (
                <p className="text-sm text-navy-700/60">No holidays found. Try again later, or add them as custom holidays.</p>
              ) : (
                <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                  {ai.search.result.holidays.map((h, i) => {
                    const on = ai.picked.has(i);
                    const listed = Boolean(listedMatch(h));
                    return (
                      <li key={`${h.date}-${h.name}-${i}`}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2",
                            on ? "border-gold-500 bg-gold-100/50" : "border-navy-950/[0.07]",
                          )}
                        >
                          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-gold-500)]" checked={on} onChange={() => togglePick(i)} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-navy-950">{h.name}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy-700/60">
                              <span>{formatHolidayDate(h.date)}</span>
                              <span className="rounded-full bg-navy-950/[0.05] px-2 py-px">{holidayTypeLabel(h.type)}</span>
                              {h.stateCode ? <span className="rounded-full bg-navy-950/[0.05] px-2 py-px">{STATE_NAMES[h.stateCode] ?? h.stateCode}</span> : null}
                              {h.mayVary ? <span className="rounded-full bg-amber-50 px-2 py-px text-amber-800">may shift with the moon</span> : null}
                              {listed ? <span className="rounded-full bg-emerald-50 px-2 py-px text-emerald-800">already in list</span> : null}
                              {h.sourceUrl ? (
                                <a
                                  href={h.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-gold-700 underline underline-offset-2"
                                  title={h.verified ? "The AI opened this page during its search" : "Not confirmed as a page the search opened — check it"}
                                >
                                  {h.verified ? <BadgeCheck size={12} /> : null}
                                  source <ExternalLink size={11} />
                                </a>
                              ) : (
                                <span className="text-amber-700">no source</span>
                              )}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              {ai.search.result.sources.length > 0 ? (
                <details className="text-xs text-navy-700/60">
                  <summary className="cursor-pointer">Pages the AI searched ({ai.search.result.sources.length})</summary>
                  <ul className="mt-1 space-y-0.5">
                    {ai.search.result.sources.map((src) => (
                      <li key={src.url} className="truncate">
                        <a href={src.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          {src.title || src.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void fetchAi(true)} disabled={aiBusy} className={secondaryButton}>
                  {aiBusy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Search again
                </button>
                <span className="ml-auto text-xs text-navy-700/55">{ai.picked.size} ticked</span>
                {ai.search.canPublish ? (
                  <button type="button" onClick={() => void publishAi()} disabled={aiBusy || ai.picked.size === 0} className={primaryButton}>
                    Add {ai.picked.size} to the {year} list for everyone
                  </button>
                ) : (
                  <button type="button" onClick={addAiToCalendar} disabled={ai.picked.size === 0} className={primaryButton}>
                    Add {ai.picked.size} to my calendar
                  </button>
                )}
              </div>
            </Card>
          ) : null}


          {calendar && calendar.year === year && master.length === 0 ? (
            <Card>
              <p className="text-sm text-navy-700/70">
                No predefined holidays for {COUNTRY_NAMES[country] ?? country} in {year} yet. You can still add custom holidays.
              </p>
            </Card>
          ) : null}

          {HOLIDAY_GROUPS.map((g) => {
            const rows = groupRows(g.type);
            const all = master.filter((h) => h.type === g.type);
            if (g.type !== "regional" && all.length === 0) return null;
            const ticked = rows.filter((h) => draft?.masterIds.has(h.id)).length;
            const open = !collapsed[g.type];
            return (
              <Card key={g.type} className="p-0 sm:p-0">
                <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <input
                    type="checkbox"
                    aria-label={`Select all ${g.label}`}
                    className="h-4 w-4 accent-[var(--color-gold-500)]"
                    checked={rows.length > 0 && ticked === rows.length}
                    ref={(el) => {
                      if (el) el.indeterminate = ticked > 0 && ticked < rows.length;
                    }}
                    disabled={!draft || rows.length === 0}
                    onChange={(e) => (e.target.checked ? selectMany(rows) : clearMany(rows))}
                  />
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [g.type]: open }))}
                    aria-expanded={open}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <span className="font-medium text-navy-950">{g.label}</span>
                    <span className="text-xs text-navy-700/55">
                      {ticked}/{rows.length}
                    </span>
                    <ChevronDown size={16} className={cn("ml-auto text-navy-700/50 transition-transform", open ? "rotate-180" : "")} />
                  </button>
                </div>
                {open ? (
                  <div className="border-t border-navy-950/[0.06] px-2 py-2 sm:px-3">
                    {g.type === "regional" && !state ? (
                      <p className="px-2 py-2 text-sm text-navy-700/60">Choose a state above to see its regional holidays.</p>
                    ) : rows.length === 0 ? (
                      <p className="px-2 py-2 text-sm text-navy-700/60">{query ? "No holidays match your search." : "No holidays in this group."}</p>
                    ) : (
                      <ul className="grid gap-1.5 md:grid-cols-2">
                        {rows.map((h) => {
                          const on = Boolean(draft?.masterIds.has(h.id));
                          return (
                            <li key={h.id} className="relative">
                              {canManageList && h.addedByAi ? (
                                <button
                                  type="button"
                                  onClick={() => void removeFromList([h])}
                                  disabled={listBusy}
                                  aria-label={`Remove ${h.name} from the list`}
                                  title="Remove from the list for every company"
                                  className="absolute right-2 top-2 z-10 rounded-lg p-1.5 text-navy-700/50 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : null}
                              <label
                                className={cn(
                                  "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition",
                                  canManageList && h.addedByAi && "pr-10",
                                  on ? "border-gold-500 bg-gold-100/60" : "border-navy-950/[0.07] hover:border-navy-950/20",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-gold-500)]"
                                  checked={on}
                                  disabled={!draft}
                                  onChange={() => toggle(h)}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className={cn("block text-sm", on ? "font-medium text-navy-950" : "text-navy-950")}>{h.name}</span>
                                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy-700/60">
                                    <span>{formatHolidayDate(h.date)}</span>
                                    <span className="rounded-full bg-navy-950/[0.05] px-2 py-px">{holidayTypeLabel(h.type)}</span>
                                    {h.stateCode ? <span className="rounded-full bg-navy-950/[0.05] px-2 py-px">{STATE_NAMES[h.stateCode] ?? h.stateCode}</span> : null}
                                    {h.addedByAi ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-px text-violet-800" title="Added with Fetch with AI — not from the official list">
                                        <Sparkles size={10} /> AI
                                      </span>
                                    ) : null}
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </Card>
            );
          })}

          {/* Custom holidays */}
          <Card className="p-0 sm:p-0">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, custom: !c.custom }))}
              aria-expanded={!collapsed.custom}
              className="flex w-full items-center gap-2 px-4 py-3 text-left sm:px-5"
            >
              <span className="font-medium text-navy-950">Custom Holidays</span>
              <span className="text-xs text-navy-700/55">{draft?.custom.length ?? 0}</span>
              <ChevronDown size={16} className={cn("ml-auto text-navy-700/50 transition-transform", !collapsed.custom ? "rotate-180" : "")} />
            </button>
            {!collapsed.custom ? (
              <div className="border-t border-navy-950/[0.06] px-2 py-2 sm:px-3">
                {!draft || draft.custom.length === 0 ? (
                  <p className="px-2 py-2 text-sm text-navy-700/60">No custom holidays. Use &ldquo;Add custom holiday&rdquo; for company days off like a foundation day.</p>
                ) : (
                  <ul className="grid gap-1.5 md:grid-cols-2">
                    {draft.custom
                      .filter(matches)
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((c) => (
                        <li key={c.key} className="flex items-start gap-3 rounded-xl border border-gold-500 bg-gold-100/60 px-3 py-2.5">
                          <CalendarDays size={16} className="mt-0.5 shrink-0 text-gold-700" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-navy-950">{c.name}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-navy-700/60">
                              <span>{formatHolidayDate(c.date)}</span>
                              <span className="rounded-full bg-white/70 px-2 py-px">{holidayTypeLabel(c.type)}</span>
                              {!c.id ? <span className="text-amber-700">not saved yet</span> : null}
                            </span>
                          </span>
                          <button
                            type="button"
                            aria-label={`Edit ${c.name}`}
                            onClick={() => {
                              setFormError(null);
                              setForm({ key: c.key, name: c.name, date: c.date, type: c.type });
                            }}
                            className="rounded-lg p-1.5 text-navy-700/60 hover:bg-white hover:text-navy-950"
                          >
                            <Pencil size={14} />
                          </button>
                          <button type="button" aria-label={`Delete ${c.name}`} onClick={() => deleteCustom(c)} className="rounded-lg p-1.5 text-navy-700/60 hover:bg-red-50 hover:text-red-700">
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            ) : null}
          </Card>
        </div>

        {/* Selected holidays + Save */}
        <Card className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-navy-950">Your {year} holidays</p>
            <span className="rounded-full bg-navy-950 px-2.5 py-0.5 text-xs font-semibold text-white">{selected.length}</span>
          </div>
          {selected.length === 0 ? (
            <p className="text-sm text-navy-700/60">Tick holidays on the left to add them to your company calendar.</p>
          ) : (
            <ul className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
              {selected.map((s) => (
                <li key={s.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-navy-950/[0.03]">
                  <span className="w-[74px] shrink-0 text-xs tabular-nums text-navy-700/60">{formatHolidayDate(s.date).replace(/^\w+, /, "").replace(/ \d{4}$/, "")}</span>
                  <span className="min-w-0 flex-1 truncate text-navy-950" title={s.name}>
                    {s.name}
                    {s.custom ? <span className="ml-1 text-xs text-gold-700">(custom)</span> : null}
                  </span>
                  <button type="button" aria-label={`Remove ${s.name}`} onClick={() => removeSelected(s)} className="rounded p-1 text-navy-700/45 hover:bg-navy-950/5 hover:text-navy-950">
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {notice ? (
            notice.ok ? (
              <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {notice.text}
              </p>
            ) : (
              <ErrorText>{notice.text}</ErrorText>
            )
          ) : null}
          {dirty ? <p className="text-xs text-amber-700">You have unsaved changes for {year}.</p> : null}
          <button type="button" onClick={save} disabled={!draft || saving || !dirty} className={cn(primaryButton, "w-full")}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Holiday Calendar
          </button>
          <p className="text-[11px] leading-relaxed text-navy-700/50">
            Predefined dates follow the Government of India holiday list; Id and Muharram dates can move with the moon. Check state notifications for regional holidays.
          </p>
        </Card>
      </div>

      {form ? (
        <Modal title={form.key ? "Edit custom holiday" : "Add custom holiday"} onClose={() => setForm(null)}>
          <form onSubmit={submitCustom} className="space-y-4">
            <Field label="Holiday name" htmlFor="hol-name">
              <input
                id="hol-name"
                className={inputClasses}
                value={form.name}
                maxLength={120}
                autoFocus
                placeholder="e.g. Company Foundation Day"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" htmlFor="hol-date">
                <input
                  id="hol-date"
                  type="date"
                  className={inputClasses}
                  min={`${year}-01-01`}
                  max={`${year}-12-31`}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </Field>
              <Field label="Category" htmlFor="hol-type">
                <select id="hol-type" className={inputClasses} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as HolidayType })}>
                  {HOLIDAY_GROUPS.map((g) => (
                    <option key={g.type} value={g.type}>
                      {g.short}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <ErrorText>{formError}</ErrorText>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className={secondaryButton}>
                Cancel
              </button>
              <button type="submit" className={primaryButton}>
                {form.key ? "Update holiday" : "Add holiday"}
              </button>
            </div>
            <p className="text-xs text-navy-700/55">Added to the list right away; click Save Holiday Calendar to keep it.</p>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
