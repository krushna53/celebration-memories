export const EVENT_PLANS = {
  celebration: { name: "Celebration", amountPaise: 99900 },
  studio: { name: "Studio", amountPaise: 249900 },
} as const;
export type EventPlan = keyof typeof EVENT_PLANS;
export function isEventPlan(value: string): value is EventPlan { return Object.hasOwn(EVENT_PLANS, value); }
export function cashfreeOrderId(id: string) { return `em_${id.replaceAll("-", "")}`; }
export function localOrderId(value: string): string | null {
  if (!/^em_[a-f0-9]{32}$/.test(value)) return null;
  const h = value.slice(3);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
