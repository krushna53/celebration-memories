"use client";

import { AnimalSoundsGame } from "@/features/games/animal-sounds-game";
import { BubblePopGame } from "@/features/games/bubble-pop-game";
import { MemoryMatchGame } from "@/features/games/memory-match-game";
import { SoloGameShell } from "@/features/games/solo-game-shell";
import type { AnimalSoundsConfig, BubblePopConfig, GameConfig } from "@/types/games";

/** /games/[token] for the three kids' games — the shared shell around whichever game this is. */
export function KidsGame({
  token,
  type,
  title,
  config,
  photoUrls,
}: {
  token: string;
  type: "bubble_pop" | "animal_sounds" | "memory_match";
  title: string;
  config: GameConfig;
  photoUrls: string[];
}) {
  return (
    <SoloGameShell token={token} type={type} title={title}>
      {({ finish, round }) =>
        type === "bubble_pop" ? (
          <BubblePopGame key={round} config={config as BubblePopConfig} finish={finish} />
        ) : type === "animal_sounds" ? (
          <AnimalSoundsGame key={round} config={config as AnimalSoundsConfig} finish={finish} />
        ) : (
          <MemoryMatchGame key={round} photoUrls={photoUrls} finish={finish} />
        )
      }
    </SoloGameShell>
  );
}
