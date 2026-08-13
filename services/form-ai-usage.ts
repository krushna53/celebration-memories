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

/**
 * Same generation rows as getFormAiGenerationUsage above, but grouped
 * by which form_owners account built the form generating them — for
 * the "per user account" cost breakdown on the owner-only Platform
 * Utilization dashboard (/admin/platform-usage). `mode: "prompt"`
 * generations happen before a form exists yet (they draft one from a
 * blank slate — see /forms/new's flow), so `form_id` is only ever
 * non-null for generations run *inside* an existing form's builder
 * (the "Build with AI" panel re-generating an already-created form).
 * Those with no `form_id` genuinely can't be attributed to an owner
 * (could be an anonymous visitor who never finished creating an
 * account) — counted separately as "unattributed" rather than silently
 * dropped, so the sum of every owner's cost plus this bucket always
 * equals getFormAiGenerationUsage's totalCostUsd.
 *
 * Two extra round-trips (custom_forms for the form_id -> owner_id
 * mapping, form_owners for display info) rather than a single joined
 * query — this app's Supabase JS client usage elsewhere in this file
 * already favors "fetch flat, group in JS" over embedding foreign-table
 * selects, and the row counts here are small enough that it doesn't
 * matter.
 */
export interface FormOwnerAiUsage {
  ownerId: string;
  email: string;
  name: string | null;
  generationCount: number;
  totalTokens: number;
  costUsd: number;
}

export interface FormAiUsageByOwnerResult {
  owners: FormOwnerAiUsage[];
  unattributedCount: number;
  unattributedCostUsd: number;
}

export async function getFormAiUsageByOwner(): Promise<FormAiUsageByOwnerResult> {
  const admin = supabaseAdmin();

  const [requestsResult, formsResult, ownersResult] = await Promise.all([
    admin.from("custom_form_ai_generation_requests").select("mode, model, input_tokens, output_tokens, form_id").returns<
      { mode: "prompt" | "image" | null; model: string | null; input_tokens: number; output_tokens: number; form_id: string | null }[]
    >(),
    admin.from("custom_forms").select("id, owner_id").returns<{ id: string; owner_id: string | null }[]>(),
    admin.from("form_owners").select("id, email, name").returns<{ id: string; email: string; name: string | null }[]>(),
  ]);

  if (requestsResult.error || formsResult.error || ownersResult.error) {
    console.error(
      "getFormAiUsageByOwner failed:",
      requestsResult.error?.message ?? formsResult.error?.message ?? ownersResult.error?.message,
    );
    return { owners: [], unattributedCount: 0, unattributedCostUsd: 0 };
  }

  const formOwnerMap = new Map((formsResult.data ?? []).map((f) => [f.id, f.owner_id]));
  const ownerInfo = new Map((ownersResult.data ?? []).map((o) => [o.id, o]));

  const totalsByOwner = new Map<string, { count: number; tokens: number; costUsd: number }>();
  let unattributedCount = 0;
  let unattributedCostUsd = 0;

  for (const row of requestsResult.data ?? []) {
    const model = row.model ?? "gpt-5.6-luna";
    const costUsd = computeFormAiGenerationCostUsd(model, row.input_tokens, row.output_tokens);
    const tokens = row.input_tokens + row.output_tokens;
    const ownerId = row.form_id ? (formOwnerMap.get(row.form_id) ?? null) : null;

    if (!ownerId) {
      unattributedCount += 1;
      unattributedCostUsd += costUsd;
      continue;
    }

    const entry = totalsByOwner.get(ownerId) ?? { count: 0, tokens: 0, costUsd: 0 };
    entry.count += 1;
    entry.tokens += tokens;
    entry.costUsd += costUsd;
    totalsByOwner.set(ownerId, entry);
  }

  const owners: FormOwnerAiUsage[] = Array.from(totalsByOwner.entries())
    .map(([ownerId, totals]) => {
      const info = ownerInfo.get(ownerId);
      return {
        ownerId,
        email: info?.email ?? "Unknown",
        name: info?.name ?? null,
        generationCount: totals.count,
        totalTokens: totals.tokens,
        costUsd: totals.costUsd,
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);

  return { owners, unattributedCount, unattributedCostUsd };
}
