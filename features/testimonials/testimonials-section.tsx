import Link from "next/link";
import { MessageSquareHeart } from "lucide-react";

import { getApprovedTestimonials } from "@/services/testimonials";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { TestimonialCarousel } from "@/features/testimonials/testimonial-carousel";

/**
 * "What Our Hosts Say" — sits just below the homepage hero (see
 * features/platform/platform-marketing-content.tsx). Pulls only
 * approved testimonials (services/testimonials.ts) — nothing here is
 * fabricated placeholder content, so the section shows a genuine "be
 * the first" empty state until a real host submits one via
 * /testimonials/share and the owner approves it at /admin/testimonials.
 */
export async function TestimonialsSection() {
  let testimonials: Awaited<ReturnType<typeof getApprovedTestimonials>> = [];
  try {
    testimonials = await getApprovedTestimonials();
  } catch (err) {
    console.error("TestimonialsSection failed to load:", err);
  }

  return (
    <div className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Real Hosts, Real Celebrations"
          title="What Our Hosts Say"
          description="Stories from the people who've built their event site with us."
        />

        <div className="mt-14">
          {testimonials.length > 0 ? (
            <Reveal>
              <TestimonialCarousel testimonials={testimonials} />
            </Reveal>
          ) : (
            <Reveal>
              <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-dashed border-navy-950/15 py-16 text-center text-navy-700/60">
                <MessageSquareHeart size={28} className="text-gold-500" />
                <p className="text-sm">No stories shared yet — be the first to tell us about your event.</p>
              </div>
            </Reveal>
          )}
        </div>

        <div className="mt-8 flex justify-center">
          <Button variant="outline" asChild>
            <Link href="/testimonials/share">Share Your Experience</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
