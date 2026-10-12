import { getEventCobrand } from "@/services/event-cobrand";

/**
 * "Powered by <agency>" line for agency-run events (services/event-cobrand.ts).
 * Renders nothing when the host hasn't set one — the default for every
 * event — so existing sites are unchanged.
 */
export async function PoweredByBand({ eventId }: { eventId: string }) {
  const cobrand = await getEventCobrand(eventId);
  if (!cobrand) return null;

  return (
    <div className="surface-feature bg-navy-950 py-5 text-center text-xs tracking-wide text-ivory-100/60">
      Event powered by{" "}
      {cobrand.url ? (
        <a
          href={cobrand.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-gold-300 underline-offset-4 hover:underline"
        >
          {cobrand.name}
        </a>
      ) : (
        <span className="font-medium text-gold-300">{cobrand.name}</span>
      )}
    </div>
  );
}
