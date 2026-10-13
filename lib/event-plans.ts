import type { EventSegment } from "@/lib/event-segment";

export const EVENT_PLANS = {
  celebration: { name: "Celebration", amountPaise: 99900 },
  studio: { name: "Studio", amountPaise: 249900 },
  /** Corporate events (lib/event-segment.ts): 2,000 attendees, 50 GB, 20 team members, check-in, report, co-branding. Storage set in apply_plan_order (migration 20261013090000). */
  corporate: { name: "Corporate Event", amountPaise: 499900 },
} as const;
export type EventPlan = keyof typeof EVENT_PLANS;
export function isEventPlan(value: string): value is EventPlan { return Object.hasOwn(EVENT_PLANS, value); }

/** Plans offered when publishing a draft — family events keep the original two; corporate drafts also see Corporate Event. */
export function eventPlansForSegment(segment: EventSegment): EventPlan[] {
  return segment === "corporate" ? ["celebration", "studio", "corporate"] : ["celebration", "studio"];
}

export function cashfreeOrderId(id: string) { return `em_${id.replaceAll("-", "")}`; }
export function localOrderId(value: string): string | null {
  if (!/^em_[a-f0-9]{32}$/.test(value)) return null;
  const h = value.slice(3);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
