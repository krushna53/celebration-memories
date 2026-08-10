import type { Metadata } from "next";
import { Heart, MessageCircle, Share2, Sparkles } from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { BUILDER, SITE_NAME, SUPPORT } from "@/lib/constants";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";

export const metadata: Metadata = {
  title: `Support ${SITE_NAME} | Help It Grow`,
  description: `${SITE_NAME} is built and maintained by ${BUILDER.name}. If it helped make your event special, here's how you can support its growth.`,
};

const WAYS_TO_HELP = [
  {
    icon: Heart,
    title: "Chip in toward hosting & AI costs",
    description:
      "Every event site, guest upload, and AI-generated image or video runs on real infrastructure — Supabase, Netlify, and paid AI APIs. A contribution goes straight toward keeping the platform fast and free to try.",
  },
  {
    icon: Share2,
    title: "Tell someone planning an event",
    description:
      "The easiest way to help is word of mouth — if a friend or family member has a birthday, wedding, or celebration coming up, point them to EveryMoment.",
  },
  {
    icon: Sparkles,
    title: "Send feature ideas or feedback",
    description:
      "This platform grows from real requests. If something felt clunky, or you wished it did one more thing, that feedback directly shapes what gets built next.",
  },
  {
    icon: MessageCircle,
    title: "Leave a testimonial",
    description:
      "A short note about your experience helps the next host trust the platform enough to try it — reach out on WhatsApp and we'll add it with your permission.",
  },
] as const;

export default function DonatePage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-navy-950 pb-20 pt-28 text-center text-ivory-50 sm:pt-32">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.35em] text-gold-300">Support The Project</p>
            <h1 className="mt-5 font-display text-3xl sm:text-4xl">
              Help {SITE_NAME} Keep Growing
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ivory-100/75">
              {SITE_NAME} is an independent project built and maintained by {BUILDER.name} — not backed by a big
              company. If it helped make your event a little more special, contributing back helps keep it free to
              try, fast to use, and growing with new features.
            </p>
            <Button size="lg" className="mt-8" asChild>
              <a href={SUPPORT.url} target="_blank" rel="noopener noreferrer">
                Support on WhatsApp
              </a>
            </Button>
          </Reveal>
        </div>
      </div>

      <div className="bg-ivory-50 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Every Bit Helps"
            title="Ways To Support"
            description="A contribution isn't the only way to help — here's everything that makes a real difference."
          />
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {WAYS_TO_HELP.map((way) => (
              <Reveal key={way.title}>
                <div className="h-full rounded-2xl border border-navy-950/10 bg-white p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
                    <way.icon size={20} />
                  </div>
                  <h3 className="mt-4 font-display text-xl text-navy-950">{way.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-navy-700/75">{way.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-navy-950 py-16 text-center text-ivory-50 sm:py-20">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl">Ready to help out?</h2>
            <p className="mt-4 text-sm text-ivory-100/75 sm:text-base">
              Message {BUILDER.name} on WhatsApp — we&rsquo;ll share how to contribute and thank you personally.
            </p>
            <Button size="lg" className="mt-7" asChild>
              <a href={SUPPORT.url} target="_blank" rel="noopener noreferrer">
                Get In Touch
              </a>
            </Button>
          </Reveal>
        </div>
      </div>
    </SiteShell>
  );
}
