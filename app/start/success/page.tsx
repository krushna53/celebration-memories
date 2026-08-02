import Link from "next/link";
import { Heart, PartyPopper } from "lucide-react";

import { BUILDER } from "@/lib/constants";

export const metadata = {
  title: "You're All Set — EveryMoment",
};

/**
 * Stripe's checkout success_url (see features/start/actions/payment.ts)
 * — deliberately outside app/start/[token]/layout.tsx's draft-token
 * gate, since by the time the browser lands here the webhook may have
 * already flipped the draft to 'active' (claimDraftEvent), which would
 * make that layout show its "link no longer active" screen instead of
 * this success message. Takes the event by slug via query param rather
 * than depending on the now-possibly-claimed draft token.
 */
export default async function WizardSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
          <PartyPopper size={22} />
        </div>
        <h1 className="mt-4 font-display text-2xl text-ivory-50">You&rsquo;re all set!</h1>
        <p className="mt-2 text-sm text-ivory-100/70">
          Payment received — your event site is now live. It can take a moment for
          everything to finish syncing.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {slug ? (
            <a
              href={`/events/${slug}`}
              className="rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:brightness-110"
            >
              View Your Site
            </a>
          ) : null}
          <Link
            href="/admin/login"
            className="text-sm text-gold-300 underline underline-offset-4 hover:text-gold-200"
          >
            Go to your dashboard
          </Link>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ivory-100/50">
          Made with <Heart size={12} className="fill-gold-400 text-gold-400" />{" "}
          by{" "}
          <a
            href={BUILDER.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gold-300 hover:text-gold-200"
          >
            {BUILDER.name}
          </a>
        </p>
      </div>
    </div>
  );
}
