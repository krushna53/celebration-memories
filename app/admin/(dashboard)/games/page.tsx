import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { listEventGames, listGameAttempts, listClaimsForGame, listTicketsForGame } from "@/services/games";
import { GamesManager } from "@/features/admin/games/games-manager";
import type { GameAttemptRecord, GameClaimRecord } from "@/types/games";
import { NoEventState } from "@/features/admin/components/no-event-state";

export const dynamic = "force-dynamic";

export default async function AdminGamesPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <NoEventState />;
  }

  const games = await listEventGames(event.id);

  const attemptsByGame: Record<string, GameAttemptRecord[]> = {};
  const claimsByGame: Record<string, GameClaimRecord[]> = {};
  const ticketCountByGame: Record<string, number> = {};

  await Promise.all(
    games.map(async (g) => {
      if (g.type === "word_search") {
        attemptsByGame[g.id] = await listGameAttempts(g.id);
      } else {
        const [claims, tickets] = await Promise.all([listClaimsForGame(g.id), listTicketsForGame(g.id)]);
        claimsByGame[g.id] = claims;
        ticketCountByGame[g.id] = tickets.length;
      }
    }),
  );

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Games</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Digital party games for guests — create a game, share the link or QR code, and watch scores or claims come in.
      </p>
      <div className="mt-6">
        <GamesManager
          eventId={event.id}
          honoreeName={event.honoreeName}
          initialGames={games}
          attemptsByGame={attemptsByGame}
          claimsByGame={claimsByGame}
          ticketCountByGame={ticketCountByGame}
        />
      </div>
    </div>
  );
}
