import { CalendarX } from "lucide-react";

/**
 * Shown in place of the full event site when page_status = "unpublished".
 * The host has chosen to take the page down after the event ended.
 */
export function EventUnpublishedScreen({ eventTitle }: { eventTitle?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ivory-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy-950/8 text-navy-700/40">
        <CalendarX size={28} />
      </div>
      <h1 className="mt-6 font-display text-2xl text-navy-950 sm:text-3xl">
        {eventTitle ? `${eventTitle}` : "This event"} has ended
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-navy-700/60">
        The host has chosen to take this page offline. Thank you for being part of the celebration.
      </p>
      <a
        href="https://everymoment.in"
        className="mt-8 text-xs tracking-widest text-gold-600 underline underline-offset-4 hover:text-gold-700"
      >
        everymoment.in
      </a>
    </div>
  );
}
