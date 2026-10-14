import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { listDemoEvents } from "@/services/demo-events";
import { getTemplateSummaryBySlug } from "@/lib/template-catalog";
import { EVENT_CATEGORY_LABELS } from "@/lib/event-category";
import type { EventCategory } from "@/types/event";

/**
 * Cards for the public sample events (events.is_demo) — on the homepage and
 * /samples. Each opens the real, live sample page in a new tab. Renders
 * nothing when there are no samples.
 */
export async function SampleEventsGrid({ tone = "light" }: { tone?: "light" | "dark" }) {
  const samples = await listDemoEvents();
  if (samples.length === 0) return null;
  const dark = tone === "dark";

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {samples.map((sample) => {
        const template = getTemplateSummaryBySlug(sample.templateSlug);
        const label = EVENT_CATEGORY_LABELS[sample.category as EventCategory] ?? "Event";
        return (
          <li key={sample.slug}>
            <Link
              href={`/events/${sample.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={
                dark
                  ? "group flex h-full flex-col overflow-hidden rounded-2xl border border-ivory-100/10 bg-navy-900/60 transition-luxury duration-300 hover:-translate-y-1 hover:border-gold-400/40"
                  : "group flex h-full flex-col overflow-hidden rounded-2xl border border-navy-950/10 bg-white shadow-sm transition-luxury duration-300 hover:-translate-y-1 hover:shadow-lg"
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={template.thumbnail} alt="" className="aspect-[4/3] w-full object-cover transition-luxury duration-500 group-hover:scale-[1.03]" />
              <div className="flex flex-1 flex-col p-5">
                <p className={dark ? "text-xs uppercase tracking-[0.2em] text-gold-300" : "text-xs uppercase tracking-[0.2em] text-gold-600"}>
                  {label} · {template.name} template
                </p>
                <h3 className={dark ? "mt-2 font-display text-xl text-ivory-50" : "mt-2 font-display text-xl text-navy-950"}>
                  {sample.honoreeName}
                </h3>
                <p className={dark ? "mt-1 text-sm text-ivory-100/70" : "mt-1 text-sm text-navy-700/80"}>{sample.eventTitle}</p>
                <span
                  className={
                    dark
                      ? "mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-gold-300"
                      : "mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-gold-700"
                  }
                >
                  View sample <ArrowUpRight size={15} aria-hidden="true" />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
