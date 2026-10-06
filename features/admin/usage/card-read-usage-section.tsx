import { StatCard } from "@/features/admin/components/stat-card";
import { BarChart } from "@/features/admin/components/bar-chart";
import type { CardReadUsageSummary } from "@/services/card-read-usage";

const DAY_COLOR = "#0d9488";
const EVENT_COLOR = "#a855f7";

/** Card reads cost a fraction of a cent — show enough precision that small numbers don't round to $0.00. */
function formatUsdPrecise(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * /admin/usage section for the wizard's "Your Card" step — every
 * invitation card read by AI (image → event details), with the real
 * OpenAI token counts and an estimated cost. See services/card-read-usage.ts.
 */
export function CardReadUsageSection({ usage }: { usage: CardReadUsageSummary }) {
  return (
    <div className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg text-navy-950">Invitation Card Reading — AI (Image → Text)</h2>
      <p className="mt-1 text-xs text-navy-700/50">
        Every invitation card a host uploaded in the wizard&rsquo;s &ldquo;Your Card&rdquo; step and AI read to
        pre-fill Event Details. Unusable reads are counted too — OpenAI still bills them.
      </p>
      <p className="mt-3 rounded-lg border border-gold-500/25 bg-gold-500/5 px-3 py-2 text-xs leading-relaxed text-navy-700/70">
        Token counts are <strong className="text-navy-950">real</strong>, taken from OpenAI&apos;s response on every
        call (the card image is billed as input tokens). Dollar figures use the published per-token rate in{" "}
        <code>lib/usage-pricing.ts</code> — check your OpenAI billing dashboard for invoiced amounts.
      </p>

      {usage.totalReads === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-navy-950/15 py-10 text-center text-sm text-navy-700/50">
          No invitation cards read yet. Tracking started on 6 October 2026 — reads before that weren&rsquo;t recorded.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Est. Cost"
              value={formatUsdPrecise(usage.totalCostUsd)}
              hint={`${formatUsdPrecise(usage.avgCostUsd)} per card`}
            />
            <StatCard
              label="Cards Read"
              value={usage.totalReads}
              hint={usage.failedReads > 0 ? `${usage.failedReads} found no details` : "all found details"}
            />
            <StatCard
              label="Input Tokens"
              value={usage.totalInputTokens.toLocaleString()}
              hint="includes the card image"
            />
            <StatCard
              label="Output Tokens"
              value={usage.totalOutputTokens.toLocaleString()}
              hint={`${usage.totalReasoningTokens.toLocaleString()} spent reasoning`}
            />
          </div>
          <p className="mt-2 text-xs text-navy-700/50">
            Average {usage.avgTokens.toLocaleString()} tokens per card
            {usage.avgDurationMs != null ? ` · ${(usage.avgDurationMs / 1000).toFixed(1)}s per read` : ""}.
          </p>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/50">Cost By Event</p>
              <BarChart
                data={usage.byEvent.slice(0, 10).map((e) => ({
                  label: `${e.label} (${e.reads})`,
                  value: Number(e.costUsd.toFixed(4)),
                  color: EVENT_COLOR,
                }))}
              />
            </div>
            {usage.last14Days.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/50">Last 14 Days</p>
                <BarChart
                  data={usage.last14Days.map((d) => ({
                    label: `${d.date} (${d.count})`,
                    value: Number(d.costUsd.toFixed(4)),
                    color: DAY_COLOR,
                  }))}
                />
              </div>
            ) : null}
          </div>

          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/50">Recent Reads</p>
            <div className="overflow-x-auto rounded-lg border border-navy-950/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy-950/[0.03] text-xs uppercase tracking-wide text-navy-700/60">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2 text-right">Input</th>
                    <th className="px-3 py-2 text-right">Output</th>
                    <th className="px-3 py-2 text-right">Fields</th>
                    <th className="px-3 py-2 text-right">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-950/5">
                  {usage.recent.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-navy-700/70">{formatWhen(r.createdAt)}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-navy-950">{r.eventLabel}</span>
                        <span className="ml-2 text-xs text-navy-700/50">{r.model}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-navy-700/70">{r.inputTokens.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-navy-700/70" title={`${r.reasoningTokens} reasoning`}>
                        {r.outputTokens.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.success ? (
                          <span className="text-navy-700/70">{r.fieldsFilled}</span>
                        ) : (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700">none</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-navy-950">{formatUsdPrecise(r.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
