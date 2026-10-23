import { ArrowRight, History } from "lucide-react";

/**
 * On a guest's personal invite page while the host has Timeline
 * contributions open: a link to /events/[slug]/timeline/share carrying
 * their own invite token, so they aren't asked for their name again.
 */
export function TimelineShareCard({ href, honoreeName }: { href: string; honoreeName: string }) {
  return (
    <a
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-gold-500/25 bg-white p-5 text-left shadow-sm transition-colors hover:border-gold-500/60"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
        <History size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg text-navy-950">Add to {honoreeName}&rsquo;s Timeline</span>
        <span className="block text-sm text-navy-700/70">Have old photos from a moment in their life? Share them for the timeline.</span>
      </span>
      <ArrowRight size={18} className="shrink-0 text-gold-600 transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}
