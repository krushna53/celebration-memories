"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { StarRatingInput } from "@/features/testimonials/star-rating";
import { requestTestimonialPhotoUploadAction, submitTestimonialAction } from "@/features/testimonials/actions";
import { testimonialFormSchema, type TestimonialFormValues } from "@/types/testimonial";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 transition-luxury duration-200 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

/**
 * Public "Share Your Experience" form (/testimonials/share) — anyone
 * can submit, same open-to-all shape as the Contact page. Photo upload
 * follows the same direct-to-Storage signed-URL pattern as
 * features/guestbook/guestbook-form.tsx, just against the
 * platform-level requestTestimonialPhotoUploadAction instead of an
 * invitee-scoped one. Every submission lands unapproved and only
 * appears on the homepage carousel once the owner approves it at
 * /admin/testimonials — stated here so submitters aren't confused when
 * it doesn't show up immediately.
 */
export function ShareExperienceForm() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TestimonialFormValues>({ resolver: zodResolver(testimonialFormSchema), defaultValues: { rating: 0 } });

  function chooseRating(value: number) {
    setRating(value);
    setValue("rating", value, { shouldValidate: true });
  }

  async function onSubmit(values: TestimonialFormValues) {
    setServerError(null);
    setIsSubmitting(true);

    try {
      let photoPath: string | null = null;

      if (photo) {
        const compressed = await compressImage(photo);
        const signed = await requestTestimonialPhotoUploadAction(compressed.name, compressed.type, compressed.size);
        if (!signed.success) throw new Error(signed.error);

        const { bucket, path, token: uploadToken } = signed.data;
        const { error: uploadError } = await supabaseBrowser()
          .storage.from(bucket)
          .uploadToSignedUrl(path, uploadToken, compressed);
        if (uploadError) throw new Error(uploadError.message);

        photoPath = path;
      }

      const result = await submitTestimonialAction(values, photoPath);
      if (!result.success) throw new Error(result.error);

      setSubmitted(true);
      reset();
      setPhoto(null);
      setRating(0);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-500/20 bg-white px-8 py-12 text-center shadow-sm">
        <CheckCircle2 className="text-gold-500" size={36} />
        <h3 className="font-display text-xl text-navy-950">Thank you for sharing!</h3>
        <p className="max-w-sm text-sm text-navy-700/75">
          Your story is in for review and will appear on the homepage once it&rsquo;s approved.
        </p>
        <Button variant="outline" onClick={() => setSubmitted(false)}>
          Share another story
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="grid gap-6 rounded-2xl border border-gold-500/15 bg-white px-6 py-8 text-left shadow-sm sm:px-10 sm:py-10"
    >
      <div>
        <label className={labelClasses} htmlFor="name">
          Your Name
        </label>
        <input id="name" className={cn(inputClasses, "mt-1.5")} {...register("name")} />
        {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
      </div>

      <div>
        <label className={labelClasses} htmlFor="role">
          Event / Role{" "}
          <span className="normal-case text-navy-700/40">
            (optional, e.g. &ldquo;Mother of the Bride, Mumbai&rdquo;)
          </span>
        </label>
        <input id="role" className={cn(inputClasses, "mt-1.5")} {...register("role")} />
      </div>

      <div>
        <span className={labelClasses}>Your Rating</span>
        <div className="mt-1.5">
          <StarRatingInput value={rating} onChange={chooseRating} />
        </div>
        {errors.rating ? <p className="mt-1 text-xs text-red-600">{errors.rating.message}</p> : null}
      </div>

      <div>
        <label className={labelClasses} htmlFor="message">
          Your Experience
        </label>
        <textarea
          id="message"
          rows={4}
          className={cn(inputClasses, "mt-1.5 resize-none")}
          placeholder="Tell us how it went — what you built, what your guests loved, anything at all."
          {...register("message")}
        />
        {errors.message ? <p className="mt-1 text-xs text-red-600">{errors.message.message}</p> : null}
      </div>

      <div>
        <span className={labelClasses}>
          Photo <span className="normal-case text-navy-700/40">(optional)</span>
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
        {photo ? (
          <div className="mt-2 flex items-center justify-between rounded-lg border border-navy-950/10 px-3 py-2 text-sm text-navy-950">
            <span className="truncate">{photo.name}</span>
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => setPhoto(null)}
              className="tap-target flex items-center justify-center text-navy-700/50 hover:text-red-600"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gold-500/40 px-4 py-3 text-sm text-navy-700/70 hover:border-gold-500"
          >
            <ImagePlus size={16} /> Add a photo
          </button>
        )}
      </div>

      <div>
        <label className="flex items-start gap-2.5 text-sm text-navy-700/80">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-950/30 text-gold-500 focus:ring-gold-500/40"
            {...register("consent")}
          />
          <span>
            I agree that this story (and photo, if added) may be reviewed and shown publicly on the homepage. See
            the{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-gold-600 underline underline-offset-2">
              Privacy Notice
            </a>
            .
          </span>
        </label>
        {errors.consent ? <p className="mt-1 text-xs text-red-600">{errors.consent.message}</p> : null}
      </div>

      {serverError ? (
        <p className="text-sm text-red-600" role="alert">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto sm:justify-self-start">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" size={16} /> Sending...
          </>
        ) : (
          "Share Your Experience"
        )}
      </Button>
    </form>
  );
}
