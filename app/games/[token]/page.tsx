import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { getGameByShareToken } from "@/services/games";
import { WordSearchGame } from "@/features/games/word-search-game";
import { HousieGame } from "@/features/games/housie-game";
import { KidsGame } from "@/features/games/kids-game";
import { publicMediaUrl } from "@/services/uploads";
import type { MemoryMatchConfig, WordSearchConfig } from "@/types/games";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Party Game",
  robots: { index: false, follow: false },
};

export default async function PublicGamePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const game = await getGameByShareToken(token);

  if (!game) {
    return (
      <SiteShell honoreeName="EveryMoment" footerVariant="minimal">
        <div className="bg-ivory-50 px-4 py-24 text-center">
          <h1 className="font-display text-2xl text-navy-950">Game not available</h1>
          <p className="mt-2 text-sm text-navy-700/60">
            This game link isn&rsquo;t active anymore. Ask your host for a current link.
          </p>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell honoreeName="EveryMoment" footerVariant="minimal">
      <div className="bg-ivory-50 px-4 py-10 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-xl">
          {game.type === "word_search" ? (
            <WordSearchGame token={token} title={game.title} config={game.config as WordSearchConfig} />
          ) : game.type === "bubble_pop" || game.type === "animal_sounds" || game.type === "memory_match" ? (
            <KidsGame
              token={token}
              type={game.type}
              title={game.title}
              config={game.config}
              // Memory Match photos live in the private gallery bucket — sign them for this visit.
              photoUrls={
                game.type === "memory_match"
                  ? ((game.config as MemoryMatchConfig).photos ?? []).map((path) => publicMediaUrl("gallery", path))
                  : []
              }
            />
          ) : (
            <HousieGame token={token} type={game.type} title={game.title} />
          )}
        </div>
      </div>
    </SiteShell>
  );
}
