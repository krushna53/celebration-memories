import Link from "next/link";
import { Sparkles } from "lucide-react";

import { supabaseAdmin } from "@/lib/supabase/admin";

async function isDemoEvent(eventId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin().from("events").select("is_demo").eq("id", eventId).maybeSingle<{ is_demo: boolean }>();
    return !error && Boolean(data?.is_demo);
  } catch {
    return false;
  }
}

/**
 * Shown only on sample events (events.is_demo) — a slim strip under the
 * hero telling visitors this is a demo and inviting them to build their
 * own at /start. Renders nothing on every real event.
 */
export async function DemoEventStrip({ eventId }: { eventId: string }) {
  if (!(await isDemoEvent(eventId))) return null;
  return (
    <div className="border-y border-gold-500/20 bg-gold-500/10 px-4 py-4">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <p className="flex items-center gap-2 text-sm text-navy-950">
          <Sparkles size={16} className="shrink-0 text-gold-600" aria-hidden="true" />
          <span>
            <strong className="font-semibold">This is a sample event</strong> made with EveryMoment — invites, RSVP,
            photos and more, all from one link.
          </span>
        </p>
        <Link
          href="/start"
          className="shrink-0 rounded-full bg-gold-500 px-5 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-luxury duration-200 hover:brightness-110"
        >
          Create your own — free
        </Link>
      </div>
    </div>
  );
}
