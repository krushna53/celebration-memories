"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MenuDietaryTag, MenuItemRecord, ScheduleItemRecord } from "@/types/content";
import {
  createMenuItemAction,
  createScheduleItemAction,
  deleteMenuItemAction,
  deleteScheduleItemAction,
  getEventDayShareLinkAction,
  regenerateEventDayShareLinkAction,
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
          {scheduleItems.map((item, index) => (
            <div key={item.id} className="flex items-start gap-3 rounded-xl border border-navy-950/10 bg-white p-4">
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
              </div>
              <button
                type="button"
                disabled={scheduleBusyId === item.id}
                onClick={() => handleDeleteSchedule(item.id)}
                className="tap-target flex items-center justify-center text-navy-700/50 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
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
