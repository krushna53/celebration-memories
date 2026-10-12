import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireOwner } from "@/services/admin-auth";
import { listAllActiveEvents } from "@/services/events";
import { supportHistory } from "@/services/support-access";
import { PrivacyPanel } from "@/features/privacy/privacy-panel";
export const dynamic = "force-dynamic";
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  await requireOwner();
  const events = await listAllActiveEvents();
  const eventId = (await searchParams).event;
  const event = events.find(e => e.id === eventId);
  const owner = event ? await supabaseAdmin().from("events").select("owner_user_id").eq("id", event.id).single() : null;
  if (owner?.error) throw new Error("Could not load the selected event.");
  return <div><h1 className="font-display text-2xl">Temporary support access</h1>
    <p className="my-4">Choose an event to request customer approval. Events without a customer owner cannot grant access.</p>
    <ul className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{events.map(e => <li key={e.id}><Link aria-current={event?.id === e.id ? "true" : undefined} className={`block rounded-xl border p-4 ${event?.id === e.id ? "border-gold-500 bg-gold-500/15 ring-2 ring-gold-500" : "bg-white hover:border-gold-500"}`} href={`/admin/support-access?event=${e.id}`}>
      <span className="block font-medium">{e.honoreeName}{event?.id === e.id ? " · Selected" : ""}</span><span className="mt-1 block break-all text-xs text-navy-700">{e.slug}</span>
    </Link></li>)}</ul>
    {!event && <p className="rounded-xl border bg-white p-5">{eventId ? "That event is unavailable. Choose another event above." : "Select an event above to view its support requests."}</p>}
    {event && <h2 className="mb-4 font-display text-xl">Selected event: {event.honoreeName}</h2>}
    {event && !owner?.data?.owner_user_id && <p className="mb-4 rounded-xl border bg-white p-5">This event has no customer owner yet. Assign a customer from All Events before requesting support access.</p>}
    {event && owner?.data?.owner_user_id && <PrivacyPanel key={event.id} eventId={event.id} mode="public" isOwner={false} {...await supportHistory(event.id)} />}
  </div>;
}
