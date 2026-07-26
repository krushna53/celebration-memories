export interface TimelineMilestone {
  id: string;
  /** Free-text label, e.g. a year or "Early Years" — keep it short. */
  period: string;
  title: string;
  description: string;
}

/**
 * PLACEHOLDER CONTENT — replace with real family history before launch.
 *
 * These are generic example milestones only (no real dates or events
 * were supplied for Mahesh J. Shah). Swap in the real chapters of his
 * life — exact years, places, names — before this ships publicly.
 */
export const TIMELINE_MILESTONES: TimelineMilestone[] = [
  {
    id: "milestone-1",
    period: "Early Years",
    title: "A Beautiful Beginning",
    description:
      "Add a memory from the earliest chapter of the story — childhood, family roots, first steps.",
  },
  {
    id: "milestone-2",
    period: "Marriage & Family",
    title: "Building a Life Together",
    description:
      "Add a memory about the wedding, starting a family, or the early years with Jagruti.",
  },
  {
    id: "milestone-3",
    period: "Career & Community",
    title: "Years of Purpose",
    description:
      "Add a memory about career milestones, community involvement, or personal achievements.",
  },
  {
    id: "milestone-4",
    period: "Grandchildren & Joy",
    title: "A Growing Family",
    description:
      "Add a memory about grandchildren, family gatherings, and the joy of watching the family grow.",
  },
  {
    id: "milestone-5",
    period: "Today",
    title: "75 Years of Love",
    description:
      "Celebrating a lifetime of love, resilience, and cherished memories with everyone who matters most.",
  },
];
