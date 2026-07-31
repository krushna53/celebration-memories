import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { listEventGames, listGameAttempts } from "@/services/games";
import { GamesManager } from "@/features/admin/games/games-manager";
import type { GameAttemptRecord } from "@/types/games";

export const dynamic = "force-dynamic";

export default async function AdminGamesPage() {
  const admin = await getCurrentAdmin();
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return (
      <p className="text-navy-700">
        No event is assigned to this account yet. Clients: contact the site owner to get linked to your event.
      </p>
    );
  }

  const games = await listEventGames(event.id);
  const attemptsEntries = await Promise.all(games.map(async (g) => [g.id, await listGameAttempts(g.id)] as const));
  const attemptsByGame: Record<string, GameAttemptRecord[]> = Object.fromEntries(attemptsEntries);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Games</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Digital party games for guests — create a word search, share the link or QR code, and watch scores come in.
      </p>
      <div className="mt-6">
        <GamesManager eventId={event.id} honoreeName={event.honoreeName} initialGames={games} attemptsByGame={attemptsByGame} />
      </div>
    </div>
  );
}
