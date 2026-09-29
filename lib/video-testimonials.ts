/**
 * Video testimonials shown in the homepage section right under the hero
 * (features/testimonials/video-testimonial-section.tsx). Config-driven like
 * the template/category registries — adding another host's video is one new
 * entry here. Files live in the public `hero` bucket under
 * platform/testimonials/ (marketing media is meant to be shared, unlike
 * guest memories in the private buckets). Only the first entry is shown
 * today; with more hosts the section can rotate or list them.
 */
export interface VideoTestimonial {
  id: string;
  name: string;
  location: string;
  occasion: string;
  /** The host's written review (testimonials.id) shown under "Read full review", if any. */
  reviewId: string | null;
  /** Short pull quote — the reel itself carries the full story. */
  quote: string;
  highlights: readonly string[];
  videoUrl: string;
  posterUrl: string;
  durationLabel: string;
}

const STORAGE = "https://ktbpnjrovzhjwardyime.supabase.co/storage/v1/object/public/hero/platform/testimonials";

export const VIDEO_TESTIMONIALS: readonly VideoTestimonial[] = [
  {
    id: "rohan-75th",
    name: "Rohan",
    location: "USA",
    occasion: "Father’s 75th birthday",
    reviewId: "d76a3d19-fb37-4401-ac38-ec8a544bd7d6",
    quote: "It was just go to the link, record a video, and hit upload. It made my life a lot easier.",
    highlights: [
      "Invites, RSVPs and meal choices in one place",
      "Family in India sent video wishes from their phones",
      "Easy even for uncles and aunties new to tech",
      "Quick support from India to the USA",
    ],
    videoUrl: `${STORAGE}/rohan-75th-highlight.mp4`,
    posterUrl: `${STORAGE}/rohan-75th-highlight-poster.jpg`,
    durationLabel: "1:03",
  },
];
