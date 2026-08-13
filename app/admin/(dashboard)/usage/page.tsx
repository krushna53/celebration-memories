import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getAllEventsUsage } from "@/services/usage-analytics";
import { getFormAiGenerationUsage, getFormAiUsageByOwner } from "@/services/form-ai-usage";
import { formatBytes } from "@/lib/format-bytes";
import { StatCard } from "@/features/admin/components/stat-card";
import { BarChart } from "@/features/admin/components/bar-chart";
import { PieChart } from "@/features/admin/components/pie-chart";

export const dynamic = "force-dynamic";

const PROVIDER_COLORS = {
  aiImage: "#4f46e5",
  shotstackSlideshow: "#e5503c",
  shotstackVideoEditor: "#c2410c",
} as const;

const FORM_AI_COLORS = {
  prompt: "#0ea5e9",
  image: "#a855f7",
  day: "#ca8a04",
} as const;

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** AI form-generation calls are typically fractions of a cent each (see lib/usage-pricing.ts's GPT-5.6 Luna rate) — formatUsd's 2 decimals would round almost everything to "$0.00" at low volume, so this shows more precision until the total is at least a cent. */
function formatUsdPrecise(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

/**
 * Owner-only cross-client usage + estimated spend dashboard — AI Image
 * generations, Shotstack renders (Slideshow Video + Video Editor
 * combined, since both bill against the same Shotstack account), and
 * Supabase Storage, broken down per event so the owner can see at a
 * glance which client is consuming the most. Same owner-only reasoning
 * and page-guard pattern as /admin/storage (see that page's comment) —
 * deliberately excluded from CLIENT_ALLOWED_PATHS in lib/admin-roles.ts.
 *
 * Also includes a separate "Build RSVP / Form — AI Generation" section
 * (services/form-ai-usage.ts) for the Custom Form Builder's AI form
 * generation — platform-wide rather than per-event (forms have no
 * event_id), so it doesn't fit the per-event breakdown below and is
 * reported on its own, with real OpenAI token counts converted to an
 * estimated dollar figure.
 *
 * The dollar figures here are estimates from published list pricing
 * (lib/usage-pricing.ts), not live Shotstack/OpenAI billing data — see
 * that file's header comment for the exact assumptions and sources.
 */
export default async function AdminUsagePage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const [usage, formAiUsage, formAiByOwner] = await Promise.all([
    getAllEventsUsage(),
    getFormAiGenerationUsage(),
    getFormAiUsageByOwner(),
  ]);

  const totals = usage.reduce(
    (acc, u) => ({
      aiImageCount: acc.aiImageCount + u.aiImageCount,
      shotstackRenders: acc.shotstackRenders + u.slideshowCount + u.videoEditorCount,
      storageBytes: acc.storageBytes + u.storageBytes,
      estimatedTotalCostUsd: acc.estimatedTotalCostUsd + u.estimatedTotalCostUsd,
      estimatedShotstackSlideshowCostUsd: acc.estimatedShotstackSlideshowCostUsd + u.estimatedShotstackSlideshowCostUsd,
      estimatedShotstackVideoEditorCostUsd: acc.estimatedShotstackVideoEditorCostUsd + u.estimatedShotstackVideoEditorCostUsd,
    }),
    {
      aiImageCount: 0,
      shotstackRenders: 0,
      storageBytes: 0,
      estimatedTotalCostUsd: 0,
      estimatedShotstackSlideshowCostUsd: 0,
      estimatedShotstackVideoEditorCostUsd: 0,
    },
  );

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Usage & Estimated Spend</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Cross-client AI Image, Shotstack (Slideshow Video + Video Editor), and Supabase Storage
        consumption — spot which client is using the most before it becomes a billing surprise.
      </p>
      <p className="mt-3 rounded-lg border border-gold-500/25 bg-gold-500/5 px-3 py-2 text-xs leading-relaxed text-navy-700/70">
        Dollar figures below are <strong className="text-navy-950">estimates</strong> computed from
        published Shotstack/OpenAI list pricing, not pulled from either provider&apos;s live
        billing — see the comment in <code>lib/usage-pricing.ts</code> for the exact assumptions
        and sources. Generation counts and storage bytes are real, measured data.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Est. Total Spend" value={formatUsd(totals.estimatedTotalCostUsd)} />
        <StatCard label="AI Images Generated" value={totals.aiImageCount} />
        <StatCard label="Shotstack Renders" value={totals.shotstackRenders} />
        <StatCard label="Total Storage" value={formatBytes(totals.storageBytes)} />
      </div>

      {/* Shotstack spend split by tool — Slideshow Video and Video Editor
          both bill against the same Shotstack account but are separate
          features, so a client running up Video Editor renders shouldn't
          get lost inside a single merged "Shotstack" number. */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <StatCard label="Shotstack API — Slideshow" value={formatUsd(totals.estimatedShotstackSlideshowCostUsd)} />
        <StatCard label="Shotstack API — Video Editor" value={formatUsd(totals.estimatedShotstackVideoEditorCostUsd)} />
      </div>

      <div className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg text-navy-950">Build RSVP / Form — AI Generation</h2>
        <p className="mt-1 text-xs text-navy-700/50">
          Platform-wide, not tied to any event — every &ldquo;Describe it&rdquo; or &ldquo;Upload a
          form image&rdquo; call from /forms/new or the builder&rsquo;s &ldquo;Build with AI&rdquo;
          panel, across every form anyone has built.
        </p>
        <p className="mt-3 rounded-lg border border-gold-500/25 bg-gold-500/5 px-3 py-2 text-xs leading-relaxed text-navy-700/70">
          Token counts here are <strong className="text-navy-950">real</strong>, captured from
          OpenAI&apos;s response on every call. The dollar figure converts those tokens using a
          published per-token rate (<code>lib/usage-pricing.ts</code>), not a live pull from your
          OpenAI invoice — verify against your OpenAI billing dashboard if this matters for
          accounting.
        </p>

        {formAiUsage.totalGenerations === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-navy-950/15 py-10 text-center text-sm text-navy-700/50">
            No AI form generations yet.
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Est. Cost" value={formatUsdPrecise(formAiUsage.totalCostUsd)} />
              <StatCard
                label="Generations"
                value={formAiUsage.totalGenerations}
                hint={`${formAiUsage.promptCount} prompt · ${formAiUsage.imageCount} image`}
              />
              <StatCard label="Input Tokens" value={formAiUsage.totalInputTokens.toLocaleString()} />
              <StatCard label="Output Tokens" value={formAiUsage.totalOutputTokens.toLocaleString()} />
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/50">Cost By Mode</p>
                <PieChart
                  centerLabel={formatUsdPrecise(formAiUsage.totalCostUsd)}
                  data={[
                    { label: `Describe It (${formAiUsage.promptCount})`, value: formAiUsage.promptCostUsd, color: FORM_AI_COLORS.prompt },
                    { label: `Upload Image (${formAiUsage.imageCount})`, value: formAiUsage.imageCostUsd, color: FORM_AI_COLORS.image },
                  ]}
                />
              </div>
              {formAiUsage.byCategory.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/50">Cost By RSVP Type</p>
                  <BarChart
                    data={formAiUsage.byCategory.map((c) => ({
                      label: `${c.label} (${c.count})`,
                      value: Number(c.costUsd.toFixed(4)),
                      color: FORM_AI_COLORS.prompt,
                    }))}
                  />
                </div>
              ) : null}
            </div>

            {/* Who actually spent this. Attribution runs generation ->
                form -> form_owners; a form built by someone who never
                created an account has no owner to name, so those are
                listed by form instead rather than hidden in a lump sum. */}
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/50">By Account</p>
              {formAiByOwner.owners.length === 0 && formAiByOwner.unattributedForms.length === 0 ? (
                <p className="text-sm text-navy-700/50">No generations to attribute yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-navy-950/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-navy-950/[0.03] text-xs uppercase tracking-wide text-navy-700/60">
                      <tr>
                        <th className="px-3 py-2">Account</th>
                        <th className="px-3 py-2 text-right">Generations</th>
                        <th className="px-3 py-2 text-right">Tokens</th>
                        <th className="px-3 py-2 text-right">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-950/5">
                      {formAiByOwner.owners.map((owner) => (
                        <tr key={owner.ownerId}>
                          <td className="px-3 py-2">
                            <span className="font-medium text-navy-950">{owner.name || owner.email}</span>
                            {owner.name ? <span className="ml-2 text-xs text-navy-700/50">{owner.email}</span> : null}
                          </td>
                          <td className="px-3 py-2 text-right text-navy-700/70">{owner.generationCount}</td>
                          <td className="px-3 py-2 text-right text-navy-700/70">{owner.totalTokens.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-medium text-navy-950">{formatUsdPrecise(owner.costUsd)}</td>
                        </tr>
                      ))}
                      {formAiByOwner.unattributedForms.map((form) => (
                        <tr key={form.formId} className="bg-navy-950/[0.015]">
                          <td className="px-3 py-2">
                            <span className="font-medium text-navy-950">{form.title}</span>
                            <span className="ml-2 rounded-full bg-navy-950/5 px-2 py-0.5 text-[11px] text-navy-700/60">
                              No account yet
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-navy-700/70">{form.generationCount}</td>
                          <td className="px-3 py-2 text-right text-navy-700/40">&mdash;</td>
                          <td className="px-3 py-2 text-right font-medium text-navy-950">{formatUsdPrecise(form.costUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {formAiByOwner.unattributedCount > 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-navy-700/50">
                  Rows marked <strong className="text-navy-700/70">No account yet</strong> were generated by someone building a
                  form without signing up — building a form deliberately needs no login, so there&rsquo;s no account to name until
                  they create one. They&rsquo;re listed by form so the spend is still traceable.
                </p>
              ) : null}
            </div>

            {formAiUsage.last14Days.length > 0 ? (
              <div className="mt-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/50">Last 14 Days</p>
                <BarChart
                  data={formAiUsage.last14Days.map((d) => ({
                    label: `${d.date} (${d.count})`,
                    value: Number(d.costUsd.toFixed(4)),
                    color: FORM_AI_COLORS.day,
                  }))}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {usage.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
          No live events yet.
        </p>
      ) : (
        <>
          <div className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg text-navy-950">Estimated Spend By Client</h2>
            <p className="mt-1 text-xs text-navy-700/50">
              AI Image + Shotstack combined, largest first. Storage isn&apos;t included here —
              Supabase storage cost depends on your plan, not a simple per-GB rate, so it&apos;s
              shown separately below as bytes, not dollars.
            </p>
            <div className="mt-4">
              <BarChart
                data={usage.map((u) => ({
                  label: u.honoreeName,
                  value: Number(u.estimatedTotalCostUsd.toFixed(2)),
                  color: PROVIDER_COLORS.shotstackSlideshow,
                }))}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {usage.map((u) => (
              <div key={u.eventId} className="rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
                <div>
                  <h3 className="font-display text-base text-navy-950">{u.honoreeName}</h3>
                  <p className="text-xs text-navy-700/50">{u.eventTitle}</p>
                </div>
                <div className="mt-4">
                  <PieChart
                    centerLabel={formatUsd(u.estimatedTotalCostUsd)}
                    data={[
                      { label: "AI Image", value: u.estimatedAiImageCostUsd, color: PROVIDER_COLORS.aiImage },
                      {
                        label: "Shotstack — Slideshow",
                        value: u.estimatedShotstackSlideshowCostUsd,
                        color: PROVIDER_COLORS.shotstackSlideshow,
                      },
                      {
                        label: "Shotstack — Video Editor",
                        value: u.estimatedShotstackVideoEditorCostUsd,
                        color: PROVIDER_COLORS.shotstackVideoEditor,
                      },
                    ]}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-navy-700/70">
                  <div className="flex items-center justify-between rounded-lg bg-ivory-100 px-2.5 py-1.5">
                    <dt>AI Images</dt>
                    <dd className="font-medium text-navy-950">{u.aiImageCount}</dd>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-ivory-100 px-2.5 py-1.5">
                    <dt>Slideshow renders</dt>
                    <dd className="font-medium text-navy-950">
                      {u.slideshowCount} · {formatUsd(u.estimatedShotstackSlideshowCostUsd)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-ivory-100 px-2.5 py-1.5">
                    <dt>Video Editor renders</dt>
                    <dd className="font-medium text-navy-950">
                      {u.videoEditorCount} · {formatUsd(u.estimatedShotstackVideoEditorCostUsd)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-ivory-100 px-2.5 py-1.5">
                    <dt>Storage</dt>
                    <dd className="font-medium text-navy-950">{formatBytes(u.storageBytes)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
