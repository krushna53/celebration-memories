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
};

export function getWishSectionCopy(category: EventCategory | null | undefined): WishSectionCopy {
  if (!category) return DEFAULT_WISH_COPY;
  return WISH_COPY_BY_CATEGORY[category] ?? DEFAULT_WISH_COPY;
}
