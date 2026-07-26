import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import type { TimelineMilestoneRecord } from "@/types/content";

interface TimelineSectionProps {
  milestones: TimelineMilestoneRecord[];
}

/**
 * Animated vertical timeline of life milestones, managed from
 * /admin/timeline (see services/timeline.ts). Dark navy background to
 * mirror the Hero/Countdown treatment and let the gold line + dots
 * stand out. Renders nothing if no milestones have been added yet.
 */
export function TimelineSection({ milestones }: TimelineSectionProps) {
  if (milestones.length === 0) return null;

  return (
    <section id="timeline" className="bg-navy-950 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal>
          <SectionHeading
            tone="dark"
            eyebrow="A Journey Through Time"
            title="Life Timeline"
            description="A look back at the chapters that shaped this story."
          />
        </Reveal>

        <ol className="relative mt-16 border-s border-gold-500/25 ps-8 sm:ps-10">
          {milestones.map((milestone, index) => (
            <Reveal key={milestone.id} delay={index * 0.08}>
              <li className="relative pb-12 last:pb-0">
                <span className="absolute -start-[calc(2rem+5px)] top-1 h-2.5 w-2.5 rounded-full bg-gold-400 ring-4 ring-navy-950 sm:-start-[calc(2.5rem+5px)]" />
                <p className="text-xs uppercase tracking-[0.3em] text-gold-300/90">
                  {milestone.period}
                </p>
                <h3 className="mt-2 font-display text-xl text-ivory-50 sm:text-2xl">
                  {milestone.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ivory-100/70 sm:text-base">
                  {milestone.description}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
