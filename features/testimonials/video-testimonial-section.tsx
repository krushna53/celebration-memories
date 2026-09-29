import Link from "next/link";
import { CheckCircle2, ChevronDown, Star } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { VIDEO_TESTIMONIALS } from "@/lib/video-testimonials";
import { getApprovedTestimonials } from "@/services/testimonials";
import { StartBuildingButton } from "@/features/start/start-building-button";
import { VideoTestimonialPlayer } from "@/features/testimonials/video-testimonial-player";

/**
 * A real host's video review, straight under the homepage hero — proof
 * first, then the "try it" button. The host's written review opens
 * under "Read full review" (only if it's approved), and the "Share your
 * experience" link lives here so it's always reachable — the "What Our
 * Hosts Say" carousel further down stays hidden until there are enough
 * different hosts to show. Content comes from lib/video-testimonials.ts.
 */
export async function VideoTestimonialSection() {
  const testimonial = VIDEO_TESTIMONIALS[0];
  if (!testimonial) return null;

  let review: Awaited<ReturnType<typeof getApprovedTestimonials>>[number] | null = null;
  if (testimonial.reviewId) {
    try {
      review = (await getApprovedTestimonials(50)).find((t) => t.id === testimonial.reviewId) ?? null;
    } catch (err) {
      console.error("VideoTestimonialSection: couldn't load the written review:", err);
    }
  }

  return (
    <section aria-labelledby="video-testimonial-heading" className="bg-white py-16 sm:py-24">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[300px_1fr] md:gap-14">
        <Reveal>
          <VideoTestimonialPlayer testimonial={testimonial} />
        </Reveal>

        <Reveal>
          <div className="text-center md:text-left">
            <p className="text-xs uppercase tracking-[0.25em] text-gold-600">Hear It From A Real Host</p>
            <h2 id="video-testimonial-heading" className="mt-3 font-display text-3xl leading-tight text-navy-950 sm:text-4xl">
              &ldquo;{testimonial.quote}&rdquo;
            </h2>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-navy-700/70 md:justify-start">
              <span className="flex text-amber-400" aria-label="Rated 5 out of 5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={16} fill="currentColor" aria-hidden="true" />
                ))}
              </span>
              <span>
                {testimonial.name}, {testimonial.location} · {testimonial.occasion}
              </span>
            </div>

            <ul className="mx-auto mt-6 grid max-w-md gap-2.5 text-left text-sm text-navy-700/85 sm:text-base md:mx-0">
              {testimonial.highlights.map((point) => (
                <li key={point} className="flex gap-2.5">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-gold-500" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            {review ? (
              <details className="group mx-auto mt-6 max-w-md text-left md:mx-0">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-gold-600 hover:text-gold-500 [&::-webkit-details-marker]:hidden">
                  Read {testimonial.name}&rsquo;s full review
                  <ChevronDown size={16} className="transition group-open:rotate-180" aria-hidden="true" />
                </summary>
                <blockquote className="mt-3 whitespace-pre-line rounded-2xl border border-navy-950/10 bg-ivory-50 p-5 text-sm leading-relaxed text-navy-700/85">
                  {review.message}
                  <footer className="mt-3 text-xs text-navy-700/60">
                    — {review.name}, {review.country}
                  </footer>
                </blockquote>
              </details>
            ) : null}

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row md:justify-start">
              <StartBuildingButton size="lg">Build Your Event Page — Free to Try</StartBuildingButton>
            </div>
            <p className="mt-4 text-xs text-navy-700/60">
              Hosted an event with us?{" "}
              <Link href="/testimonials/share" className="text-gold-600 underline underline-offset-2 hover:text-gold-500">
                Share your experience
              </Link>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
