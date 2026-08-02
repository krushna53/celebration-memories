"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { requestUploadUrl } from "@/features/uploads/actions";
import { submitGuestbookAction } from "@/features/guestbook/actions";
import { guestbookFormSchema, type GuestbookFormValues } from "@/types/guestbook";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 transition-luxury duration-200 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

interface GuestbookFormProps {
  token: string;
}

/** Guest Book entry form: name, message, optional country + photo. */
export function GuestbookForm({ token }: GuestbookFormProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GuestbookFormValues>({
    resolver: zodResolver(guestbookFormSchema),
  });

  async function onSubmit(values: GuestbookFormValues) {
    setServerError(null);
    setIsSubmitting(true);

    try {
      let photoPath: string | null = null;

      if (photo) {
        const compressed = await compressImage(photo);
        const signed = await requestUploadUrl(
          token,
          "photo",
          compressed.name,
          compressed.type,
          compressed.size,
        );
        if (!signed.success) throw new Error(signed.error);

        const { bucket, path, token: uploadToken } = signed.data;
        const { error: uploadError } = await supabaseBrowser()
          .storage.from(bucket)
          .uploadToSignedUrl(path, uploadToken, compressed);
        if (uploadError) throw new Error(uploadError.message);

        photoPath = path;
      }

      const result = await submitGuestbookAction(token, values, photoPath);
      if (!result.success) throw new Error(result.error);

      setSubmitted(true);
      reset();
      setPhoto(null);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-gold-500/20 bg-white px-6 py-10 text-center shadow-sm">
        <CheckCircle2 className="text-gold-500" size={30} />
        <h3 className="font-display text-xl text-navy-950">Thank you for your message!</h3>
        <p className="max-w-sm text-sm text-navy-700/75">
          It&rsquo;s been added to the guest book and will appear on the Memory Wall once reviewed.
        </p>
        <Button variant="outline" onClick={() => setSubmitted(false)}>
          Add another message
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="grid gap-5 rounded-2xl border border-gold-500/15 bg-white px-5 py-6 text-left shadow-sm sm:px-8 sm:py-8"
    >
      <div>
        <label className={labelClasses} htmlFor="guestName">
          Your Name <span className="normal-case text-red-500">*</span>
        </label>
        <input
          id="guestName"
          aria-required="true"
          aria-invalid={errors.guestName ? "true" : "false"}
          className={cn(
            inputClasses,
            "mt-1.5",
            errors.guestName && "border-red-500 focus:border-red-500 focus:ring-red-500/30",
          )}
          {...register("guestName")}
        />
        {errors.guestName ? (
          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
            {errors.guestName.message}
          </p>
        ) : null}
      </div>

      <div>
        <label className={labelClasses} htmlFor="message">
          Your Message <span className="normal-case text-red-500">*</span>
        </label>
        <textarea
          id="message"
          rows={3}
          aria-required="true"
          aria-invalid={errors.message ? "true" : "false"}
          className={cn(
            inputClasses,
            "mt-1.5 resize-none",
            errors.message && "border-red-500 focus:border-red-500 focus:ring-red-500/30",
          )}
          placeholder="Share a wish, a memory, anything from the heart..."
          {...register("message")}
        />
        {errors.message ? (
          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
            {errors.message.message}
          </p>
        ) : null}
      </div>

      <div>
        <label className={labelClasses} htmlFor="country">
          Country <span className="normal-case text-navy-700/40">(optional)</span>
        </label>
        <input id="country" className={cn(inputClasses, "mt-1.5")} {...register("country")} />
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

      <div
        className={cn(
          errors.consent && "rounded-lg border border-red-300 bg-red-50/60 p-2.5 -m-0.5",
        )}
      >
        <label className="flex items-start gap-2.5 text-sm text-navy-700/80">
          <input
            type="checkbox"
            aria-invalid={errors.consent ? "true" : "false"}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-950/30 text-gold-500 focus:ring-gold-500/40"
            {...register("consent")}
          />
          <span>
            I agree that this message (and photo, if added) may be stored and
            shown publicly on this site&rsquo;s Memory Wall. See the{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-600 underline underline-offset-2"
            >
              Privacy Notice
            </a>
            .
          </span>
        </label>
        {errors.consent ? (
          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
            {errors.consent.message}
          </p>
        ) : null}
      </div>

      {serverError ? (
        <p className="text-sm text-red-600" role="alert">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto sm:justify-self-start">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" size={16} /> Submitting...
          </>
        ) : (
          "Sign the Guest Book"
        )}
      </Button>
    </form>
  );
}
