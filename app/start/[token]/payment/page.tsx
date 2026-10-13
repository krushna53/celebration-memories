import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDraftEventByToken } from "@/services/event-drafts";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publishFreeEventFormAction } from "@/features/start/actions/payment";
import { Check } from "lucide-react";

import { EVENT_PLANS, eventPlansForSegment, type EventPlan } from "@/lib/event-plans";
import { getEventSegment } from "@/lib/event-segment";

export const dynamic = "force-dynamic";

/** What each card lists — mirrors the plan cards on /pricing (features/pricing/event-pricing-plans.tsx). */
const PLAN_DETAILS: Record<EventPlan | "free", string[]> = {
  free: ["1 event per account", "50 guests", "250 MB storage", "No payment needed"],
  celebration: ["1 event · 12 months", "300 guests", "5 GB storage", "One-time payment"],
  studio: ["1 event · 12 months", "1,000 guests", "25 GB storage", "One-time payment"],
  corporate: ["1 event · 12 months", "2,000 attendees · 50 GB", "Check-in desk & event report", "One-time payment"],
};

export default async function WizardPaymentPage({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !user.email_confirmed_at) redirect(`/start/${token}/account`);
  const ownership = await supabaseAdmin().from("events").select("owner_user_id").eq("id", event.id).single();
  if (ownership.error) throw new Error("Could not check this event’s owner.");
  if (ownership.data.owner_user_id !== user.id) redirect(`/start/${token}/account`);
  const [free, orders] = await Promise.all([
    client.from("free_event_claims").select("user_id").eq("user_id", user.id).maybeSingle(),
    client.from("plan_orders").select("id").eq("status", "paid").eq("environment", "production").is("event_id", null),
  ]);
  if (free.error || orders.error) throw new Error("Could not load your plans. Please try again.");
  const error = (await searchParams).error;
  const button = "mt-5 inline-block rounded-full bg-gold-500 px-5 py-3 font-medium text-navy-950";
  const segment = getEventSegment(event.category);
  const planKeys = eventPlansForSegment(segment);
  const wide = planKeys.length > 2;
  // Recommended plan: Corporate Event for corporate drafts, Celebration otherwise (same as /pricing).
  const recommended: EventPlan = segment === "corporate" ? "corporate" : "celebration";
  // One full-width, single-line action pinned to the bottom of every card so all buttons line up.
  const cardButton = "inline-flex w-full items-center justify-center whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-luxury duration-200";
  const primaryButton = `${cardButton} bg-gold-500 text-navy-950 hover:brightness-105`;
  const secondaryButton = `${cardButton} border border-navy-950/15 bg-white text-navy-950 hover:border-navy-950/30`;
  return <div className={wide ? "mx-auto max-w-6xl px-4 py-12 text-navy-950" : "mx-auto max-w-4xl px-4 py-12 text-navy-950"}>
    <h1 className="font-display text-3xl">Publish your event page</h1>
    <p className="mt-2">{event.honoreeName} · Your draft is saved. Choose how to publish it.</p>
    {error && <p role="alert" className="mt-4 rounded-xl border bg-white p-4 text-red-700">{error}</p>}
    {!!orders.data?.length && <div className="mt-6 rounded-xl border bg-white p-5">
      <p>You have {orders.data.length} unused paid {orders.data.length === 1 ? "purchase" : "purchases"}. Apply one to this event without paying again.</p>
      <Link href="/account/billing" className={button}>Use an existing purchase</Link>
    </div>}
    <div className={wide ? "mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : "mt-8 grid gap-4 md:grid-cols-3"}>
      <section className="flex flex-col rounded-2xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-xl">Free</h2>
        <p className="mt-2 font-display text-3xl">₹0</p>
        <ul className="mt-4 space-y-2 text-sm text-navy-700">
          {PLAN_DETAILS.free.map((line) => <li key={line} className="flex gap-2"><Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-gold-600" />{line}</li>)}
        </ul>
        <div className="mt-auto pt-6">
          {free.data
            ? <p className="text-sm text-navy-700/70">Your free event has been used. Choose a paid plan for this event.</p>
            : <form action={publishFreeEventFormAction.bind(null, token, event.id)}><button className={secondaryButton}>Publish for free</button></form>}
        </div>
      </section>
      {planKeys.map((key) => {
        const plan = EVENT_PLANS[key];
        const isRecommended = key === recommended;
        return <section key={key} className={isRecommended ? "relative flex flex-col rounded-2xl border-2 border-gold-500 bg-white p-5 shadow-md" : "flex flex-col rounded-2xl border border-navy-950/10 bg-white p-5"}>
          {isRecommended ? <p className="absolute -top-3 left-5 rounded-full bg-gold-500 px-2.5 py-0.5 text-xs font-semibold text-navy-950">Recommended</p> : null}
          <h2 className="font-display text-xl">{plan.name}</h2>
          <p className="mt-2 font-display text-3xl">₹{(plan.amountPaise / 100).toLocaleString("en-IN")}</p>
          <ul className="mt-4 space-y-2 text-sm text-navy-700">
            {PLAN_DETAILS[key].map((line) => <li key={line} className="flex gap-2"><Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-gold-600" />{line}</li>)}
          </ul>
          <div className="mt-auto pt-6">
            <Link href={`/account/billing?plan=${key}`} className={isRecommended ? primaryButton : secondaryButton}>Choose {plan.name}</Link>
          </div>
        </section>;
      })}
    </div>
    <p className="mt-6 text-sm">Paid checkout uses Cashfree. After payment, apply your purchase to this event in My account &amp; billing.</p>
    <p className="mt-3 text-sm">Monthly subscriptions are not available for checkout yet. <Link href="/contact" className="underline">Contact us</Link> for monthly plans.</p>
    <div className="mt-6 flex flex-wrap gap-5 text-sm"><Link href="/pricing" className="underline">Compare plan features</Link><Link href={`/start/${token}/review`} className="underline">Back to review</Link></div>
  </div>;
}
