import Link from "next/link";

import { ConsentPhotoPicker } from "@/features/reels/consent-photo-picker";

/**
 * Event Settings card for the guest-of-honour photo used by Guest Reels
 * (the same picker also lives on /admin/reels, step 2).
 */
export function HonoreeReelPhotoCard({
  eventId,
  honoreeName,
  photoUrl,
}: {
  eventId: string;
  honoreeName: string;
  photoUrl: string | null;
}) {
  return (
    <section className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg text-navy-950">Guest of honour photo — for personal reels</h2>
      <p className="mt-1 mb-4 max-w-2xl text-sm text-navy-700/65">
        A clear, front-facing photo of {honoreeName}. After the event, AI uses it to find {honoreeName} in the photos from
        the day, so each guest&apos;s reel shows them together. Set up the rest on{" "}
        <Link href="/admin/reels" className="text-gold-600 underline underline-offset-2">
          Guest Reels
        </Link>
        .
      </p>
      <ConsentPhotoPicker
        target={{ kind: "honoree", eventId }}
        currentPhotoUrl={photoUrl}
        consentLabel={
          <>
            {honoreeName} has agreed that this photo may be used to recognise them in this event&apos;s photos and to create
            personalised reels for guests.
          </>
        }
      />
    </section>
  );
}
