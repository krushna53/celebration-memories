import { Clapperboard, Sparkles } from "lucide-react";

import { SITE_URL } from "@/lib/constants";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { ConsentPhotoPicker } from "@/features/reels/consent-photo-picker";
import { ReelSharePanel } from "@/features/reels/reel-share-panel";
import { getGuestReelForInvitee, getInviteeReelOptIn } from "@/services/guest-reels";
import { getSegmentCopy } from "@/lib/event-segment";
import type { EventCategory } from "@/types/event";

interface GuestReelSectionProps {
  token: string;
  inviteeId: string;
  guestName: string;
  honoreeName: string;
  /** Family vs. corporate reel wording (lib/event-segment.ts). */
  category?: EventCategory | null;
  hostedBy: string;
}

/**
 * After-the-event block on a guest's invite page: their finished reel
 * with share buttons, a "being made" note while it renders, or — if they
 * never added a selfie — a last chance to opt in. Only rendered when the
 * host has turned Guest Reels on (see app/invite/[token]/page.tsx).
 */
export async function GuestReelSection({ token, inviteeId, guestName, honoreeName, hostedBy, category }: GuestReelSectionProps) {
  const reelsCopy = getSegmentCopy(category).reels;
  const [reel, optIn] = await Promise.all([getGuestReelForInvitee(inviteeId), getInviteeReelOptIn(inviteeId)]);
  const first = guestName.trim().split(/\s+/)[0] ?? guestName;

  if (reel?.videoUrl) {
    return (
      <section id="reel" className="mx-auto mt-12 max-w-xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Made just for you"
            title={`${first}, your reel is ready`}
            description={reelsCopy.readyDescription(honoreeName)}
          />
        </Reveal>
        <Reveal delay={0.1} className="mt-8">
          <ReelSharePanel
            videoUrl={reel.videoUrl}
            shareUrl={`${SITE_URL}/reels/${reel.shareToken}`}
            shareText={reelsCopy.shareText(honoreeName)}
            fileName={`${first.toLowerCase()}-reel`}
          />
        </Reveal>
      </section>
    );
  }

  return (
    <section id="reel" className="mx-auto mt-12 max-w-xl px-4 sm:px-6">
      <div className="rounded-2xl border border-gold-500/20 bg-white px-6 py-7 text-left shadow-sm">
        <div className="flex items-center gap-2 text-gold-600">
          {optIn.optedIn ? <Clapperboard size={18} /> : <Sparkles size={18} />}
          <p className="text-xs font-medium uppercase tracking-[0.2em]">Your personal reel</p>
        </div>
        {optIn.optedIn ? (
          <p className="mt-2 text-sm text-navy-700/80">
            {reel && (reel.status === "queued" || reel.status === "rendering")
              ? "Your reel is being made right now — check back in a few minutes."
              : reelsCopy.waiting(hostedBy, honoreeName)}
          </p>
        ) : (
          <p className="mt-2 text-sm text-navy-700/80">
            {reelsCopy.invite(honoreeName)}
          </p>
        )}
        <div className="mt-4">
          <ConsentPhotoPicker
            target={{ kind: "guest", token }}
            currentPhotoUrl={optIn.photoUrl}
            compact
            consentLabel={
              <>
                I agree that {hostedBy} may use this photo to recognise my face in this event&apos;s photos and make a
                personal reel for me. It&apos;s used only for this event, and I can remove it at any time from this page.
              </>
            }
          />
        </div>
      </div>
    </section>
  );
}
