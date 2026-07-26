import { Camera, Heart, Images, Mic, PartyPopper, Share2, Video } from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";

const STEPS = [
  {
    icon: PartyPopper,
    title: "Open your personal invitation link",
    body: "The link you received (by WhatsApp or email) is unique to you — opening it automatically recognizes your name. No account or password needed.",
  },
  {
    icon: Heart,
    title: "RSVP",
    body: "Let the host know if you're coming, maybe, or can't make it — with how many adults and children, and your meal preference. You can update your response any time by opening the same link again.",
  },
  {
    icon: Camera,
    title: "Share photos",
    body: "Upload multiple photos at once, with an optional caption on each.",
  },
  {
    icon: Video,
    title: "Share a video",
    body: "Upload an existing video, or record one right in your browser — no separate app needed.",
  },
  {
    icon: Mic,
    title: "Share a voice message",
    body: "Upload an audio file, or record a short message directly from your phone or computer's microphone.",
  },
  {
    icon: Images,
    title: "Sign the guest book",
    body: "Leave a message (and optionally your country and a photo) for the host to treasure.",
  },
  {
    icon: Share2,
    title: "Everything you and other guests share",
    body: "Once approved by the host, photos, videos, voice messages, and guest book notes appear together on the public Memory Wall for everyone to enjoy.",
  },
];

/**
 * Public-facing guide explaining what a visitor/guest can do on the
 * site — separate from the admin walkthrough at /admin/help.
 */
export default function VisitorGuidePage() {
  return (
    <SiteShell honoreeName="Celebration Memories">
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="For Guests"
            title="What You Can Do Here"
            description="A quick walkthrough of everything available from your invitation link."
          />

          <div className="mt-14 grid gap-5">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.04}>
                <div className="flex items-start gap-4 rounded-2xl border border-navy-950/10 bg-white p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
                    <step.icon size={20} />
                  </span>
                  <div>
                    <h3 className="font-display text-base text-navy-950">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-navy-700/75">
                      {step.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <p className="mt-12 text-center text-sm text-navy-700/60">
            Didn&rsquo;t receive a personal invitation link? Reach out to your host
            directly — they can send you one.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
