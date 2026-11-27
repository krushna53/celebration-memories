"use client";

import { useState } from "react";
import { BookOpen, Clapperboard, FileText, Images, Share2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { LifeStoryBundle } from "@/types/life-story";
import { StoryPanel } from "@/features/admin/life-story/story-panel";
import { PhotosPanel } from "@/features/admin/life-story/photos-panel";
import { ChaptersPanel } from "@/features/admin/life-story/chapters-panel";
import { FilmPanel } from "@/features/admin/life-story/film-panel";
import { SharePanel } from "@/features/admin/life-story/share-panel";

const TABS = [
  { id: "story", label: "1. Story", icon: FileText },
  { id: "photos", label: "2. Photos", icon: Images },
  { id: "biography", label: "3. Biography", icon: BookOpen },
  { id: "share", label: "4. Share", icon: Share2 },
  { id: "film", label: "Film (optional)", icon: Clapperboard },
] as const;
type TabId = (typeof TABS)[number]["id"];

export interface LifeStoryEditorProps {
  eventId: string;
  bundle: LifeStoryBundle;
  shareUrl: string;
  /** The book reader for this event (/events/<slug>/book). */
  bookHref: string;
  /** Remaining paid runs for a client-role host; null = no cap (platform owner). */
  quota: { writesLeft: number; filmsLeft: number } | null;
  aiConfigured: boolean;
}

/**
 * The Life Story editor: story, photos, the written biography and sharing,
 * plus the optional narrated film. Each panel saves through its own Server
 * Action; panels that depend on AI output (Biography, Film) read the bundle
 * the page re-renders after router.refresh().
 */
export function LifeStoryEditor(props: LifeStoryEditorProps) {
  const { bundle } = props;
  const [tab, setTab] = useState<TabId>(bundle.story.storyText.trim() ? (bundle.chapters.length ? "biography" : "photos") : "story");

  return (
    <div>
      <div role="tablist" aria-label="Life Story steps" className="flex gap-1 overflow-x-auto border-b border-navy-950/10">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors",
              tab === id ? "border-gold-500 font-medium text-navy-950" : "border-transparent text-navy-700/60 hover:text-navy-950",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6" role="tabpanel">
        {tab === "story" && <StoryPanel eventId={props.eventId} story={bundle.story} onDone={() => setTab("photos")} />}
        {tab === "photos" && (
          <PhotosPanel
            eventId={props.eventId}
            photos={bundle.photos}
            coverPhotoId={bundle.story.coverPhotoId}
            onDone={() => setTab("biography")}
          />
        )}
        {tab === "biography" && (
          <ChaptersPanel
            eventId={props.eventId}
            bundle={bundle}
            writesLeft={props.quota?.writesLeft ?? null}
            aiConfigured={props.aiConfigured}
            bookHref={props.bookHref}
          />
        )}
        {tab === "film" && <FilmPanel eventId={props.eventId} bundle={bundle} filmsLeft={props.quota?.filmsLeft ?? null} />}
        {tab === "share" && <SharePanel eventId={props.eventId} bundle={bundle} shareUrl={props.shareUrl} bookHref={props.bookHref} />}
      </div>
    </div>
  );
}
