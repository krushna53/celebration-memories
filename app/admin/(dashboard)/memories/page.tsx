import { EVENT_SLUG } from "@/lib/constants";
import { getEventBySlug } from "@/services/events";
import { listMemoriesForModeration } from "@/services/admin-memories";
import { ModerationList } from "@/features/admin/memories/moderation-list";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function AdminMemoriesPage({ searchParams }: PageProps) {
  const { filter } = await searchParams;
  const showAll = filter === "all";

  const event = await getEventBySlug(EVENT_SLUG);
  if (!event) {
    return <p className="text-navy-700">No event found. Check your Supabase seed data.</p>;
  }

  const items = await listMemoriesForModeration(event.id, showAll ? "all" : "pending");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy-950">Memory Moderation</h1>
          <p className="mt-1 text-sm text-navy-700/60">
            Approve, feature, or remove guest photos, videos, audio, and guest book messages.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <a
            href="/admin/memories"
            className={`rounded-full px-3 py-1.5 ${!showAll ? "bg-gold-500 text-navy-950" : "border border-navy-950/15 text-navy-700/70"}`}
          >
            Pending
          </a>
          <a
            href="/admin/memories?filter=all"
            className={`rounded-full px-3 py-1.5 ${showAll ? "bg-gold-500 text-navy-950" : "border border-navy-950/15 text-navy-700/70"}`}
          >
            All
          </a>
        </div>
      </div>

      <ModerationList items={items} />
    </div>
  );
}
