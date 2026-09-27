"use client";

import { useState } from "react";
import { CheckCircle2, Instagram, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InstagramEmbed } from "@/components/media/instagram-embed";
import { parseInstagramUrl } from "@/lib/instagram";
import { submitInstagramPostAction } from "@/features/uploads/actions";

/**
 * "Share an Instagram post": paste a link to a public post or reel,
 * see Instagram's own preview, add an optional caption, send it to the
 * host's moderation queue. Nothing is copied from Instagram — the
 * memory wall shows Instagram's embed of the original post.
 */
export function InstagramLinkForm({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(0);

  const parsed = url.trim() ? parseInstagramUrl(url) : null;

  async function submit() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    const result = await submitInstagramPostAction(token, parsed.permalink, caption.trim());
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSent((n) => n + 1);
    setUrl("");
    setCaption("");
  }

  return (
    <div className="flex flex-col gap-3">
      {sent > 0 ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle2 size={16} /> Shared! It will appear on the memory wall once the host approves it. Add another?
        </p>
      ) : null}
      <label className="text-xs font-medium uppercase tracking-widest text-navy-700/60" htmlFor="instagram-url">
        Instagram post or reel link
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-navy-950/15 bg-white px-3 focus-within:border-gold-500">
        <Instagram size={16} className="shrink-0 text-navy-700/50" />
        <input
          id="instagram-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/…"
          inputMode="url"
          autoComplete="off"
          className="w-full bg-transparent py-2.5 text-sm outline-none"
        />
      </div>
      <p className="text-xs text-navy-700/60">
        In Instagram tap <strong>Share → Copy link</strong> on a post or reel, then paste it here. The post must be public.
      </p>
      {url.trim() && !parsed ? (
        <p className="text-xs text-red-600">That doesn&rsquo;t look like a link to an Instagram post or reel.</p>
      ) : null}
      {parsed ? (
        <>
          <InstagramEmbed key={parsed.permalink} permalink={parsed.permalink} className="mx-auto w-full max-w-sm" />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
            placeholder="Add a caption (optional)"
            className="rounded-lg border border-navy-950/15 px-3 py-2 text-sm"
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <Button type="button" onClick={submit} disabled={busy} className="self-start">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Instagram size={15} />} Share this post
          </Button>
        </>
      ) : null}
    </div>
  );
}
