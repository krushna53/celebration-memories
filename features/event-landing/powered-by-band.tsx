import { getEventCobrand } from "@/services/event-cobrand";

/**
 * "Powered by <organiser>" line (with logo when they have one) for events run by a planner or agency (services/event-cobrand.ts).
 * Renders nothing when the host hasn't set one — the default for every
 * event — so existing sites are unchanged.
 */
export async function PoweredByBand({ eventId }: { eventId: string }) {
  const cobrand = await getEventCobrand(eventId);
  if (!cobrand) return null;

  return (
    <div className="surface-feature flex items-center justify-center gap-2.5 bg-navy-950 py-5 text-center text-xs tracking-wide text-ivory-100/60">
      {cobrand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cobrand.logoUrl} alt="" className="h-7 w-auto max-w-[120px] rounded bg-white/90 object-contain p-0.5" />
      ) : null}
      <span>
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
      </span>
    </div>
  );
}
