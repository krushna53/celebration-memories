import type { EventCategory } from "@/types/event";

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  birthday: "Birthday",
  wedding: "Wedding",
  anniversary: "Anniversary",
  retirement: "Retirement",
  baby_shower: "Baby Shower",
  corporate: "Corporate",
  obituary: "Memorial / Obituary",
  workshop: "Workshop",
  education: "Educational Event",
  live_stream: "Live Streamed Event",
  reunion: "Reunion",
};

export const EVENT_CATEGORY_OPTIONS: { value: EventCategory; label: string }[] = (
  Object.entries(EVENT_CATEGORY_LABELS) as [EventCategory, string][]
).map(([value, label]) => ({ value, label }));

/**
 * Copy for the "wish message" homepage section (events.wish_message) and
 * for the notices block inside Event Details (events.additional_notes) —
 * both fields are free text the host fills in, but the surrounding
 * heading/placeholder adapts to what kind of event this is, so the same
 * two database columns and the same section component serve a birthday
 * wish, a wedding well-wish, a note of remembrance, or workshop details
 * without the host needing category-specific fields.
 */
export interface WishSectionCopy {
  eyebrow: string;
  title: string;
  placeholder: string;
  noticesTitle: string;
}

const DEFAULT_WISH_COPY: WishSectionCopy = {
  eyebrow: "A Note From Us",
  title: "Our Wish For You",
  placeholder: "e.g. Thank you for being part of this celebration...",
  noticesTitle: "Good to Know",
};

const WISH_COPY_BY_CATEGORY: Partial<Record<EventCategory, WishSectionCopy>> = {
  birthday: {
    eyebrow: "Birthday Wishes",
    title: "A Birthday Wish",
    placeholder: "e.g. Wishing you a year ahead filled with joy, health, and love...",
    noticesTitle: "Good to Know",
  },
  wedding: {
    eyebrow: "With Love",
    title: "Our Wish For The Couple",
    placeholder: "e.g. May your marriage be filled with love, laughter, and a lifetime of happiness...",
    noticesTitle: "Good to Know",
  },
  anniversary: {
    eyebrow: "Celebrating Love",
    title: "An Anniversary Wish",
    placeholder: "e.g. Here's to many more years of love and togetherness...",
    noticesTitle: "Good to Know",
  },
  retirement: {
    eyebrow: "A New Chapter",
    title: "A Retirement Wish",
    placeholder: "e.g. Wishing you a well-deserved and joyful retirement...",
    noticesTitle: "Good to Know",
  },
  baby_shower: {
    eyebrow: "Welcoming A New Life",
    title: "A Wish For The Little One",
    placeholder: "e.g. Wishing you all the joy this new little life will bring...",
    noticesTitle: "Good to Know",
  },
  corporate: {
    eyebrow: "A Note From The Team",
    title: "A Message For This Event",
    placeholder: "e.g. Thank you for joining us — we look forward to seeing you there...",
    noticesTitle: "Event Notes",
  },
  obituary: {
    eyebrow: "In Loving Memory",
    title: "A Note Of Remembrance",
    placeholder: "e.g. Forever in our hearts. Thank you for celebrating a life so well lived...",
    noticesTitle: "Service Details",
  },
  workshop: {
    eyebrow: "Before You Join",
    title: "A Note From The Organizer",
    placeholder: "e.g. Please bring a laptop and come ready to build...",
    noticesTitle: "What To Know",
  },
  education: {
    eyebrow: "Before You Join",
    title: "A Note From The Organizer",
    placeholder: "e.g. Materials will be provided — just bring your curiosity...",
    noticesTitle: "What To Know",
  },
  live_stream: {
    eyebrow: "Joining Remotely",
    title: "A Note From The Host",
    placeholder: "e.g. The stream link will go live 10 minutes before start time...",
    noticesTitle: "Streaming Details",
  },
  reunion: {
    eyebrow: "Old Friends, New Memories",
    title: "A Reunion Note",
    placeholder: "e.g. It's been too long — can't wait to catch up and relive old memories together...",
    noticesTitle: "Good to Know",
  },
};

export function getWishSectionCopy(category: EventCategory | null | undefined): WishSectionCopy {
  if (!category) return DEFAULT_WISH_COPY;
  return WISH_COPY_BY_CATEGORY[category] ?? DEFAULT_WISH_COPY;
}

/**
 * Labels/placeholders for the "Honoree" and "Hosted By" fields (the
 * very first two fields in both EventBasicsForm and EventSettingsForm)
 * — "Honoree / Guest of Honor" reads fine for a birthday or retirement,
 * but is a confusing fit for events with no single person at the
 * center (a reunion's "honoree" is really a batch/group; a workshop's
 * is really its title). Same per-category-default pattern as
 * WishSectionCopy above, applied to a different pair of fields.
 */
export interface EventFieldCopy {
  honoreeLabel: string;
  honoreePlaceholder?: string;
  hostedByLabel: string;
  hostedByPlaceholder?: string;
}

const DEFAULT_FIELD_COPY: EventFieldCopy = {
  honoreeLabel: "Honoree / Guest of Honor",
  hostedByLabel: "Hosted By",
};

const FIELD_COPY_BY_CATEGORY: Partial<Record<EventCategory, EventFieldCopy>> = {
  wedding: {
    honoreeLabel: "Couple's Names",
    honoreePlaceholder: "e.g. Raj & Priya",
    hostedByLabel: "Hosted By",
  },
  baby_shower: {
    honoreeLabel: "Parent(s)-to-Be",
    honoreePlaceholder: "e.g. Raj & Priya",
    hostedByLabel: "Hosted By",
  },
  corporate: {
    honoreeLabel: "Event / Team Name",
    honoreePlaceholder: "e.g. Product Launch Team",
    hostedByLabel: "Hosted By (Company)",
  },
  workshop: {
    honoreeLabel: "Workshop Title",
    honoreePlaceholder: "e.g. Intro to Web Development",
    hostedByLabel: "Organized By",
  },
  education: {
    honoreeLabel: "Program / Class Name",
    honoreePlaceholder: "e.g. Graduating Class of 2026",
    hostedByLabel: "Organized By",
  },
  live_stream: {
    honoreeLabel: "Event Name",
    hostedByLabel: "Hosted By",
  },
  obituary: {
    honoreeLabel: "In Loving Memory Of",
    hostedByLabel: "Hosted By (Family)",
  },
  reunion: {
    honoreeLabel: "Batch / Group Name",
    honoreePlaceholder: "e.g. Batch 73, MGM Medical College",
    hostedByLabel: "Organized By",
    hostedByPlaceholder: "e.g. Reunion Committee",
  },
};

export function getEventFieldCopy(category: EventCategory | null | undefined): EventFieldCopy {
  if (!category) return DEFAULT_FIELD_COPY;
  return FIELD_COPY_BY_CATEGORY[category] ?? DEFAULT_FIELD_COPY;
}
