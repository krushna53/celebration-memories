import { z } from "zod";

/** Platform-level "what our hosts say" testimonial — not tied to any one event. See services/testimonials.ts. */
export interface Testimonial {
  id: string;
  name: string;
  country: string;
  role: string | null;
  rating: number;
  message: string;
  photoUrl: string | null;
  approved: boolean;
  featured: boolean;
  createdAt: string;
}

export const testimonialFormSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(80),
  country: z.string().trim().min(2, "Please enter your country.").max(80),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  rating: z.coerce.number().int().min(1, "Please choose a star rating.").max(5),
  message: z
    .string()
    .trim()
    .min(10, "Please share a few words about your experience.")
    .max(3000, "Please keep it under 3000 characters."),
  photo: z.any().optional(),
  consent: z.boolean().refine((v) => v === true, "Please agree before submitting."),
});

export type TestimonialFormValues = z.infer<typeof testimonialFormSchema>;
