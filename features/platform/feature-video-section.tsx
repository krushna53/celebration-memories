import { parseFeatureVideoUrl } from "@/lib/feature-video";
import { Reveal } from "@/components/motion/reveal";
import type { PlatformVideoSettings } from "@/services/platform-video-settings";

/**
 * "See It In Action" — the owner's optional platform feature/promo
 * video, shown on the homepage right after the hero CTAs and before the
 * features grid. See app/admin/(dashboard)/platform-video/page.tsx for
 * where this is configured. Renders nothing if disabled, unset, or the
 * URL couldn't be parsed into something playable.
 */
export function FeatureVideoSection({ settings }: { settings: PlatformVideoSettings }) {
  if (!settings.enabled || !settings.videoUrl) return null;

  const parsed =
    settings.sourceType === "upload"
      ? { platform: "direct" as const, embedUrl: null, directUrl: settings.videoUrl }
      : parseFeatureVideoUrl(settings.videoUrl);

  if (!parsed.embedUrl && !parsed.directUrl) return null;

  return (
    <div className="bg-navy-950 py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          {settings.title ? (
            <h2 className="text-center font-display text-2xl text-ivory-50 sm:text-3xl">{settings.title}</h2>
          ) : (
            <p className="text-center text-xs uppercase tracking-[0.3em] text-gold-300">See It In Action</p>
          )}
          <div className="mx-auto mt-7 aspect-video overflow-hidden rounded-2xl border border-gold-500/20 shadow-2xl shadow-black/40">
            {parsed.embedUrl ? (
              <iframe
                src={parsed.embedUrl}
                className="h-full w-full"
                title={settings.title ?? "EveryMoment feature video"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video src={parsed.directUrl ?? undefined} controls playsInline className="h-full w-full bg-black" />
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
