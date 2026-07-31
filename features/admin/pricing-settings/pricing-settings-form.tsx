"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { updatePricingPlanAction } from "@/features/admin/pricing-settings/actions";
import type { PricingPlanId, PricingPlanSetting } from "@/services/pricing-settings";

interface FieldState {
  monthlyUsd: string;
  monthlyInr: string;
  annualUsd: string;
  annualInr: string;
}

function toFieldState(plan: PricingPlanSetting): FieldState {
  return {
    monthlyUsd: String(plan.monthlyUsd),
    monthlyInr: String(plan.monthlyInr),
    annualUsd: String(plan.annualUsd),
    annualInr: String(plan.annualInr),
  };
}

function PlanEditor({ plan }: { plan: PricingPlanSetting }) {
  const [fields, setFields] = useState<FieldState>(toFieldState(plan));
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function setField(key: keyof FieldState, value: string) {
    setStatus("idle");
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    const parsed = {
      monthlyUsd: Number(fields.monthlyUsd),
      monthlyInr: Number(fields.monthlyInr),
      annualUsd: Number(fields.annualUsd),
      annualInr: Number(fields.annualInr),
    };

    if (Object.values(parsed).some((n) => !Number.isFinite(n) || n < 0)) {
      setStatus("error");
      setError("Enter a valid, non-negative number for every field.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updatePricingPlanAction(plan.id, parsed);
      if (result.success) {
        setStatus("saved");
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-navy-950/10 bg-white p-5">
      <h3 className="font-display text-lg text-navy-950">{plan.name}</h3>
      <p className="mt-1 text-xs text-navy-700/50">
        planId: <code className="rounded bg-navy-950/5 px-1 py-0.5">{plan.id}</code>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <PriceField label="Monthly (USD)" prefix="$" value={fields.monthlyUsd} onChange={(v) => setField("monthlyUsd", v)} />
        <PriceField label="Monthly (INR)" prefix="₹" value={fields.monthlyInr} onChange={(v) => setField("monthlyInr", v)} />
        <PriceField label="Annual (USD)" prefix="$" value={fields.annualUsd} onChange={(v) => setField("annualUsd", v)} />
        <PriceField label="Annual (INR)" prefix="₹" value={fields.annualInr} onChange={(v) => setField("annualInr", v)} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="tap-target inline-flex items-center gap-2 rounded-lg bg-navy-950 px-4 py-2 text-sm font-medium text-ivory-50 transition-luxury duration-200 hover:bg-navy-900 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Save {plan.name}
        </button>
        {status === "saved" ? <span className="text-sm text-emerald-600">Saved — live on /pricing now.</span> : null}
        {status === "error" && error ? (
          <span className="text-sm text-red-600" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PriceField({
  label,
  prefix,
  value,
  onChange,
}: {
  label: string;
  prefix: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-navy-700/60">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-navy-950/15 bg-white px-2.5 focus-within:border-gold-500 focus-within:ring-2 focus-within:ring-gold-500/30">
        <span className="text-sm text-navy-700/50">{prefix}</span>
        <input
          type="number"
          min={0}
          step="1"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-1.5 py-2 text-sm text-navy-950 focus:outline-none"
        />
      </div>
    </label>
  );
}

export function PricingSettingsForm({ plans }: { plans: Record<PricingPlanId, PricingPlanSetting> }) {
  return (
    <div className="grid gap-4">
      <PlanEditor plan={plans.free} />
      <PlanEditor plan={plans.pro} />
    </div>
  );
}
