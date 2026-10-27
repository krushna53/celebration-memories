import { CalendarCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/** Stands in for the hero countdown while the date poll is open — jumps to the "Pick a Date" section. */
export function DatePollHeroLink({ className }: { className?: string }) {
  return (
    <a
      href="#date-poll"
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3 text-sm font-medium text-navy-950 shadow-sm transition-colors hover:bg-gold-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300",
        className,
      )}
    >
      <CalendarCheck size={16} aria-hidden="true" />
      Vote for a date
    </a>
  );
}
