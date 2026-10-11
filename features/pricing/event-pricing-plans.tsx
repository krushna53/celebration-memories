"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const plans = [
  { name: "Free", price: "₹0", usd: "$0", guests: "50 guests", storage: "250 MB", team: "Owner only" },
  { name: "Celebration", price: "₹999", usd: "$15", guests: "300 guests", storage: "5 GB", team: "3 team members" },
  { name: "Studio", price: "₹2,499", usd: "$35", guests: "1,000 guests", storage: "25 GB", team: "10 team members" },
];

export function EventPricingPlans() {
  return <>
    <p className="text-center text-navy-700">Pay once for one event. Paid plans include 12 months. No auto-renewal.</p>
    <div className="mt-7 grid gap-5 lg:grid-cols-3">
      {plans.map((plan, index) => <article key={plan.name} className={cn("flex flex-col rounded-2xl border bg-white p-6", index === 1 ? "border-gold-500 shadow-md" : "border-navy-950/10")}>
        <h2 className="font-display text-2xl text-navy-950">{plan.name}</h2>
        <p className="mt-4 font-display text-4xl text-navy-950">{plan.price}<span className="ml-2 font-sans text-sm text-navy-700">{index ? "/ event" : "forever"}</span></p>
        <p className="mt-2 text-sm text-navy-700">USD: {plan.usd}{index ? " / event · enquire" : ""}</p>
        <ul className="my-6 space-y-3 text-sm text-navy-700">
          {[index ? "1 event · 12 months" : "1 free event per account", plan.guests, `${plan.storage} storage`, plan.team].map(feature => <li key={feature} className="flex gap-2"><Check size={17} aria-hidden="true" className="shrink-0 text-gold-600"/>{feature}</li>)}
        </ul>
        <Link href={index ? `/account/billing?plan=${index === 1 ? "celebration" : "studio"}` : "/start"} className={cn("mt-auto rounded-full px-4 py-3 text-center text-sm font-semibold", index === 1 ? "bg-gold-500 text-navy-950" : "bg-navy-950 text-white")}>{index ? `Choose ${plan.name}` : "Start free"}</Link>
      </article>)}
    </div>
    <p className="mt-6 text-center text-sm text-navy-700">Every plan includes an event page, RSVP, schedule and photo memories.</p>
    <p className="mt-2 text-center text-xs text-navy-700">Checkout charges INR. <Link href="/contact" className="underline">Contact us for USD pricing.</Link> AI video and reels cost extra.</p>
    <details className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 text-sm text-navy-700">
      <summary className="cursor-pointer font-semibold text-navy-950">Host regularly? View monthly plans</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <p><strong>Celebration — ₹499 / $7 monthly</strong><br/>2 new events / month · Up to 5 active events</p>
        <p><strong>Studio — ₹1,499 / $19 monthly</strong><br/>10 new events / month · Up to 25 active events</p>
      </div>
      <p className="mt-4">Monthly plans are available by enquiry. Access lasts while subscribed; unused event allowances do not roll over.</p>
      <Link href="/contact" className="mt-3 inline-block font-semibold underline">Enquire about monthly plans</Link>
    </details>
    <details className="mt-3 rounded-xl border border-navy-950/10 bg-white p-5 text-sm text-navy-700">
      <summary className="cursor-pointer font-semibold text-navy-950">What counts as one event?</summary>
      <p className="mt-3">One occasion, even over several days. After payment, choose your event in My account to start its 12 months of access.</p>
    </details>
  </>;
}
