import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDraftEventByToken } from "@/services/event-drafts";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publishFreeEventFormAction } from "@/features/start/actions/payment";
import { EVENT_PLANS } from "@/lib/event-plans";

export const dynamic = "force-dynamic";

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
  return <div className="mx-auto max-w-4xl px-4 py-12 text-navy-950">
    <h1 className="font-display text-3xl">Publish your event page</h1>
    <p className="mt-2">{event.honoreeName} · Your draft is saved. Choose how to publish it.</p>
    {error && <p role="alert" className="mt-4 rounded-xl border bg-white p-4 text-red-700">{error}</p>}
    {!!orders.data?.length && <div className="mt-6 rounded-xl border bg-white p-5">
      <p>You have {orders.data.length} unused paid {orders.data.length === 1 ? "purchase" : "purchases"}. Apply one to this event without paying again.</p>
      <Link href="/account/billing" className={button}>Use an existing purchase</Link>
    </div>}
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      <section className="rounded-xl border bg-white p-5"><h2 className="font-display text-xl">Free</h2><p className="mt-2 text-2xl">₹0</p>
        <p className="mt-3 text-sm">1 event per account · No payment needed</p>
        {free.data ? <p className="mt-5 text-sm">Your free event has been used. Choose a paid plan for this event.</p> : <form action={publishFreeEventFormAction.bind(null, token, event.id)}><button className={button}>Publish for free</button></form>}
      </section>
      {Object.entries(EVENT_PLANS).map(([key, plan]) => <section key={key} className="rounded-xl border bg-white p-5"><h2 className="font-display text-xl">{plan.name}</h2><p className="mt-2 text-2xl">₹{(plan.amountPaise / 100).toLocaleString("en-IN")}</p><p className="mt-3 text-sm">1 event · 12 months · One-time payment</p><Link href={`/account/billing?plan=${key}`} className={button}>Choose {plan.name}</Link></section>)}
    </div>
    <p className="mt-6 text-sm">Paid checkout uses Cashfree. After payment, apply your purchase to this event in My account &amp; billing.</p>
    <p className="mt-3 text-sm">Monthly subscriptions are not available for checkout yet. <Link href="/contact" className="underline">Contact us</Link> for monthly plans.</p>
    <div className="mt-6 flex flex-wrap gap-5 text-sm"><Link href="/pricing" className="underline">Compare plan features</Link><Link href={`/start/${token}/review`} className="underline">Back to review</Link></div>
  </div>;
}
