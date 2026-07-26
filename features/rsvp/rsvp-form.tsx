"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { submitRsvpAction } from "@/features/rsvp/actions";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_OPTIONS,
  MEAL_PREFERENCES,
  MEAL_PREFERENCE_LABELS,
  rsvpFormSchema,
  type RsvpFormValues,
} from "@/types/rsvp";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 transition-luxury duration-200 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

interface RsvpFormProps {
  token: string;
  defaultValues: Partial<RsvpFormValues>;
  guestName: string;
}

export function RsvpForm({ token, defaultValues, guestName }: RsvpFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RsvpFormValues>({
    resolver: zodResolver(rsvpFormSchema),
    defaultValues: {
      name: guestName,
      coming: "coming",
      adults: 1,
      children: 0,
      mealPreference: "no_preference",
      ...defaultValues,
    },
  });

  const coming = watch("coming");

  async function onSubmit(values: RsvpFormValues) {
    setServerError(null);
    const result = await submitRsvpAction(token, values);
    if (result.success) {
      setSubmitted(true);
    } else {
      setServerError(result.error);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-500/20 bg-white px-8 py-12 text-center shadow-sm">
        <CheckCircle2 className="text-gold-500" size={36} />
        <h3 className="font-display text-2xl text-navy-950">
          Thank you, {guestName.split(" ")[0]}!
        </h3>
        <p className="max-w-sm text-sm text-navy-700/75">
          Your RSVP has been recorded. You can revisit this link anytime to
          update your response.
        </p>
        <Button variant="outline" onClick={() => setSubmitted(false)}>
          Edit my RSVP
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
      {/* Attendance */}
      <div>
        <span className={labelClasses}>Will you be joining us?</span>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ATTENDANCE_OPTIONS.map((option) => (
            <label
              key={option}
              className={cn(
                "cursor-pointer rounded-lg border px-4 py-2.5 text-center text-sm transition-luxury duration-200",
                coming === option
                  ? "border-gold-500 bg-gold-500/10 text-navy-950 font-medium"
                  : "border-navy-950/15 text-navy-700/70 hover:border-gold-400",
              )}
            >
              <input
                type="radio"
                value={option}
                className="sr-only"
                {...register("coming")}
              />
              {ATTENDANCE_LABELS[option]}
            </label>
          ))}
        </div>
        {errors.coming ? (
          <p className="mt-1 text-xs text-red-600">{errors.coming.message}</p>
        ) : null}
      </div>

      {/* Name */}
      <div>
        <label className={labelClasses} htmlFor="name">
          Full Name
        </label>
        <input
          id="name"
          className={cn(inputClasses, "mt-1.5")}
          {...register("name")}
        />
        {errors.name ? (
          <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className={labelClasses} htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            className={cn(inputClasses, "mt-1.5")}
            {...register("phone")}
          />
        </div>
        <div>
          <label className={labelClasses} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={cn(inputClasses, "mt-1.5")}
            {...register("email")}
          />
          {errors.email ? (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className={labelClasses} htmlFor="adults">
            Adults
          </label>
          <input
            id="adults"
            type="number"
            min={0}
            max={20}
            className={cn(inputClasses, "mt-1.5")}
            {...register("adults")}
          />
        </div>
        <div>
          <label className={labelClasses} htmlFor="children">
            Children
          </label>
          <input
            id="children"
            type="number"
            min={0}
            max={20}
            className={cn(inputClasses, "mt-1.5")}
            {...register("children")}
          />
        </div>
      </div>

      <div>
        <label className={labelClasses} htmlFor="mealPreference">
          Meal Preference
        </label>
        <select
          id="mealPreference"
          className={cn(inputClasses, "mt-1.5")}
          {...register("mealPreference")}
        >
          {MEAL_PREFERENCES.map((option) => (
            <option key={option} value={option}>
              {MEAL_PREFERENCE_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClasses} htmlFor="comments">
          Comments
        </label>
        <textarea
          id="comments"
          rows={3}
          className={cn(inputClasses, "mt-1.5 resize-none")}
          placeholder="Dietary needs, well-wishes, anything else we should know..."
          {...register("comments")}
        />
      </div>

      {serverError ? (
        <p className="text-sm text-red-600" role="alert">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isSubmitting} className="justify-self-start">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            Submitting...
          </>
        ) : (
          "Submit RSVP"
        )}
      </Button>
    </form>
  );
}
