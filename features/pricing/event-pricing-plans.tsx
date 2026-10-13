"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const plans = [
  { name: "Free", price: "₹0", usd: "$0", guests: "50 guests", storage: "250 MB", team: "Owner only", plan: null },
  { name: "Celebration", price: "₹999", usd: "$15", guests: "300 guests", storage: "5 GB", team: "3 team members", plan: "celebration" },
  { name: "Studio", price: "₹2,499", usd: "$35", guests: "1,000 guests", storage: "25 GB", team: "10 team members", plan: "studio" },
  {
    name: "Corporate Event",
    price: "₹4,999",
    usd: "$69",
    guests: "2,000 attendees",
    storage: "50 GB",
    team: "20 team members",
    plan: "corporate",
    extras: ["Check-in desk for your team", "Printable event report", "\"Powered by\" your business"],
  },
] as const;

/**
 * For anyone running events for others — wedding planners, agencies,
 * corporate events teams. Sold by enquiry until subscription checkout
 * exists; branding itself (/admin/branding) works on every account today.
 */
const ORGANISER_PLANS = [
  {
    name: "Organiser Starter",
    price: "₹1,999 / month",
    annual: "or ₹19,999 / year",
    features: ["5 active events", "300 guests per event", "Your logo and \"Powered by\" on every event", "Client logins, check-in desk, event report", "10 GB shared storage"],
  },
  {
    name: "Organiser Pro",
    price: "₹4,999 / month",
    annual: "or ₹49,999 / year",
    features: ["20 active events", "1,000 guests per event", "Your brand in your clients' dashboard too", "Everything in Starter", "50 GB shared storage · priority WhatsApp support"],
    highlight: true,
  },
  {
    name: "White-label",
    price: "From ₹1,50,000 / year",
    annual: "custom volume",
    features: ["EveryMoment branding removed", "Your own domain", "Custom event and guest limits", "Dedicated support"],
  },
];

const ADD_ONS = [
  { name: "Personal attendee reels", price: "₹49 each · 100 for ₹3,999" },
  { name: "Extra slideshow video renders", price: "₹199 each" },
  { name: "AI host on the event site", price: "₹999 per event" },
  { name: "Extra storage", price: "₹99 per 10 GB / month" },
];

const ORGANISER_WHATSAPP_URL =
  "https://wa.me/919987982969?text=" + encodeURIComponent("Hi, I organise events and would like to know more about the Organiser plans.");

export function EventPricingPlans() {
  return <>
    <p className="text-center text-navy-700">Pay once for one event. Paid plans include 12 months. No auto-renewal.</p>
    <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan, index) => <article key={plan.name} className={cn("flex flex-col rounded-2xl border bg-white p-6", index === 1 ? "border-gold-500 shadow-md" : "border-navy-950/10")}>
        <h2 className="font-display text-2xl text-navy-950">{plan.name}</h2>
        <p className="mt-4 font-display text-4xl text-navy-950">{plan.price}<span className="ml-2 font-sans text-sm text-navy-700">{index ? "/ event" : "forever"}</span></p>
        <p className="mt-2 text-sm text-navy-700">USD: {plan.usd}{index ? " / event · enquire" : ""}</p>
        <ul className="my-6 space-y-3 text-sm text-navy-700">
          {[index ? "1 event · 12 months" : "1 free event per account", plan.guests, `${plan.storage} storage`, plan.team, ...("extras" in plan ? plan.extras : [])].map(feature => <li key={feature} className="flex gap-2"><Check size={17} aria-hidden="true" className="shrink-0 text-gold-600"/>{feature}</li>)}
        </ul>
        <Link href={plan.plan ? `/account/billing?plan=${plan.plan}` : "/start"} className={cn("mt-auto rounded-full px-4 py-3 text-center text-sm font-semibold", index === 1 ? "bg-gold-500 text-navy-950" : "bg-navy-950 text-white")}>{plan.plan ? `Choose ${plan.name}` : "Start free"}</Link>
      </article>)}
    </div>
    <p className="mt-6 text-center text-sm text-navy-700">Every plan includes an event page, RSVP, schedule and photo memories.</p>
    <p className="mt-2 text-center text-xs text-navy-700">Checkout charges INR. <Link href="/contact" className="underline">Contact us for USD pricing.</Link> AI video and reels cost extra.</p>

    <section id="organisers" className="mt-14" aria-labelledby="organiser-plans-heading">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-600">For event organisers</p>
        <h2 id="organiser-plans-heading" className="mt-2 font-display text-2xl text-navy-950 sm:text-3xl">Run events for others? Use your own brand.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-navy-700">
          Wedding planners, event agencies and corporate events teams: manage many events from one login, with your logo on
          every event. <Link href="/corporate" className="underline">See how it works for corporate events</Link>.
        </p>
      </div>
      <div className="mt-7 grid gap-5 md:grid-cols-3">
        {ORGANISER_PLANS.map((plan) => <article key={plan.name} className={cn("flex flex-col rounded-2xl p-6", plan.highlight ? "bg-navy-950 text-ivory-50" : "border border-navy-950/10 bg-white text-navy-950")}>
          <h3 className={cn("font-display text-xl", plan.highlight ? "text-gold-300" : "text-navy-950")}>{plan.name}</h3>
          <p className="mt-3 font-display text-2xl">{plan.price}</p>
          <p className={cn("text-xs", plan.highlight ? "text-ivory-100/70" : "text-navy-700")}>{plan.annual}</p>
          <ul className={cn("my-5 space-y-2.5 text-sm", plan.highlight ? "text-ivory-100/85" : "text-navy-700")}>
            {plan.features.map(feature => <li key={feature} className="flex gap-2"><Check size={16} aria-hidden="true" className={cn("mt-0.5 shrink-0", plan.highlight ? "text-gold-300" : "text-gold-600")}/>{feature}</li>)}
          </ul>
          <a href={ORGANISER_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={cn("mt-auto rounded-full px-4 py-3 text-center text-sm font-semibold", plan.highlight ? "bg-gold-500 text-navy-950" : "bg-navy-950 text-white")}>Talk to us</a>
        </article>)}
      </div>
      <p className="mt-4 text-center text-xs text-navy-700">Organiser plans are set up with you directly while self-serve sign-up is being built. Annual billing saves about two months.</p>
    </section>

    <section className="mt-10 rounded-2xl border border-navy-950/10 bg-white p-6" aria-labelledby="add-ons-heading">
      <h2 id="add-ons-heading" className="font-display text-xl text-navy-950">Add-ons</h2>
      <p className="mt-1 text-sm text-navy-700">For the extras that cost us per use. Add them to any plan.</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {ADD_ONS.map((addOn) => <div key={addOn.name} className="flex items-baseline justify-between gap-4 border-b border-navy-950/5 pb-2 text-sm">
          <dt className="text-navy-950">{addOn.name}</dt>
          <dd className="shrink-0 text-navy-700">{addOn.price}</dd>
        </div>)}
      </dl>
      <a href={ORGANISER_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-semibold underline">Ask about add-ons</a>
    </section>

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
