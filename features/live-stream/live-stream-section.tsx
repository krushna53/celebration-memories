import { Radio } from "lucide-react";

import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { parseLiveStreamUrl } from "@/lib/live-stream";

interface LiveStreamSectionProps {
  enabled: boolean;
  url: string | null;
}

/**
 * Simple-embed live streaming (#72) — renders an embedded YouTube
 * Live / Facebook Live player when the admin has turned the section on
 * and pasted a valid URL (see lib/live-stream.ts for the URL parsing).
 * Returns null in every other case (disabled, no URL, or an
 * unrecognized URL that couldn't be parsed) so an event that isn't
 * streaming shows nothing here at all, same as how Gallery/Memory Wall
 * quietly no-op when there's no content yet — never a broken-looking
 * empty section.
 */
export function LiveStreamSection({ enabled, url }: LiveStreamSectionProps) {
  if (!enabled) return null;

  const { embedUrl } = parseLiveStreamUrl(url);
  if (!embedUrl) return null;

  return (
    <section id="live-stream" className="bg-navy-950 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Watch Along"
            title="Live Now"
            description="Can't make it in person? Join the celebration live."
            tone="dark"
          />
          <div className="mt-10 flex items-center justify-center gap-2 text-sm font-medium text-red-400">
            <Radio size={16} className="animate-pulse" /> LIVE
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 shadow-lg">
            <div className="aspect-video w-full">
              <iframe
                src={embedUrl}
                title="Live stream"
                allow="autoplay; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
