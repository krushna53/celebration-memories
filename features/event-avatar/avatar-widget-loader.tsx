import { listEventGames } from "@/services/games";
import { AvatarWidget } from "@/features/event-avatar/avatar-widget";

interface AvatarWidgetLoaderProps {
  eventId: string;
  honoreeName: string;
}

/**
 * Async Server Component wrapper (same reasoning as
 * EventDayHomepageSection) so avatar-widget.tsx can stay a plain "use
 * client" component while this still fetches the active-games list
 * server-side for the quick-link chips.
 */
export async function AvatarWidgetLoader({ eventId, honoreeName }: AvatarWidgetLoaderProps) {
  let games: { title: string; url: string }[] = [];
  try {
    const all = await listEventGames(eventId);
    games = all.filter((g) => g.isActive).map((g) => ({ title: g.title, url: `/games/${g.shareToken}` }));
  } catch (err) {
    console.error("AvatarWidgetLoader failed to load games:", err);
  }

  return <AvatarWidget eventId={eventId} honoreeName={honoreeName} games={games} />;
}
