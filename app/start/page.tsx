import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { beginDraftAction } from "@/features/start/actions/begin";
import { BUILDER } from "@/lib/constants";

export const metadata = {
  title: "Create Your Event Site — EveryMoment",
};

/**
 * No-login entry point into the self-serve onboarding wizard. Submitting
 * creates a draft event and redirects straight into step one — no
 * account, no password, nothing to remember. The account/payment step
 * only comes at the very end, once the host can see what they've built
 * (see app/start/[token]/review/page.tsx).
 */
export default function StartPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
          <Sparkles size={26} />
        </div>
        <h1 className="mt-6 font-display text-3xl text-ivory-50 sm:text-4xl">
          Build Your Celebration Site
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ivory-100/70 sm:text-base">
          A luxury invitation &amp; memory-sharing site for your birthday, wedding,
          anniversary, or any celebration — no account needed to start. Add your
          event details, a timeline, photos, and a slideshow video (an
          AI-generated invitation card is optional), then see the whole thing
          before you create an account or pay anything.
        </p>
        <form action={beginDraftAction} className="mt-8">
          <Button type="submit" size="lg" className="w-full sm:w-auto">
            Get Started — It&rsquo;s Free to Try
          </Button>
        </form>
        <p className="mt-4 text-xs text-ivory-100/40">
          Already have an account?{" "}
          <Link href="/admin/login" className="text-gold-300 underline underline-offset-4 hover:text-gold-200">
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
