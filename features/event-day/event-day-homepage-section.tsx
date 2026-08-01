import { listMenuItems, listScheduleItems } from "@/services/event-day";
import { EventDaySection } from "@/features/event-day/event-day-section";
import type { MenuItemRecord, MenuStyle, ScheduleItemRecord } from "@/types/content";

interface EventDayHomepageSectionProps {
  eventId: string;
  menuStyle: MenuStyle;
}

/**
 * Async Server Component wrapper so the homepage section stack
 * (event-sections.tsx, itself a sync component) can fetch this
 * section's own data the same way MemoryWallSection does — keeps
 * event-day-section.tsx's presentational component free of server-only
 * imports so it can also be reused, unchanged, by the "use client"
 * private /event-day/[token] page (see event-day-gate.tsx).
 */
export async function EventDayHomepageSection({ eventId, menuStyle }: EventDayHomepageSectionProps) {
  let scheduleItems: ScheduleItemRecord[] = [];
  let menuItems: MenuItemRecord[] = [];

  try {
    [scheduleItems, menuItems] = await Promise.all([listScheduleItems(eventId), listMenuItems(eventId)]);
  } catch (err) {
    console.error("EventDayHomepageSection failed to load:", err);
  }

  return <EventDaySection scheduleItems={scheduleItems} menuItems={menuItems} menuStyle={menuStyle} />;
}
