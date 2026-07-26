import Image from "next/image";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MemoryItem } from "@/types/memory";
import { VideoPlayer } from "@/features/memory-wall/components/video-player";
import { MediaShareButtons } from "@/components/media/media-share-buttons";

interface MemoryCardProps {
  item: MemoryItem;
}

export function MemoryCard({ item }: MemoryCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm",
        item.featured ? "border-gold-500/50 ring-1 ring-gold-500/30" : "border-navy-950/8",
      )}
    >
      {item.featured ? (
        <div className="flex items-center gap-1.5 bg-gold-500/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.15em] text-gold-600">
          <Sparkles size={12} /> Featured
        </div>
      ) : null}

      {item.kind === "photo" ? (
        <div className="relative aspect-[4/3] w-full bg-navy-950/5">
          <Image src={item.url} alt={item.caption ?? "Guest photo"} fill className="object-cover" />
          {/* Always visible, not hover-only — most guests share from a phone, which has no hover state. */}
          <MediaShareButtons
            url={item.url}
            fileNameBase={`${item.author.name}-photo`}
            shareText={`A photo from ${item.author.name}`}
            className="absolute right-2 top-2 flex gap-1.5"
          />
        </div>
      ) : null}

      {item.kind === "video" ? (
        <div className="relative">
          <VideoPlayer url={item.url} />
          <MediaShareButtons
            url={item.url}
            fileNameBase={`${item.author.name}-video`}
            shareText={`A video from ${item.author.name}`}
            className="absolute right-2 top-2 z-10 flex gap-1.5"
          />
        </div>
      ) : null}

      {item.kind === "audio" ? (
        <div className="bg-navy-950 px-4 py-6">
          <audio controls src={item.url} className="w-full" />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-2 p-4">
        {item.kind === "guestbook" && item.thumbnailUrl ? (
          <div className="relative mb-1 aspect-[4/3] w-full overflow-hidden rounded-lg">
            <Image src={item.thumbnailUrl} alt="" fill className="object-cover" />
          </div>
        ) : null}

        {item.message ? (
          <p className="text-sm italic leading-relaxed text-navy-950">&ldquo;{item.message}&rdquo;</p>
        ) : null}

        {item.caption ? <p className="text-sm text-navy-700/80">{item.caption}</p> : null}

        <p className="mt-auto text-xs text-navy-700/50">
          {item.author.name}
          {item.author.relationship ? ` · ${item.author.relationship}` : ""}
          {item.country ? ` · ${item.country}` : ""}
        </p>
      </div>
    </div>
  );
}
