"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { submitPaymentAction } from "@/features/pay/actions";
import { paymentSubmissionFormSchema, type PaymentSubmissionFormValues } from "@/types/payment";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 transition-luxury duration-200 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

/** Public "I've paid" confirmation form shown below the QR code at /pay. */
export function PayForm() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentSubmissionFormValues>({
    resolver: zodResolver(paymentSubmissionFormSchema),
  });

  async function onSubmit(values: PaymentSubmissionFormValues) {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const result = await submitPaymentAction(values);
      if (!result.success) throw new Error(result.error);
      setSubmitted(true);
      reset();
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
        <h3 className="font-display text-xl text-navy-950">Thank you!</h3>
        <p className="max-w-sm text-sm text-navy-700/75">
          We&rsquo;ve recorded your payment confirmation and will verify it shortly.
        </p>
        <Button variant="outline" onClick={() => setSubmitted(false)}>
          Submit another
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
        <label className={labelClasses} htmlFor="payerName">
          Your Name
        </label>
        <input id="payerName" className={cn(inputClasses, "mt-1.5")} {...register("payerName")} />
        {errors.payerName ? <p className="mt-1 text-xs text-red-600">{errors.payerName.message}</p> : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClasses} htmlFor="payerEmail">
            Email <span className="normal-case text-navy-700/40">(optional)</span>
          </label>
          <input id="payerEmail" type="email" className={cn(inputClasses, "mt-1.5")} {...register("payerEmail")} />
          {errors.payerEmail ? <p className="mt-1 text-xs text-red-600">{errors.payerEmail.message}</p> : null}
        </div>
        <div>
          <label className={labelClasses} htmlFor="payerPhone">
            Phone <span className="normal-case text-navy-700/40">(optional)</span>
          </label>
          <input id="payerPhone" className={cn(inputClasses, "mt-1.5")} {...register("payerPhone")} />
        </div>
      </div>

      <div>
        <label className={labelClasses} htmlFor="amount">
          Amount Sent (&#8377;)
        </label>
        <input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          className={cn(inputClasses, "mt-1.5")}
          {...register("amount")}
        />
        {errors.amount ? <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p> : null}
      </div>

      <div>
        <label className={labelClasses} htmlFor="purpose">
          Purpose <span className="normal-case text-navy-700/40">(optional)</span>
        </label>
        <input
          id="purpose"
          placeholder="e.g. Event contribution, Gift"
          className={cn(inputClasses, "mt-1.5")}
          {...register("purpose")}
        />
      </div>

      <div>
        <label className={labelClasses} htmlFor="referenceNote">
          UTR / Reference Number <span className="normal-case text-navy-700/40">(optional)</span>
        </label>
        <input
          id="referenceNote"
          placeholder="From your UPI app's payment confirmation"
          className={cn(inputClasses, "mt-1.5")}
          {...register("referenceNote")}
        />
        <p className="mt-1.5 text-xs text-navy-700/50">
          Adding this helps us match your payment faster.
        </p>
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
          "I've Made the Payment"
        )}
      </Button>
    </form>
  );
}
