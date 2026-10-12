import Link from "next/link";
import { Briefcase, Heart, Sparkles } from "lucide-react";

import { beginDraftAction } from "@/features/start/actions/begin";
import { BUILDER } from "@/lib/constants";
import { SEGMENT_COPY, type EventSegment } from "@/lib/event-segment";

const SEGMENT_CHOICES: { segment: EventSegment; icon: typeof Heart }[] = [
  { segment: "family", icon: Heart },
  { segment: "corporate", icon: Briefcase },
];

export const metadata = {
  title: "Create Your Event Site — EveryMoment",
};

/**
 * No-login entry point into the self-serve onboarding wizard. Submitting
 * creates a draft event and redirects straight into step one — no
 * account, no password, nothing to remember. The account/payment step
 * only comes at the very end, once the host can see what they've built
 * (see app/start/[token]/review/page.tsx).
 *
 * The first question is family vs. corporate (lib/event-segment.ts):
 * each card is a submit button carrying `segment`, so the choice works
 * without client JS and only decides the wizard's starting defaults.
 */
export default function StartPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4 py-16">
      <div className="w-full max-w-2xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
          <Sparkles size={26} />
        </div>
        <h1 className="mt-6 font-display text-3xl text-ivory-50 sm:text-4xl">
          Build Your Event Site
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ivory-100/70 sm:text-base">
          Invitations, RSVPs, check-in, photo sharing and a slideshow video — for a
          family celebration or a corporate event. No account needed to start: see
          the whole thing before you create an account or pay anything.
        </p>
        <form action={beginDraftAction} className="mt-8 grid gap-3 sm:grid-cols-2">
          <p className="text-xs uppercase tracking-[0.25em] text-gold-300/80 text-center sm:col-span-2">
            What kind of event is it?
          </p>
          {SEGMENT_CHOICES.map(({ segment, icon: Icon }) => (
            <button
              key={segment}
              type="submit"
              name="segment"
              value={segment}
              className="group flex items-start gap-4 rounded-2xl text-left border border-gold-500/25 bg-ivory-50/5 p-5 transition-luxury duration-300 hover:border-gold-400 hover:bg-gold-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-300 group-hover:bg-gold-500 group-hover:text-navy-950">
                <Icon size={20} />
              </span>
              <span>
                <span className="block font-display text-lg text-ivory-50">{SEGMENT_COPY[segment].label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-ivory-100/60">
                  {SEGMENT_COPY[segment].tagline}
                </span>
              </span>
            </button>
          ))}
          <p className="text-center text-xs text-ivory-100/40 sm:col-span-2">Free to try — you can switch on the next step.</p>
        </form>
        <p className="mt-4 text-xs text-ivory-100/40">
          Already have an account?{" "}
          <Link href="/login" className="text-gold-300 underline underline-offset-4 hover:text-gold-200">
            Sign in
          </Link>
        </p>
        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-ivory-100/50">
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
