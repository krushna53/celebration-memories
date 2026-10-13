import { getCardArtworkUrl } from "@/services/card-artwork";

/**
 * The illustration from the event's invitation card (services/card-artwork.ts),
 * shown right under the hero so the site carries the card's artwork.
 * Renders nothing when the event has none — the default for every event.
 */
export async function CardArtworkBand({ eventId, alt }: { eventId: string; alt: string }) {
  const url = await getCardArtworkUrl(eventId);
  if (!url) return null;
  return (
    <section aria-label="Invitation artwork" className="bg-ivory-50 px-4 py-12 sm:py-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="mx-auto h-auto w-full max-w-2xl rounded-2xl object-contain" loading="lazy" />
    </section>
  );
}
