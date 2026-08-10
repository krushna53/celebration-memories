import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { getPublicMediaItem, isPublicMediaKind } from "@/services/public-media";
import { getCoverPhoto } from "@/services/gallery-photos";
import { publicMediaUrl } from "@/services/uploads";
import { toEventDisplayData } from "@/lib/event-display";
import { SITE_NAME } from "@/lib/constants";
import { MediaShareButtons } from "@/components/media/media-share-buttons";

export const revalidate = 60;

interface PublicMediaPageProps {
  params: Promise<{ kind: string; id: string }>;
}

/**
 * Public, crawlable link-preview page for one Gallery photo or approved
 * guest photo/video (task #80). Exists purely so the branded share
 * buttons in MediaShareButtons have a real webpage — with proper Open
 * Graph tags — to point WhatsApp/Facebook/X/Telegram at, since those
 * platforms build their preview card by crawling a URL's <meta> tags, and
 * a raw Supabase Storage file URL has none. Reachable by anyone with the
 * link (same bearer-link trust model as an invite/event-day link) — the
 * underlying item must already be approved (guest uploads) or Gallery-
 * curated (admin uploads), so nothing unmoderated is exposed this way.
 */
export async function generateMetadata({ params }: PublicMediaPageProps): Promise<Metadata> {
  const { kind, id } = await params;
  if (!isPublicMediaKind(kind)) return { title: `Not found — ${SITE_NAME}` };

  const item = await getPublicMediaItem(kind, id);
  if (!item) return { title: `Not found — ${SITE_NAME}` };

  const data = toEventDisplayData(item.event);
  const title = item.authorName
    ? `A memory from ${item.authorName} — ${data.honoreeName}'s ${data.eventTitle}`
    : `${data.honoreeName}'s ${data.eventTitle}`;
  const description = `Shared via ${SITE_NAME} · Hosted by ${data.hostedBy}.`;

  let ogImage: string | null = item.kind === "video" ? null : item.url;
  if (!ogImage) {
    ogImage = item.event.shareImagePath
      ? publicMediaUrl("gallery", item.event.shareImagePath)
      : await getCoverPhoto(item.event.id).catch(() => null);
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: ogImage ? [{ url: ogImage, width: 1200, height: 900 }] : undefined,
      videos: item.kind === "video" ? [{ url: item.url, secureUrl: item.url, type: "video/mp4" }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function PublicMediaPage({ params }: PublicMediaPageProps) {
  const { kind, id } = await params;
  if (!isPublicMediaKind(kind)) notFound();

  const item = await getPublicMediaItem(kind, id);
  if (!item) notFound();

  const data = toEventDisplayData(item.event);
  const pageUrl = `/p/${kind}/${id}`;
  const shareText = item.authorName ? `A memory from ${item.authorName} — ${data.honoreeName}'s ${data.eventTitle}` : `${data.honoreeName}'s ${data.eventTitle}`;

  return (
    <SiteShell
      honoreeName={item.event.honoreeName}
      navLinks={[{ label: `Visit ${data.honoreeName}'s site`, href: `/events/${item.event.slug}` }]}
      footerVariant="minimal"
      hideChatWidget
      homeHref={`/events/${item.event.slug}`}
    >
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-28 sm:px-6">
        <Link
          href={`/events/${item.event.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-navy-700/70 transition-luxury duration-200 hover:text-gold-600"
        >
          <ArrowLeft size={15} /> {data.honoreeName}&rsquo;s {data.eventTitle}
        </Link>

        <div className="mt-6 overflow-hidden rounded-2xl border border-navy-950/10 bg-white shadow-sm">
          {item.kind === "video" ? (
            <video controls src={item.url} className="w-full bg-navy-950" />
          ) : (
            <div className="relative aspect-[4/3] w-full bg-navy-950/5">
              <Image src={item.url} alt={item.caption ?? shareText} fill className="object-cover" />
            </div>
          )}

          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {item.caption ? <p className="text-sm text-navy-950">{item.caption}</p> : null}
              <p className="mt-0.5 text-xs text-navy-700/50">
                {item.authorName ? `Shared by ${item.authorName} · ` : ""}
                {data.honoreeName}&rsquo;s {data.eventTitle}
              </p>
            </div>
            <MediaShareButtons url={item.url} fileNameBase={`${data.honoreeName}-memory`} shareText={shareText} pageUrl={pageUrl} className="flex gap-1.5" />
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
