import { LayoutTemplate, MessageCircle, Images } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

const STEPS = [
  {
    icon: LayoutTemplate,
    title: "Create your page",
    body: "Pick the occasion and a template, add the date, venue and a few photos. About 10 minutes, no designer needed.",
  },
  {
    icon: MessageCircle,
    title: "Share it on WhatsApp",
    body: "Every guest gets their own link. They RSVP and choose their meal in a tap — no app, no login.",
  },
  {
    icon: Images,
    title: "Collect the memories",
    body: "Guests add photos, videos and voice wishes from their phones. Play them on the big screen and keep them forever.",
  },
] as const;

/**
 * Homepage "How it works" — three steps between the video testimonial and
 * the features, answering "is this hard to set up?" before the feature
 * list does the detail.
 */
export function HowItWorksSection() {
  return (
    <section aria-labelledby="how-it-works-heading" className="bg-ivory-50 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div id="how-it-works-heading">
          <SectionHeading eyebrow="How It Works" title="Ready In Three Steps" />
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="h-full">
              <Reveal className="h-full">
                <div className="relative h-full rounded-2xl border border-navy-950/10 bg-white p-6 pt-8">
                  <span className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-gold-500 text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <step.icon size={24} className="text-gold-600" aria-hidden="true" />
                  <h3 className="mt-3 font-display text-xl text-navy-950">{step.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-navy-700/75">{step.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
