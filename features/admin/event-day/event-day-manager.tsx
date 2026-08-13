"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Copy, Link2, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MenuDietaryTag, MenuItemRecord, ScheduleItemRecord } from "@/types/content";
import {
  createMenuItemAction,
  createScheduleItemAction,
  deleteMenuItemAction,
  deleteScheduleItemAction,
  getEventDayShareLinkAction,
  getSessionShareLinkAction,
  regenerateEventDayShareLinkAction,
  regenerateSessionShareLinkAction,
  setScheduleItemCustomFormAction,
  updateEventDaySettingsAction,
  updateMenuItemAction,
  updateScheduleItemAction,
} from "@/features/admin/event-day/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

type EventDayMode = "off" | "public" | "private";
type MenuStyle = "buffet" | "a_la_carte";

const DIETARY_OPTIONS: { value: MenuDietaryTag | ""; label: string }[] = [
  { value: "", label: "No tag" },
  { value: "veg", label: "Veg" },
  { value: "non_veg", label: "Non-Veg" },
  { value: "vegan", label: "Vegan" },
  { value: "jain", label: "Jain" },
];

interface EventDayManagerProps {
  eventId: string;
  initialMode: EventDayMode;
  initialMenuStyle: MenuStyle;
  initialShareToken: string | null;
  initialScheduleItems: ScheduleItemRecord[];
  initialMenuItems: MenuItemRecord[];
}

const EMPTY_SCHEDULE = { startLabel: "", endLabel: "", title: "", description: "" };
const EMPTY_MENU = { category: "", name: "", description: "", dietaryTag: "" as MenuDietaryTag | "" };

export function EventDayManager({
  eventId,
  initialMode,
  initialMenuStyle,
  initialShareToken,
  initialScheduleItems,
  initialMenuItems,
}: EventDayManagerProps) {
  const [mode, setMode] = useState<EventDayMode>(initialMode);
  const [menuStyle, setMenuStyle] = useState<MenuStyle>(initialMenuStyle);
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const [scheduleItems, setScheduleItems] = useState(
    [...initialScheduleItems].sort((a, b) => a.sortOrder - b.sortOrder),
  );
  const [scheduleForm, setScheduleForm] = useState(EMPTY_SCHEDULE);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleBusyId, setScheduleBusyId] = useState<string | null>(null);

  // Registration & pricing (#63) — an inline editor per schedule item, collapsed by default.
  const [expandedPricingId, setExpandedPricingId] = useState<string | null>(null);
  const [pricingForms, setPricingForms] = useState<
    Record<
      string,
      {
        requiresRegistration: boolean;
        isPaidSession: boolean;
        regularPrice: string;
        earlyBirdPrice: string;
        earlyBirdDeadline: string;
        currency: string;
      }
    >
  >({});
  const [pricingBusyId, setPricingBusyId] = useState<string | null>(null);

  // Per-session share link + linked custom form (#106) — same shared-link pattern as the event-wide one above, scoped to one schedule item.
  const [sessionShareTokens, setSessionShareTokens] = useState<Record<string, string | null>>(
    Object.fromEntries(initialScheduleItems.map((item) => [item.id, item.shareToken])),
  );
  const [sessionLinkBusyId, setSessionLinkBusyId] = useState<string | null>(null);
  const [customFormSlugDrafts, setCustomFormSlugDrafts] = useState<Record<string, string>>({});
  const [customFormBusyId, setCustomFormBusyId] = useState<string | null>(null);
  const [linkedFormIds, setLinkedFormIds] = useState<Record<string, string | null>>(
    Object.fromEntries(initialScheduleItems.map((item) => [item.id, item.customFormId])),
  );

  async function handleCopySessionLink(item: ScheduleItemRecord) {
    let token = sessionShareTokens[item.id];
    if (!token) {
      setSessionLinkBusyId(item.id);
      const result = await getSessionShareLinkAction(item.id);
      setSessionLinkBusyId(null);
      if (!result.success) {
        alert(result.error);
        return;
      }
      token = result.data;
      setSessionShareTokens((prev) => ({ ...prev, [item.id]: token as string }));
    }
    if (origin) navigator.clipboard.writeText(`${origin}/session/${token}`);
  }

  async function handleRegenerateSessionLink(item: ScheduleItemRecord) {
    if (!confirm("Regenerate this session's link? The old link will stop working immediately.")) return;
    setSessionLinkBusyId(item.id);
    const result = await regenerateSessionShareLinkAction(item.id);
    setSessionLinkBusyId(null);
    if (result.success) {
      setSessionShareTokens((prev) => ({ ...prev, [item.id]: result.data }));
    } else {
      alert(result.error);
    }
  }

  async function handleSaveCustomForm(item: ScheduleItemRecord) {
    const slug = customFormSlugDrafts[item.id] ?? "";
    setCustomFormBusyId(item.id);
    const result = await setScheduleItemCustomFormAction(item.id, slug);
    setCustomFormBusyId(null);
    if (result.success) {
      setLinkedFormIds((prev) => ({ ...prev, [item.id]: slug.trim() ? "linked" : null }));
      setCustomFormSlugDrafts((prev) => ({ ...prev, [item.id]: "" }));
    } else {
      alert(result.error);
    }
  }

  function pricingDraftFor(item: ScheduleItemRecord) {
    return (
      pricingForms[item.id] ?? {
        requiresRegistration: item.requiresRegistration,
        isPaidSession: item.isPaidSession,
        regularPrice: item.regularPrice !== null ? String(item.regularPrice) : "",
        earlyBirdPrice: item.earlyBirdPrice !== null ? String(item.earlyBirdPrice) : "",
        earlyBirdDeadline: item.earlyBirdDeadline ? item.earlyBirdDeadline.slice(0, 10) : "",
        currency: item.currency || "INR",
      }
    );
  }

  function toggleExpandedPricing(item: ScheduleItemRecord) {
    if (expandedPricingId === item.id) {
      setExpandedPricingId(null);
      return;
    }
    setPricingForms((prev) => ({ ...prev, [item.id]: pricingDraftFor(item) }));
    setExpandedPricingId(item.id);
  }

  async function handleSavePricing(item: ScheduleItemRecord) {
    const draft = pricingDraftFor(item);
    setPricingBusyId(item.id);
    const result = await updateScheduleItemAction(item.id, {
      requiresRegistration: draft.requiresRegistration,
      isPaidSession: draft.isPaidSession,
      regularPrice: draft.regularPrice.trim() ? Number(draft.regularPrice) : null,
      earlyBirdPrice: draft.earlyBirdPrice.trim() ? Number(draft.earlyBirdPrice) : null,
      earlyBirdDeadline: draft.earlyBirdDeadline.trim() ? new Date(draft.earlyBirdDeadline).toISOString() : null,
      currency: draft.currency.trim() || "INR",
    });
    setPricingBusyId(null);
    if (result.success) {
      setScheduleItems((prev) =>
        prev.map((s) =>
          s.id === item.id
            ? {
                ...s,
                requiresRegistration: draft.requiresRegistration,
                isPaidSession: draft.isPaidSession,
                regularPrice: draft.regularPrice.trim() ? Number(draft.regularPrice) : null,
                earlyBirdPrice: draft.earlyBirdPrice.trim() ? Number(draft.earlyBirdPrice) : null,
                earlyBirdDeadline: draft.earlyBirdDeadline.trim() ? new Date(draft.earlyBirdDeadline).toISOString() : null,
                currency: draft.currency.trim() || "INR",
              }
            : s,
        ),
      );
      setExpandedPricingId(null);
    } else {
      alert(result.error);
    }
  }

  const [menuItems, setMenuItems] = useState([...initialMenuItems].sort((a, b) => a.sortOrder - b.sortOrder));
  const [menuForm, setMenuForm] = useState(EMPTY_MENU);
  const [menuBusy, setMenuBusy] = useState(false);
  const [menuBusyId, setMenuBusyId] = useState<string | null>(null);

  async function handleModeChange(next: EventDayMode) {
    setMode(next);
    setSettingsBusy(true);
    const result = await updateEventDaySettingsAction(eventId, { eventDayMode: next });
    setSettingsBusy(false);
    if (!result.success) {
      alert(result.error);
      return;
    }
    if (next === "private" && !shareToken) {
      const linkResult = await getEventDayShareLinkAction(eventId);
      if (linkResult.success) setShareToken(linkResult.data);
    }
  }

  async function handleMenuStyleChange(next: MenuStyle) {
    setMenuStyle(next);
    setSettingsBusy(true);
    const result = await updateEventDaySettingsAction(eventId, { menuStyle: next });
    setSettingsBusy(false);
    if (!result.success) alert(result.error);
  }

  async function handleRegenerateLink() {
    if (!confirm("Regenerate the share link? The old link will stop working immediately.")) return;
    setLinkBusy(true);
    const result = await regenerateEventDayShareLinkAction(eventId);
    setLinkBusy(false);
    if (result.success) {
      setShareToken(result.data);
    } else {
      alert(result.error);
    }
  }

  function copyLink() {
    if (!shareToken || !origin) return;
    navigator.clipboard.writeText(`${origin}/event-day/${shareToken}`);
  }

  // Schedule

  async function handleAddSchedule() {
    if (!scheduleForm.startLabel.trim() || !scheduleForm.title.trim()) return;
    setScheduleBusy(true);
    const result = await createScheduleItemAction({
      eventId,
      startLabel: scheduleForm.startLabel,
      endLabel: scheduleForm.endLabel || undefined,
      title: scheduleForm.title,
      description: scheduleForm.description || undefined,
      sortOrder: scheduleItems.length,
    });
    setScheduleBusy(false);
    if (result.success) {
      setScheduleForm(EMPTY_SCHEDULE);
      window.location.reload();
    } else {
      alert(result.error);
    }
  }

  async function handleDeleteSchedule(id: string) {
    if (!confirm("Delete this schedule item?")) return;
    setScheduleBusyId(id);
    const result = await deleteScheduleItemAction(id);
    setScheduleBusyId(null);
    if (result.success) {
      setScheduleItems((prev) => prev.filter((s) => s.id !== id));
    } else {
      alert(result.error);
    }
  }

  async function moveSchedule(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= scheduleItems.length) return;
    const reordered = [...scheduleItems];
    const a = reordered[index];
    const b = reordered[target];
    if (!a || !b) return;
    reordered[index] = b;
    reordered[target] = a;
    setScheduleItems(reordered);
    setScheduleBusy(true);
    await Promise.all(reordered.map((s, i) => updateScheduleItemAction(s.id, { sortOrder: i })));
    setScheduleBusy(false);
  }

  // Menu

  async function handleAddMenu() {
    if (!menuForm.category.trim() || !menuForm.name.trim()) return;
    setMenuBusy(true);
    const result = await createMenuItemAction({
      eventId,
      category: menuForm.category,
      name: menuForm.name,
      description: menuForm.description || undefined,
      dietaryTag: menuForm.dietaryTag || null,
      sortOrder: menuItems.length,
    });
    setMenuBusy(false);
    if (result.success) {
      setMenuForm(EMPTY_MENU);
      window.location.reload();
    } else {
      alert(result.error);
    }
  }

  async function handleDeleteMenu(id: string) {
    if (!confirm("Delete this menu item?")) return;
    setMenuBusyId(id);
    const result = await deleteMenuItemAction(id);
    setMenuBusyId(null);
    if (result.success) {
      setMenuItems((prev) => prev.filter((m) => m.id !== id));
    } else {
      alert(result.error);
    }
  }

  async function moveMenu(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= menuItems.length) return;
    const reordered = [...menuItems];
    const a = reordered[index];
    const b = reordered[target];
    if (!a || !b) return;
    reordered[index] = b;
    reordered[target] = a;
    setMenuItems(reordered);
    setMenuBusy(true);
    await Promise.all(reordered.map((m, i) => updateMenuItemAction(m.id, { sortOrder: i })));
    setMenuBusy(false);
  }

  return (
    <div className="space-y-10">
      {/* Settings */}
      <div className="rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Visibility</h2>
        <p className="mt-1 text-sm text-navy-700/60">
          Choose how guests see the schedule and menu below — off, fully public on the main event page, or
          private behind a shared link that checks the guest&rsquo;s phone number against your invitee list.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {(["off", "public", "private"] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={settingsBusy}
              onClick={() => handleModeChange(option)}
              className={`rounded-lg border px-4 py-3 text-left text-sm capitalize transition-luxury ${
                mode === option
                  ? "border-gold-500 bg-gold-500/10 text-navy-950"
                  : "border-navy-950/10 text-navy-700/70 hover:border-gold-500/40"
              }`}
            >
              <span className="block font-medium">{option === "off" ? "Off" : option === "public" ? "Public" : "Private"}</span>
              <span className="mt-0.5 block text-xs text-navy-700/50">
                {option === "off"
                  ? "Hidden everywhere"
                  : option === "public"
                    ? "Shown on the main event page"
                    : "Shared link + phone check"}
              </span>
            </button>
          ))}
        </div>

        {mode === "private" ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-navy-950/[0.03] p-3">
            <code className="flex-1 truncate text-xs text-navy-700">
              {shareToken && origin ? `${origin}/event-day/${shareToken}` : "Loading…"}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={copyLink} disabled={!shareToken || !origin}>
              <Copy size={13} /> Copy
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleRegenerateLink} disabled={linkBusy}>
              {linkBusy ? <Loader2 className="animate-spin" size={13} /> : <RefreshCw size={13} />} Regenerate
            </Button>
          </div>
        ) : null}

        <div className="mt-5">
          <p className="text-sm font-medium text-navy-950">Menu style</p>
          <div className="mt-2 flex gap-2">
            {(["buffet", "a_la_carte"] as const).map((option) => (
              <button
                key={option}
                type="button"
                disabled={settingsBusy}
                onClick={() => handleMenuStyleChange(option)}
                className={`rounded-full border px-4 py-1.5 text-sm ${
                  menuStyle === option
                    ? "border-gold-500 bg-gold-500/10 text-navy-950"
                    : "border-navy-950/10 text-navy-700/70 hover:border-gold-500/40"
                }`}
              >
                {option === "buffet" ? "Buffet" : "À La Carte"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div>
        <h2 className="font-display text-lg text-navy-950">Schedule</h2>
        <p className="mt-1 text-sm text-navy-700/60">The run-of-show, in order — e.g. 11:00 AM–12:00 PM, Cake Cutting.</p>

        <div className="mt-4 grid gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 sm:grid-cols-4">
          <input
            placeholder="Start (e.g. 11:00 AM)"
            value={scheduleForm.startLabel}
            onChange={(e) => setScheduleForm((f) => ({ ...f, startLabel: e.target.value }))}
            className={inputClasses}
          />
          <input
            placeholder="End (optional)"
            value={scheduleForm.endLabel}
            onChange={(e) => setScheduleForm((f) => ({ ...f, endLabel: e.target.value }))}
            className={inputClasses}
          />
          <input
            placeholder="Title (e.g. Cake Cutting)"
            value={scheduleForm.title}
            onChange={(e) => setScheduleForm((f) => ({ ...f, title: e.target.value }))}
            className={inputClasses}
          />
          <input
            placeholder="Description (optional)"
            value={scheduleForm.description}
            onChange={(e) => setScheduleForm((f) => ({ ...f, description: e.target.value }))}
            className={inputClasses}
          />
          <div className="sm:col-span-4">
            <Button onClick={handleAddSchedule} disabled={scheduleBusy}>
              {scheduleBusy ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
              Add Schedule Item
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {scheduleItems.map((item, index) => {
            const draft = pricingDraftFor(item);
            const expanded = expandedPricingId === item.id;
            return (
              <div key={item.id} className="rounded-xl border border-navy-950/10 bg-white">
                <div className="flex items-start gap-3 p-4">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={index === 0 || scheduleBusy}
                      onClick={() => moveSchedule(index, -1)}
                      className="tap-target flex items-center justify-center text-navy-700/50 hover:text-gold-600 disabled:opacity-30"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={index === scheduleItems.length - 1 || scheduleBusy}
                      onClick={() => moveSchedule(index, 1)}
                      className="tap-target flex items-center justify-center text-navy-700/50 hover:text-gold-600 disabled:opacity-30"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-wide text-gold-600">
                      {item.startLabel}
                      {item.endLabel ? ` – ${item.endLabel}` : ""}
                    </p>
                    <p className="font-display text-lg text-navy-950">{item.title}</p>
                    {item.description ? <p className="text-sm text-navy-700/70">{item.description}</p> : null}
                    {item.requiresRegistration ? (
                      <p className="mt-1 text-xs text-gold-600">
                        Registration required{item.isPaidSession && item.regularPrice ? ` · ${item.currency} ${item.regularPrice}` : " · Free"}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleExpandedPricing(item)}
                    className="tap-target flex items-center gap-1 whitespace-nowrap text-xs text-navy-700/60 hover:text-gold-600"
                  >
                    Registration & Pricing {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button
                    type="button"
                    disabled={scheduleBusyId === item.id}
                    onClick={() => handleDeleteSchedule(item.id)}
                    className="tap-target flex items-center justify-center text-navy-700/50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {expanded ? (
                  <div className="border-t border-navy-950/10 bg-navy-950/[0.02] p-4">
                    <label className="flex items-center gap-2 text-sm text-navy-950">
                      <input
                        type="checkbox"
                        checked={draft.requiresRegistration}
                        onChange={(e) =>
                          setPricingForms((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, requiresRegistration: e.target.checked },
                          }))
                        }
                      />
                      Guests must register for this session
                    </label>

                    {draft.requiresRegistration ? (
                      <>
                        <label className="mt-3 flex items-center gap-2 text-sm text-navy-950">
                          <input
                            type="checkbox"
                            checked={draft.isPaidSession}
                            onChange={(e) =>
                              setPricingForms((prev) => ({
                                ...prev,
                                [item.id]: { ...draft, isPaidSession: e.target.checked },
                              }))
                            }
                          />
                          This session is paid
                        </label>

                        {draft.isPaidSession ? (
                          <div className="mt-3 grid gap-2.5 sm:grid-cols-4">
                            <div>
                              <label className="text-xs text-navy-700/60">Regular price</label>
                              <input
                                type="number"
                                min="0"
                                value={draft.regularPrice}
                                onChange={(e) =>
                                  setPricingForms((prev) => ({ ...prev, [item.id]: { ...draft, regularPrice: e.target.value } }))
                                }
                                className={inputClasses}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-navy-700/60">Early-bird price</label>
                              <input
                                type="number"
                                min="0"
                                value={draft.earlyBirdPrice}
                                onChange={(e) =>
                                  setPricingForms((prev) => ({ ...prev, [item.id]: { ...draft, earlyBirdPrice: e.target.value } }))
                                }
                                className={inputClasses}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-navy-700/60">Early-bird deadline</label>
                              <input
                                type="date"
                                value={draft.earlyBirdDeadline}
                                onChange={(e) =>
                                  setPricingForms((prev) => ({ ...prev, [item.id]: { ...draft, earlyBirdDeadline: e.target.value } }))
                                }
                                className={inputClasses}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-navy-700/60">Currency</label>
                              <input
                                value={draft.currency}
                                onChange={(e) =>
                                  setPricingForms((prev) => ({ ...prev, [item.id]: { ...draft, currency: e.target.value.toUpperCase() } }))
                                }
                                className={inputClasses}
                              />
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button size="sm" onClick={() => handleSavePricing(item)} disabled={pricingBusyId === item.id}>
                        {pricingBusyId === item.id ? <Loader2 className="animate-spin" size={13} /> : null} Save
                      </Button>
                      {draft.requiresRegistration && draft.isPaidSession ? (
                        <Link
                          href={`/admin/payment-settings-request?scheduleItemId=${item.id}`}
                          className="text-xs text-gold-600 underline underline-offset-4 hover:text-gold-500"
                        >
                          Set a payment method just for this session (optional — otherwise uses your event default)
                        </Link>
                      ) : null}
                    </div>

                    {draft.requiresRegistration ? (
                      <div className="mt-4 space-y-3 border-t border-navy-950/10 pt-4">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-navy-700/60">Share just this session</p>
                          <p className="mt-0.5 text-xs text-navy-700/50">
                            A dedicated link for this session only — share it with just the guests you want, instead of your whole
                            Event Day link. Also assign it to a Session Organizer under Session Organizers so they can share it and
                            manage their own payment method.
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => handleCopySessionLink(item)} disabled={sessionLinkBusyId === item.id}>
                              {sessionLinkBusyId === item.id ? <Loader2 className="animate-spin" size={13} /> : <Copy size={13} />} Copy Link
                            </Button>
                            {sessionShareTokens[item.id] ? (
                              <Button type="button" variant="ghost" size="sm" onClick={() => handleRegenerateSessionLink(item)} disabled={sessionLinkBusyId === item.id}>
                                <RefreshCw size={13} /> Regenerate
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-navy-700/60">
                            Extra questions (optional) {linkedFormIds[item.id] ? <span className="text-emerald-600">· Linked</span> : null}
                          </p>
                          <p className="mt-0.5 text-xs text-navy-700/50">
                            Paste the link/slug of a form you built with the Custom Form Builder (/forms/new) to collect extra
                            details from guests registering for this session. Leave blank and save to unlink.
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                              placeholder="e.g. form-a1b2c3d4"
                              value={customFormSlugDrafts[item.id] ?? ""}
                              onChange={(e) => setCustomFormSlugDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              className={`${inputClasses} max-w-xs`}
                            />
                            <Button type="button" variant="outline" size="sm" onClick={() => handleSaveCustomForm(item)} disabled={customFormBusyId === item.id}>
                              {customFormBusyId === item.id ? <Loader2 className="animate-spin" size={13} /> : <Link2 size={13} />} Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {scheduleItems.length === 0 ? (
            <p className="rounded-xl border border-dashed border-navy-950/15 py-10 text-center text-sm text-navy-700/50">
              No schedule items yet — add the first one above.
            </p>
          ) : null}
        </div>
      </div>

      {/* Menu */}
      <div>
        <h2 className="font-display text-lg text-navy-950">Menu</h2>
        <p className="mt-1 text-sm text-navy-700/60">Grouped by category (e.g. Starters, Mains, Desserts, Beverages).</p>

        <div className="mt-4 grid gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 sm:grid-cols-4">
          <input
            placeholder="Category (e.g. Starters)"
            value={menuForm.category}
            onChange={(e) => setMenuForm((f) => ({ ...f, category: e.target.value }))}
            className={inputClasses}
          />
          <input
            placeholder="Dish name"
            value={menuForm.name}
            onChange={(e) => setMenuForm((f) => ({ ...f, name: e.target.value }))}
            className={inputClasses}
          />
          <input
            placeholder="Description (optional)"
            value={menuForm.description}
            onChange={(e) => setMenuForm((f) => ({ ...f, description: e.target.value }))}
            className={inputClasses}
          />
          <select
            value={menuForm.dietaryTag}
            onChange={(e) => setMenuForm((f) => ({ ...f, dietaryTag: e.target.value as MenuDietaryTag | "" }))}
            className={inputClasses}
          >
            {DIETARY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="sm:col-span-4">
            <Button onClick={handleAddMenu} disabled={menuBusy}>
              {menuBusy ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
              Add Menu Item
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {menuItems.map((item, index) => (
            <div key={item.id} className="flex items-start gap-3 rounded-xl border border-navy-950/10 bg-white p-4">
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  disabled={index === 0 || menuBusy}
                  onClick={() => moveMenu(index, -1)}
                  className="tap-target flex items-center justify-center text-navy-700/50 hover:text-gold-600 disabled:opacity-30"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  disabled={index === menuItems.length - 1 || menuBusy}
                  onClick={() => moveMenu(index, 1)}
                  className="tap-target flex items-center justify-center text-navy-700/50 hover:text-gold-600 disabled:opacity-30"
                >
                  <ArrowDown size={16} />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide text-gold-600">
                  {item.category}
                  {item.dietaryTag ? ` · ${DIETARY_OPTIONS.find((o) => o.value === item.dietaryTag)?.label}` : ""}
                </p>
                <p className="font-display text-lg text-navy-950">{item.name}</p>
                {item.description ? <p className="text-sm text-navy-700/70">{item.description}</p> : null}
              </div>
              <button
                type="button"
                disabled={menuBusyId === item.id}
                onClick={() => handleDeleteMenu(item.id)}
                className="tap-target flex items-center justify-center text-navy-700/50 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {menuItems.length === 0 ? (
            <p className="rounded-xl border border-dashed border-navy-950/15 py-10 text-center text-sm text-navy-700/50">
              No menu items yet — add the first one above.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
