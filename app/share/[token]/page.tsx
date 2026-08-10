import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { getShareCollectionByToken } from "@/services/share-collections";
import { getCoverPhoto } from "@/services/gallery-photos";
import { publicMediaUrl } from "@/services/uploads";
import { toEventDisplayData } from "@/lib/event-display";
import { SITE_NAME } from "@/lib/constants";
import { MEDIA_LIBRARY_KIND_LABEL, type MediaLibraryKind } from "@/lib/media-library-kinds";
import { CollectionShareBar } from "@/features/share-collection/collection-share-bar";

export const revalidate = 60;

interface SharePageProps {
  params: Promise<{ token: string }>;
}

const IMAGE_KINDS: readonly MediaLibraryKind[] = ["gallery", "photo", "ai_image"];
const VIDEO_KINDS: readonly MediaLibraryKind[] = ["video", "slideshow_video", "video_edit", "timeline_movie"];

/**
 * Public, no-login page for a multi-select "Share Collection" link
 * (task #83) — the bundle-of-items counterpart to task #80's single-item
 * /p/[kind]/[id] page. Same bearer-link trust model: reachable by
 * anyone with the token, no admin auth required, but every item is
 * re-resolved fresh (and re-checked for approval/deletion) at render
 * time by getShareCollectionByToken, so nothing unapproved/deleted ever
 * leaks through a stale link.
 */
export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const collection = await getShareCollectionByToken(token);
  if (!collection) return { title: `Not found — ${SITE_NAME}` };

  const data = toEventDisplayData(collection.event);
  const title = collection.title || `Photos & Videos — ${data.honoreeName}'s ${data.eventTitle}`;
  const description = `${collection.items.length} shared via ${SITE_NAME} · Hosted by ${data.hostedBy}.`;

  const firstImage = collection.items.find((it) => IMAGE_KINDS.includes(it.kind));
  const ogImage =
    firstImage?.url ??
    (collection.event.shareImagePath
      ? publicMediaUrl("gallery", collection.event.shareImagePath)
      : await getCoverPhoto(collection.event.id).catch(() => null));

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: ogImage ? [{ url: ogImage, width: 1200, height: 900 }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function SharedCollectionPage({ params }: SharePageProps) {
  const { token } = await params;
  const collection = await getShareCollectionByToken(token);
  if (!collection) notFound();

  const data = toEventDisplayData(collection.event);
  const pageUrl = `/share/${token}`;
  const shareText = collection.title || `Photos & Videos — ${data.honoreeName}'s ${data.eventTitle}`;

  return (
    <SiteShell
      honoreeName={collection.event.honoreeName}
      navLinks={[{ label: `Visit ${data.honoreeName}'s site`, href: `/events/${collection.event.slug}` }]}
      footerVariant="minimal"
      hideChatWidget
      homeHref={`/events/${collection.event.slug}`}
    >
      <div className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-6">
        <Link
          href={`/events/${collection.event.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-navy-700/70 transition-luxury duration-200 hover:text-gold-600"
        >
          <ArrowLeft size={15} /> {data.honoreeName}&rsquo;s {data.eventTitle}
        </Link>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-navy-950">{shareText}</h1>
            <p className="mt-1 text-sm text-navy-700/50">
              {collection.items.length} item{collection.items.length === 1 ? "" : "s"}
            </p>
          </div>
          <CollectionShareBar pageUrl={pageUrl} text={shareText} />
        </div>

        {collection.items.length === 0 ? (
          <p className="mt-10 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
            Nothing to show — every item in this collection has since been removed.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collection.items.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="overflow-hidden rounded-xl border border-navy-950/10 bg-white shadow-sm">
                {IMAGE_KINDS.includes(item.kind) ? (
                  <div className="relative aspect-[4/3] w-full bg-navy-950/5">
                    <Image src={item.url} alt={item.caption ?? ""} fill className="object-cover" />
                  </div>
                ) : VIDEO_KINDS.includes(item.kind) ? (
                  <video controls src={item.url} className="aspect-video w-full bg-navy-950" />
                ) : (
                  <div className="bg-navy-950 px-4 py-6">
                    <audio controls src={item.url} className="w-full" />
                  </div>
                )}
                <div className="p-3">
                  <span className="text-xs uppercase tracking-wide text-navy-700/40">{MEDIA_LIBRARY_KIND_LABEL[item.kind]}</span>
                  {item.caption ? <p className="mt-0.5 line-clamp-2 text-sm text-navy-700/80">{item.caption}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
