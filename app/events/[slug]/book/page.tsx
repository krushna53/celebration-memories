import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BookReader } from "@/features/life-story/book-reader";
import { toBookData } from "@/features/life-story/book-data";
import { EventUnpublishedScreen } from "@/features/event-landing/event-unpublished-screen";
import { getEventBySlug } from "@/services/events";
import { getEventBook } from "@/services/life-story";
import { eventPermissions } from "@/services/event-access";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/**
 * "Read the Book" from a Biography event page: the AI-written biography as
 * a book to page through. Same access as the event page itself (the
 * /events/[slug] layout's protectTokenPage), so no separate share switch.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug).catch(() => null);
  const title = event ? `The Life of ${event.honoreeName}` : "The Book";
  // Family content: shareable by link, never indexed.
  return { title, description: event ? `The life story of ${event.honoreeName}.` : undefined, robots: { index: false, follow: false } };
}

export default async function EventBookPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();
  if (event.pageStatus === "unpublished") return <EventUnpublishedScreen eventTitle={event.eventTitle} />;

  const bundle = await getEventBook(event.id);
  if (!bundle) notFound();
  // Only a Biography's page publishes its book; any other event's life story is for its team (or its share link).
  if (event.category !== "biography" && !(await eventPermissions(event.id)).manage) notFound();

  return (
    <main>
      <BookReader
        book={toBookData(bundle, event.hostedBy ? `Shared by ${event.hostedBy}` : "")}
        bundle={bundle}
        backHref={`/events/${encodeURIComponent(event.slug)}`}
        backLabel="Back to the page"
      />
    </main>
  );
}
