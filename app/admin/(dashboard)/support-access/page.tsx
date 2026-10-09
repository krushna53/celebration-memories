import Link from "next/link";
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
  return <div><h1 className="font-display text-2xl">Temporary support access</h1>
    <p className="my-4">Choose an event to request customer approval. Events without a customer owner cannot grant access.</p>
    <ul className="mb-8 flex flex-wrap gap-4">{events.map(e => <li key={e.id}><Link className="underline" href={`/admin/support-access?event=${e.id}`}>{e.honoreeName}</Link></li>)}</ul>
    {event && <PrivacyPanel eventId={event.id} mode="public" isOwner={false} {...await supportHistory(event.id)} />}
  </div>;
}
