"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free", description: "For a small celebration", event: ["₹0", "$0"], monthly: ["₹0", "$0"],
    allowance: "1 event per account, lifetime", active: "1 active event",
    features: ["50 guests", "250 MB storage", "Owner access", "Website, RSVP & schedule", "Photo gallery & memories", "Basic slideshow"],
  },
  {
    name: "Celebration", description: "For families and regular hosts", event: ["₹999", "$15"], monthly: ["₹499", "$7"],
    allowance: "2 new events per month", active: "Up to 5 active events",
    features: ["300 guests per event", "5 GB storage", "Owner + 3 team members", "Website, RSVP & schedule", "Photo & video memories", "Planner, games & slideshow"],
  },
  {
    name: "Studio", description: "For planners and businesses", event: ["₹2,499", "$35"], monthly: ["₹1,499", "$19"],
    allowance: "10 new events per month", active: "Up to 25 active events",
    features: ["1,000 guests per event", "25 GB storage", "Owner + 10 team members", "Website, RSVP & schedule", "Photo & video memories", "Planner, games & slideshow", "Priority support"],
  },
];

export function EventPricingPlans() {
  const [mode, setMode] = useState<"event" | "monthly">("event");
  return (
    <>
      <div className="flex justify-center">
        <div role="group" aria-label="Payment option" className="inline-flex rounded-full border border-navy-950/15 bg-white p-1">
          {([ ["event", "Pay per event"], ["monthly", "Monthly subscription"] ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}
              className={cn("rounded-full px-4 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600", mode === value ? "bg-navy-950 text-white" : "text-navy-950 hover:bg-ivory-100")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div aria-live="polite" className="mx-auto mt-5 max-w-2xl text-center text-sm text-navy-700">
        {mode === "event" ? <p><strong>One payment. One event. 12 months of access.</strong><br />Paid per-event plans do not renew automatically.</p>
          : <p><strong>A recurring monthly plan for regular hosts.</strong><br />New-event allowances reset each billing month. Paid access lasts while subscribed.</p>}
      </div>

      <div className="mt-9 grid gap-6 lg:grid-cols-3">
        {plans.map((plan, index) => {
          const free = index === 0;
          const price = plan[mode];
          return (
            <article key={plan.name} className={cn("relative flex flex-col rounded-2xl border bg-white p-6 sm:p-8", index === 1 ? "border-gold-500 shadow-lg ring-1 ring-gold-500/20" : "border-navy-950/10")}>
              <h2 className="font-display text-2xl text-navy-950">{plan.name}</h2>
              <p className="mt-2 text-sm text-navy-700">{plan.description}</p>
              <div className="mt-6">
                <p className="font-display text-4xl text-navy-950">{price[0]} <span className="font-sans text-base">INR</span></p>
                <p className="mt-1 text-lg text-navy-700">or {price[1]} USD</p>
                <p className="mt-2 text-sm font-semibold text-navy-950">{free ? "Free · no subscription" : mode === "event" ? "Per event · one-time payment" : "Per month · recurring payment"}</p>
              </div>
              <div className="my-6 border-y border-navy-950/10 py-4 text-sm text-navy-950">
                <p className="font-semibold">{free ? plan.allowance : mode === "event" ? "1 event · 12 months access" : plan.allowance}</p>
                <p className="mt-1 text-navy-700">{free ? "No card needed" : mode === "event" ? "Multiple days count as one event" : plan.active}</p>
              </div>
              <ul className="mb-7 space-y-3 text-sm text-navy-700">
                {plan.features.map((feature) => <li key={feature} className="flex gap-2"><Check size={17} aria-hidden="true" className="shrink-0 text-gold-600" />{feature}</li>)}
              </ul>
              <Link href={free ? "/start" : "/contact"} className={cn("mt-auto rounded-full px-5 py-3 text-center text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600", index === 1 ? "bg-gold-500 text-navy-950 hover:bg-gold-400" : "bg-navy-950 text-white hover:bg-navy-800")}>
                {free ? "Start building" : `Enquire about ${plan.name}`}
              </Link>
            </article>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm text-navy-700">Storage is shared across your account. Team limits are per event. AI video and reels are paid add-ons.</p>
      <p className="mt-2 text-center text-sm text-navy-700">Paid plans are available by enquiry. Guest payment collection is coming soon.</p>

      <section aria-labelledby="pricing-explained" className="mt-14 rounded-2xl border border-navy-950/10 bg-white p-6 sm:p-8">
        <h2 id="pricing-explained" className="font-display text-2xl text-navy-950">How per-event pricing works</h2>
        <div className="mt-6 grid gap-7 text-sm text-navy-700 md:grid-cols-2">
          <div><h3 className="font-semibold text-navy-950">Pay once for one occasion</h3><p className="mt-2">Celebration costs ₹999 / $15 per event. Studio costs ₹2,499 / $35 per event. Each purchase covers one event for 12 months from publication, with no monthly subscription.</p></div>
          <div><h3 className="font-semibold text-navy-950">One celebration can span several days</h3><p className="mt-2">A wedding with several functions or a weekend reunion counts as one event. A separate celebration needs its own event purchase.</p></div>
          <div><h3 className="font-semibold text-navy-950">Subscriptions include new events each month</h3><p className="mt-2">Celebration includes 2 new events and Studio includes 10 per billing month. An event counts when first published. Drafts and edits do not use the allowance; unused events do not roll over.</p></div>
          <div><h3 className="font-semibold text-navy-950">Choose the access period that suits you</h3><p className="mt-2">A per-event purchase includes 12 months of access. Monthly subscriptions provide paid access while subscribed; they do not include 12 months for a single monthly payment.</p></div>
        </div>
      </section>
    </>
  );
}
