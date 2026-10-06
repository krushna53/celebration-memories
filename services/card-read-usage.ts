import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeCardReadCostUsd } from "@/lib/usage-pricing";
import type { CardReadUsage } from "@/lib/ai-invitation-card-reader";

/**
 * Token + estimated cost tracking for "Your Card" — the wizard step that
 * reads an uploaded invitation card with an OpenAI vision call
 * (features/start/actions/card.ts → lib/ai-invitation-card-reader.ts).
 *
 * Every call that reached OpenAI is recorded with the real token counts
 * from its response, including calls whose answer couldn't be used
 * (still billed). Dollar figures are computed at read time from
 * lib/usage-pricing.ts, so they're estimates from published rates, not
 * an OpenAI invoice — same caveat as the rest of /admin/usage.
 */

export async function recordCardRead(params: {
  eventId: string;
  usage: CardReadUsage;
  success: boolean;
  fieldsFilled: number;
  durationMs: number;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("ai_card_read_requests").insert({
    event_id: params.eventId,
    model: params.usage.model,
    input_tokens: params.usage.inputTokens,
    output_tokens: params.usage.outputTokens,
    reasoning_tokens: params.usage.reasoningTokens,
    cached_input_tokens: params.usage.cachedInputTokens,
    success: params.success,
    fields_filled: params.fieldsFilled,
    duration_ms: params.durationMs,
  });
  // Best effort — tracking must never fail the host's wizard step.
  if (error) console.error("recordCardRead failed:", error.message);
}

export interface CardReadEventUsage {
  eventId: string | null;
  label: string;
  slug: string | null;
  reads: number;
  totalTokens: number;
  costUsd: number;
}

export interface CardReadRecent {
  id: string;
  createdAt: string;
  eventLabel: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  costUsd: number;
  success: boolean;
  fieldsFilled: number;
  durationMs: number | null;
}

export interface CardReadUsageSummary {
  totalReads: number;
  failedReads: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
  totalCostUsd: number;
  avgCostUsd: number;
  avgTokens: number;
  avgDurationMs: number | null;
  byEvent: CardReadEventUsage[];
  last14Days: { date: string; count: number; costUsd: number }[];
  recent: CardReadRecent[];
}

interface Row {
  id: string;
  event_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cached_input_tokens: number;
  success: boolean;
  fields_filled: number;
  duration_ms: number | null;
  created_at: string;
}

const EMPTY: CardReadUsageSummary = {
  totalReads: 0,
  failedReads: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalReasoningTokens: 0,
  totalCostUsd: 0,
  avgCostUsd: 0,
  avgTokens: 0,
  avgDurationMs: null,
  byEvent: [],
  last14Days: [],
  recent: [],
};

export async function getCardReadUsage(): Promise<CardReadUsageSummary> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("ai_card_read_requests")
    .select(
      "id, event_id, model, input_tokens, output_tokens, reasoning_tokens, cached_input_tokens, success, fields_filled, duration_ms, created_at",
    )
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  if (error) {
    console.error("getCardReadUsage failed:", error.message);
    return EMPTY;
  }
  if (!data || data.length === 0) return EMPTY;

  const eventIds = Array.from(new Set(data.map((r) => r.event_id).filter((id): id is string => Boolean(id))));
  const { data: events } = eventIds.length
    ? await admin
        .from("events")
        .select("id, slug, honoree_name, event_title")
        .in("id", eventIds)
        .returns<{ id: string; slug: string; honoree_name: string; event_title: string }[]>()
    : { data: [] };
  const eventInfo = new Map((events ?? []).map((e) => [e.id, e]));
  const labelFor = (eventId: string | null) => {
    const e = eventId ? eventInfo.get(eventId) : undefined;
    if (!e) return eventId ? "Deleted draft" : "Unknown";
    return [e.honoree_name, e.event_title].filter(Boolean).join(" — ") || e.slug;
  };

  const summary: CardReadUsageSummary = { ...EMPTY, byEvent: [], last14Days: [], recent: [] };
  const byEvent = new Map<string, CardReadEventUsage>();
  const byDay = new Map<string, { count: number; costUsd: number }>();
  let durationTotal = 0;
  let durationCount = 0;

  for (const row of data) {
    const costUsd = computeCardReadCostUsd(row.model, row.input_tokens, row.output_tokens, row.cached_input_tokens);
    const tokens = row.input_tokens + row.output_tokens;

    summary.totalReads += 1;
    if (!row.success) summary.failedReads += 1;
    summary.totalInputTokens += row.input_tokens;
    summary.totalOutputTokens += row.output_tokens;
    summary.totalReasoningTokens += row.reasoning_tokens;
    summary.totalCostUsd += costUsd;
    if (row.duration_ms != null) {
      durationTotal += row.duration_ms;
      durationCount += 1;
    }

    const key = row.event_id ?? "unknown";
    const entry = byEvent.get(key) ?? {
      eventId: row.event_id,
      label: labelFor(row.event_id),
      slug: row.event_id ? (eventInfo.get(row.event_id)?.slug ?? null) : null,
      reads: 0,
      totalTokens: 0,
      costUsd: 0,
    };
    entry.reads += 1;
    entry.totalTokens += tokens;
    entry.costUsd += costUsd;
    byEvent.set(key, entry);

    const day = row.created_at.slice(0, 10);
    const dayEntry = byDay.get(day) ?? { count: 0, costUsd: 0 };
    dayEntry.count += 1;
    dayEntry.costUsd += costUsd;
    byDay.set(day, dayEntry);

    if (summary.recent.length < 15) {
      summary.recent.push({
        id: row.id,
        createdAt: row.created_at,
        eventLabel: labelFor(row.event_id),
        model: row.model,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        reasoningTokens: row.reasoning_tokens,
        costUsd,
        success: row.success,
        fieldsFilled: row.fields_filled,
        durationMs: row.duration_ms,
      });
    }
  }

  summary.avgCostUsd = summary.totalCostUsd / summary.totalReads;
  summary.avgTokens = Math.round((summary.totalInputTokens + summary.totalOutputTokens) / summary.totalReads);
  summary.avgDurationMs = durationCount ? Math.round(durationTotal / durationCount) : null;
  summary.byEvent = Array.from(byEvent.values()).sort((a, b) => b.costUsd - a.costUsd);
  summary.last14Days = Array.from(byDay.entries())
    .map(([date, totals]) => ({ date, ...totals }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 14)
    .reverse();

  return summary;
}
