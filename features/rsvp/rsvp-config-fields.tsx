"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { cn } from "@/lib/utils";
import { MEAL_PREFERENCES, MEAL_PREFERENCE_LABELS, type RsvpFormValues } from "@/types/rsvp";
import { attendanceOptions, fieldLabel, type RsvpConfig } from "@/lib/rsvp-config";

/** RSVP values plus answers to the event's custom questions (lib/rsvp-config.ts). */
export type ConfiguredRsvpValues = RsvpFormValues & { answers?: Record<string, string> };

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 transition-luxury duration-200 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const errorInput = "border-red-500 focus:border-red-500 focus:ring-red-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

function Required() {
  return <span className="normal-case text-red-500">*</span>;
}

function ErrorText({ message }: { message?: string }) {
  return message ? (
    <p className="mt-1 text-xs font-medium text-red-600" role="alert">
      {message}
    </p>
  ) : null;
}

interface FieldsProps {
  config: RsvpConfig;
  register: UseFormRegister<ConfiguredRsvpValues>;
  errors: FieldErrors<ConfiguredRsvpValues>;
}

/** "Will you be joining us?" — the event's attendance choices and wording. */
export function RsvpAttendanceField({
  config,
  register,
  errors,
  coming,
  segment = "family",
}: FieldsProps & { coming: string | undefined; segment?: "family" | "corporate" }) {
  const options = attendanceOptions(config, segment);
  return (
    <div>
      <span className={labelClasses}>
        Will you be joining us? <Required />
      </span>
      <div
        className={cn(
          "mt-2 grid grid-cols-1 gap-2 rounded-lg",
          options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
          errors.coming && "border-2 border-red-400 p-1.5",
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "cursor-pointer rounded-lg border px-4 py-2.5 text-center text-sm transition-luxury duration-200",
              coming === option.value
                ? "border-gold-500 bg-gold-500/10 font-medium text-navy-950"
                : "border-navy-950/15 text-navy-700/70 hover:border-gold-400",
            )}
          >
            <input type="radio" value={option.value} className="sr-only" {...register("coming")} />
            {option.label}
          </label>
        ))}
      </div>
      <ErrorText message={errors.coming?.message} />
    </div>
  );
}

/**
 * Everything after the name: contact details, headcount, meal, comments and
 * the event's own questions — each shown, hidden, required or renamed per
 * the event's RSVP config. `publicMode` is the no-link form, where phone is
 * always shown and required (it identifies a returning guest).
 */
export function RsvpDetailFields({
  config,
  register,
  errors,
  publicMode = false,
  commentsPlaceholder,
}: FieldsProps & { publicMode?: boolean; commentsPlaceholder: string }) {
  const f = config.fields;
  const showPhone = publicMode || f.phone.visible;
  const phoneRequired = publicMode || f.phone.required;

  return (
    <>
      {showPhone || f.email.visible ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {showPhone ? (
            <div>
              <label className={labelClasses} htmlFor="phone">
                {fieldLabel(config, "phone")} {phoneRequired ? <Required /> : null}
              </label>
              <input
                id="phone"
                type="tel"
                aria-required={phoneRequired}
                aria-invalid={errors.phone ? "true" : "false"}
                className={cn(inputClasses, "mt-1.5", errors.phone && errorInput)}
                placeholder={publicMode ? "With country code" : undefined}
                {...register("phone")}
              />
              {errors.phone ? (
                <ErrorText message={errors.phone.message} />
              ) : publicMode ? (
                <p className="mt-1 text-[11px] text-navy-700/50">
                  Used to find your RSVP if you come back to update it — not shared publicly.
                </p>
              ) : null}
            </div>
          ) : null}
          {f.email.visible ? (
            <div>
              <label className={labelClasses} htmlFor="email">
                {fieldLabel(config, "email")} {f.email.required ? <Required /> : publicMode ? "(optional)" : null}
              </label>
              <input
                id="email"
                type="email"
                aria-required={f.email.required}
                aria-invalid={errors.email ? "true" : "false"}
                className={cn(inputClasses, "mt-1.5", errors.email && errorInput)}
                {...register("email")}
              />
              <ErrorText message={errors.email?.message} />
            </div>
          ) : null}
        </div>
      ) : null}

      {f.adults.visible || f.children.visible ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {f.adults.visible ? (
            <div>
              <label className={labelClasses} htmlFor="adults">
                {fieldLabel(config, "adults")}
              </label>
              <input id="adults" type="number" min={0} max={20} className={cn(inputClasses, "mt-1.5")} {...register("adults")} />
            </div>
          ) : null}
          {f.children.visible ? (
            <div>
              <label className={labelClasses} htmlFor="children">
                {fieldLabel(config, "children")}
              </label>
              <input id="children" type="number" min={0} max={20} className={cn(inputClasses, "mt-1.5")} {...register("children")} />
            </div>
          ) : null}
        </div>
      ) : null}

      {f.mealPreference.visible ? (
        <div>
          <label className={labelClasses} htmlFor="mealPreference">
            {fieldLabel(config, "mealPreference")}
          </label>
          <select id="mealPreference" className={cn(inputClasses, "mt-1.5")} {...register("mealPreference")}>
            {MEAL_PREFERENCES.map((option) => (
              <option key={option} value={option}>
                {MEAL_PREFERENCE_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {config.questions.map((q) => {
        const name = `answers.${q.id}` as const;
        const error = errors.answers?.[q.id]?.message;
        const id = `q-${q.id}`;
        return (
          <div key={q.id}>
            {q.type === "choice" || q.type === "yes_no" ? (
              <fieldset>
                <legend className={labelClasses}>
                  {q.label} {q.required ? <Required /> : null}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(q.type === "yes_no" ? ["Yes", "No"] : q.options).map((option) => (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-navy-950/15 px-3 py-2 text-sm text-navy-950 has-[:checked]:border-gold-500 has-[:checked]:bg-gold-500/10"
                    >
                      <input type="radio" value={option} className="accent-gold-500" {...register(name)} />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <>
                <label className={labelClasses} htmlFor={id}>
                  {q.label} {q.required ? <Required /> : null}
                </label>
                {q.type === "long_text" ? (
                  <textarea id={id} rows={3} className={cn(inputClasses, "mt-1.5 resize-none", error && errorInput)} {...register(name)} />
                ) : (
                  <input id={id} className={cn(inputClasses, "mt-1.5", error && errorInput)} {...register(name)} />
                )}
              </>
            )}
            <ErrorText message={error} />
          </div>
        );
      })}

      {f.comments.visible ? (
        <div>
          <label className={labelClasses} htmlFor="comments">
            {fieldLabel(config, "comments")} {f.comments.required ? <Required /> : null}
          </label>
          <textarea
            id="comments"
            rows={3}
            aria-required={f.comments.required}
            className={cn(inputClasses, "mt-1.5 resize-none", errors.comments && errorInput)}
            placeholder={commentsPlaceholder}
            {...register("comments")}
          />
          <ErrorText message={errors.comments?.message} />
        </div>
      ) : null}
    </>
  );
}
