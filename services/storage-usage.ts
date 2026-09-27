import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { listAllActiveEvents } from "@/services/events";

/**
 * Supabase Storage usage, per event and per category, for the owner's
 * /admin/storage dashboard and the client's Event Settings storage meter.
 *
 * Computed by one SQL function over storage.objects
 * (public.storage_usage_by_event, migration 0064) — every stored byte is
 * counted, and files in a folder the function doesn't recognise land in
 * "other" instead of silently dropping out of the totals (the previous
 * version listed only three hand-picked folders, so AI images, Video
 * Editor files, slideshow music etc. were invisible). The folder →
 * category mapping lives in that migration; add new upload folders there.
 */

export const STORAGE_CATEGORIES = [
  {
    key: "memory_wall",
    label: "Memory Wall",
    hint: "Guest (and host-added) photos, videos and voice notes",
  },
  {
    key: "gallery_timeline",
    label: "Gallery & Timeline",
    hint: "Gallery photos, cleaned-up prints, timeline photos",
  },
  {
    key: "slideshow",
    label: "Slideshow & Music",
    hint: "Rendered slideshow / timeline videos and background music",
  },
  {
    key: "ai_images",
    label: "AI Images",
    hint: "AI-generated invitation cards and uploaded card designs",
  },
  {
    key: "video_editor",
    label: "Video Editor",
    hint: "Video Editor uploads and renders",
  },
  {
    key: "share_display",
    label: "Share & Display",
    hint: "Link-preview image/video and the big-screen highlight reel",
  },
  {
    key: "other",
    label: "Other",
    hint: "Files in folders not yet categorised",
  },
] as const;

export type StorageCategory = (typeof STORAGE_CATEGORIES)[number]["key"];
export type CategoryUsage = Record<
  StorageCategory,
  { bytes: number; files: number }
>;

export interface StorageUsageBreakdown {
  /** Kept for existing callers — same as categories.gallery_timeline/slideshow/memory_wall bytes. */
  galleryTimelineBytes: number;
  slideshowBytes: number;
  memoryWallBytes: number;
  categories: CategoryUsage;
  totalBytes: number;
  totalFiles: number;
}

export interface EventStorageUsage extends StorageUsageBreakdown {
  eventId: string;
  slug: string;
  honoreeName: string;
  eventTitle: string;
}

export interface PlatformStorageRow {
  /** e.g. "gallery/custom-forms", "business/…" */
  location: string;
  label: string;
  bytes: number;
  files: number;
}

export interface StorageOverview {
  events: EventStorageUsage[];
  /** Draft / inactive events, combined into one row. */
  otherEvents: StorageUsageBreakdown & { eventCount: number };
  platform: PlatformStorageRow[];
  totals: StorageUsageBreakdown;
  grandTotalBytes: number;
}

interface UsageRow {
  event_id: string | null;
  category: string;
  files: number;
  bytes: number;
}

function emptyCategories(): CategoryUsage {
  return Object.fromEntries(
    STORAGE_CATEGORIES.map((c) => [c.key, { bytes: 0, files: 0 }]),
  ) as CategoryUsage;
}

function toBreakdown(categories: CategoryUsage): StorageUsageBreakdown {
  const values = Object.values(categories);
  return {
    galleryTimelineBytes: categories.gallery_timeline.bytes,
    slideshowBytes: categories.slideshow.bytes,
    memoryWallBytes: categories.memory_wall.bytes,
    categories,
    totalBytes: values.reduce((a, c) => a + c.bytes, 0),
    totalFiles: values.reduce((a, c) => a + c.files, 0),
  };
}

function addRow(target: CategoryUsage, row: UsageRow) {
  const key = (
    STORAGE_CATEGORIES.some((c) => c.key === row.category)
      ? row.category
      : "other"
  ) as StorageCategory;
  target[key].bytes += Number(row.bytes) || 0;
  target[key].files += Number(row.files) || 0;
}

const PLATFORM_LABELS: Record<string, string> = {
  "gallery/custom-forms": "RSVP / form cover images",
  "gallery/platform": "Platform assets (homepage video etc.)",
};

// One scan of storage.objects serves every event for a minute — the daily
// quota job (services/admin-notification-jobs.ts) asks once per event.
let cached: { at: number; rows: UsageRow[] } | null = null;

async function loadUsageRows(): Promise<UsageRow[]> {
  if (cached && Date.now() - cached.at < 60_000) return cached.rows;
  const { data, error } = await supabaseAdmin().rpc("storage_usage_by_event");
  if (error) throw new Error(`Failed to load storage usage: ${error.message}`);
  cached = { at: Date.now(), rows: (data ?? []) as UsageRow[] };
  return cached.rows;
}

/** One event's usage (Event Settings' storage meter). */
export async function getEventStorageUsage(event: {
  id: string;
  slug: string;
  honoreeName: string;
  eventTitle: string;
}): Promise<EventStorageUsage> {
  const categories = emptyCategories();
  try {
    for (const row of await loadUsageRows())
      if (row.event_id === event.id) addRow(categories, row);
  } catch (err) {
    console.error("getEventStorageUsage failed:", err);
  }
  return {
    eventId: event.id,
    slug: event.slug,
    honoreeName: event.honoreeName,
    eventTitle: event.eventTitle,
    ...toBreakdown(categories),
  };
}

/** Everything, for the owner's /admin/storage dashboard. */
export async function getStorageOverview(): Promise<StorageOverview> {
  const [rows, active] = await Promise.all([
    loadUsageRows(),
    listAllActiveEvents(),
  ]);
  const activeById = new Map(active.map((e) => [e.id, e]));

  const perEvent = new Map<string, CategoryUsage>();
  const otherEvents = emptyCategories();
  const otherEventIds = new Set<string>();
  const totals = emptyCategories();
  const platform = new Map<string, PlatformStorageRow>();

  for (const row of rows) {
    if (!row.event_id) {
      const location = row.category.replace(/^platform:/, "");
      const bucketLevel = location.split("/")[0] ?? location;
      const key = PLATFORM_LABELS[location]
        ? location
        : bucketLevel === "business"
          ? "business"
          : location;
      const existing = platform.get(key) ?? {
        location: key,
        label:
          PLATFORM_LABELS[key] ??
          (key === "business" ? "Marketplace vendor images" : key),
        bytes: 0,
        files: 0,
      };
      existing.bytes += Number(row.bytes) || 0;
      existing.files += Number(row.files) || 0;
      platform.set(key, existing);
      continue;
    }
    addRow(totals, row);
    if (activeById.has(row.event_id)) {
      const cats = perEvent.get(row.event_id) ?? emptyCategories();
      addRow(cats, row);
      perEvent.set(row.event_id, cats);
    } else {
      addRow(otherEvents, row);
      otherEventIds.add(row.event_id);
    }
  }

  const events = active
    .map((e) => ({
      eventId: e.id,
      slug: e.slug,
      honoreeName: e.honoreeName,
      eventTitle: e.eventTitle,
      ...toBreakdown(perEvent.get(e.id) ?? emptyCategories()),
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes);

  const platformRows = [...platform.values()].sort((a, b) => b.bytes - a.bytes);
  const eventTotals = toBreakdown(totals);
  return {
    events,
    otherEvents: {
      ...toBreakdown(otherEvents),
      eventCount: otherEventIds.size,
    },
    platform: platformRows,
    totals: eventTotals,
    grandTotalBytes:
      eventTotals.totalBytes + platformRows.reduce((a, r) => a + r.bytes, 0),
  };
}

/** Live events only, largest first — kept for the Usage dashboard (services/usage-analytics.ts). */
export async function getAllEventsStorageUsage(): Promise<EventStorageUsage[]> {
  return (await getStorageOverview()).events;
}
