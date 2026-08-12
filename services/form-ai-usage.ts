import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeFormAiGenerationCostUsd } from "@/lib/usage-pricing";
import { FORM_CATEGORY_LABELS, resolveFormCategory, type FormCategory } from "@/lib/form-category";

/**
 * Usage + estimated OpenAI cost for the Custom Form Builder's AI form
 * generation (lib/ai-form-generator.ts's generateFormFromPrompt/
 * generateFormFromImage, called from /forms/new and the builder's
 * "Build with AI" panel) — for the owner-only /admin/usage dashboard.
 *
 * Platform-wide, not per-event — this feature has no event_id at all
 * (forms aren't tied to an event), so it doesn't fit
 * services/usage-analytics.ts's per-event EventUsage shape and is
 * reported as its own separate section instead.
 *
 * Every row in custom_form_ai_generation_requests already carries real
 * input/output token counts captured straight from the OpenAI response
 * (see services/custom-form-ai-rate-limit.ts's recordCustomFormAiGenerationRequest)
 * — this file only does the token -> USD conversion
 * (lib/usage-pricing.ts's computeFormAiGenerationCostUsd) and grouping.
 * Rows recorded before this detail was added (or where a rate-limit
 * check itself failed before recording) have null mode/model and
 * 0 tokens, which cost $0 and are counted as "prompt" by default —
 * harmless undercounting of a handful of historical rows, not
 * something worth a backfill migration for.
 */
export interface FormAiUsageDay {
  date: string;
  count: number;
  costUsd: number;
}

export interface FormAiCategoryUsage {
  category: FormCategory;
  label: string;
  count: number;
  costUsd: number;
}

export interface FormAiUsageSummary {
  totalGenerations: number;
  promptCount: number;
  imageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  promptCostUsd: number;
  imageCostUsd: number;
  byCategory: FormAiCategoryUsage[];
  last14Days: FormAiUsageDay[];
}

interface UsageRow {
  mode: "prompt" | "image" | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  category: string | null;
  created_at: string;
}

function emptySummary(): FormAiUsageSummary {
  return {
    totalGenerations: 0,
    promptCount: 0,
    imageCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    promptCostUsd: 0,
    imageCostUsd: 0,
    byCategory: [],
    last14Days: [],
  };
}

export async function getFormAiGenerationUsage(): Promise<FormAiUsageSummary> {
  const { data, error } = await supabaseAdmin()
    .from("custom_form_ai_generation_requests")
    .select("mode, model, input_tokens, output_tokens, category, created_at")
    .order("created_at", { ascending: false })
    .returns<UsageRow[]>();

  if (error) {
    console.error("getFormAiGenerationUsage failed:", error.message);
    return emptySummary();
  }
  if (!data || data.length === 0) return emptySummary();

  const summary = emptySummary();
  const categoryTotals = new Map<FormCategory, { count: number; costUsd: number }>();
  const dayTotals = new Map<string, { count: number; costUsd: number }>();

  for (const row of data) {
    const model = row.model ?? "gpt-5.6-luna";
    const costUsd = computeFormAiGenerationCostUsd(model, row.input_tokens, row.output_tokens);
    const mode = row.mode ?? "prompt";

    summary.totalGenerations += 1;
    summary.totalInputTokens += row.input_tokens;
    summary.totalOutputTokens += row.output_tokens;
    summary.totalCostUsd += costUsd;

    if (mode === "image") {
      summary.imageCount += 1;
      summary.imageCostUsd += costUsd;
    } else {
      summary.promptCount += 1;
      summary.promptCostUsd += costUsd;
    }

    const category = resolveFormCategory(row.category);
    const categoryEntry = categoryTotals.get(category) ?? { count: 0, costUsd: 0 };
    categoryEntry.count += 1;
    categoryEntry.costUsd += costUsd;
    categoryTotals.set(category, categoryEntry);

    const day = row.created_at.slice(0, 10);
    const dayEntry = dayTotals.get(day) ?? { count: 0, costUsd: 0 };
    dayEntry.count += 1;
    dayEntry.costUsd += costUsd;
    dayTotals.set(day, dayEntry);
  }

  summary.byCategory = Array.from(categoryTotals.entries())
    .map(([category, totals]) => ({ category, label: FORM_CATEGORY_LABELS[category], ...totals }))
    .sort((a, b) => b.costUsd - a.costUsd);

  summary.last14Days = Array.from(dayTotals.entries())
    .map(([date, totals]) => ({ date, ...totals }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 14)
    .reverse();

  return summary;
}
