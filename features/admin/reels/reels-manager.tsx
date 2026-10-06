"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  MessageCircle,
  RefreshCw,
  ScanFace,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/image-compression";
import { supabaseBrowser } from "@/lib/supabase/client";
import { REEL_MUSIC, type ReelMusicKey } from "@/lib/reel-music";
import { Button } from "@/components/ui/button";
import { ConsentPhotoPicker } from "@/features/reels/consent-photo-picker";
import type { PoolPhoto, ReelGuest, ReelReference, ReelSettings } from "@/services/guest-reels";
import {
  confirmEventPhotoAction,
  deleteEventPhotoAction,
  generateReelsAction,
  pollReelsAction,
  removeReelFaceMatchAction,
  requestEventPhotoUploadAction,
  resetReelScansAction,
  saveReelScanAction,
  updateReelSettingsAction,
} from "@/features/admin/reels/actions";
import { buildReference, loadFaceApi, scanPhoto, type Reference } from "@/features/admin/reels/face-matcher";

interface ReelsManagerProps {
  eventId: string;
  honoreeName: string;
  hostedBy: string;
  eventEnded: boolean;
  siteUrl: string;
  isOwner: boolean;
  settings: ReelSettings;
  guests: ReelGuest[];
  pool: PoolPhoto[];
  references: ReelReference[];
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            done ? "bg-green-100 text-green-700" : "bg-gold-500/15 text-gold-600",
          )}
        >
          {done ? <Check size={14} /> : n}
        </span>
        <h2 className="font-display text-lg text-navy-950">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  rendering: "Rendering…",
  done: "Ready",
  error: "Failed",
};

export function ReelsManager({
  eventId,
  honoreeName,
  hostedBy,
  eventEnded,
  siteUrl,
  isOwner,
  settings,
  guests: initialGuests,
  pool,
  references,
}: ReelsManagerProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [music, setMusic] = useState<ReelMusicKey>(settings.music);
  const [guests, setGuests] = useState(initialGuests);
  const [openGuest, setOpenGuest] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [scan, setScan] = useState<{ stage: string; done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setGuests(initialGuests), [initialGuests]);

  const optedIn = guests.filter((g) => g.photoUrl);
  const found = optedIn.filter((g) => g.togetherCount + g.soloCount > 0);
  const unscanned = pool.filter((p) => !p.scan).length;
  const anyRendering = guests.some((g) => g.reel && (g.reel.status === "queued" || g.reel.status === "rendering"));
  const honoreeRef = references.some((r) => r.key === "honoree");

  // Default selection: everyone found who doesn't have a reel yet.
  useEffect(() => {
    setSelected(new Set(found.filter((g) => !g.reel || g.reel.status === "error").map((g) => g.inviteeId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the found list changes
  }, [found.map((g) => g.inviteeId).join(",")]);

  // Poll while reels render.
  useEffect(() => {
    if (!anyRendering) return;
    let inFlight = false;
    const timer = window.setInterval(async () => {
      // A poll that is copying a finished video can outlast the interval — never overlap two.
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await pollReelsAction(eventId);
        if (result.success) setGuests(result.data);
      } finally {
        inFlight = false;
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [anyRendering, eventId]);

  async function saveSettings(input: { enabled?: boolean; music?: string }) {
    const result = await updateReelSettingsAction(eventId, input);
    if (!result.success) setNotice({ tone: "error", text: result.error });
  }

  async function uploadPhotos(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    setNotice(null);
    setUploading({ done: 0, total: list.length, failed: 0 });
    let failed = 0;
    // Three at a time keeps a phone on mobile data responsive.
    const queue = [...list];
    const worker = async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        try {
          const compressed = await compressImage(file, { maxDimension: 2600, quality: 0.86 });
          const signed = await requestEventPhotoUploadAction(eventId, compressed.name, compressed.type, compressed.size);
          if (!signed.success) throw new Error(signed.error);
          const { bucket, path, token } = signed.data;
          const { error } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, compressed);
          if (error) throw new Error(error.message);
          const confirmed = await confirmEventPhotoAction(eventId, path);
          if (!confirmed.success) throw new Error(confirmed.error);
        } catch (err) {
          failed += 1;
          console.error("Event photo upload failed:", err);
        }
        setUploading((u) => (u ? { ...u, done: u.done + 1, failed } : u));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setUploading(null);
    if (fileRef.current) fileRef.current.value = "";
    setNotice(
      failed
        ? { tone: "warn", text: `${list.length - failed} uploaded, ${failed} failed — try those again.` }
        : { tone: "ok", text: `${list.length} photo${list.length === 1 ? "" : "s"} added. Next: find faces.` },
    );
    router.refresh();
  }

  async function removePhoto(photo: PoolPhoto) {
    if (!window.confirm("Delete this photo from the reel photos?")) return;
    const result = await deleteEventPhotoAction(eventId, photo.sourceId);
    if (!result.success) setNotice({ tone: "error", text: result.error });
    router.refresh();
  }

  async function removeMatch(photo: PoolPhoto, person: { key: string; name: string }) {
    if (!window.confirm(`Remove ${person.name} from this photo? It won't be used in their reel.`)) return;
    const result = await removeReelFaceMatchAction(eventId, photo.source, photo.sourceId, person.key);
    if (!result.success) setNotice({ tone: "error", text: result.error });
    router.refresh();
  }

  async function runScan(all: boolean) {
    setNotice(null);
    try {
      if (all) {
        const reset = await resetReelScansAction(eventId);
        if (!reset.success) throw new Error(reset.error);
      }
      const targets = all ? pool : pool.filter((p) => !p.scan);
      setScan({ stage: "Loading face recognition (first time takes a moment)…", done: 0, total: targets.length });
      const api = await loadFaceApi();

      setScan({ stage: "Learning faces from consent photos…", done: 0, total: targets.length });
      const refs: Reference[] = [];
      const missing: string[] = [];
      for (const r of references) {
        const built = await buildReference(api, r).catch(() => null);
        if (built) refs.push(built);
        else missing.push(r.name);
      }
      if (refs.length === 0) throw new Error("No faces could be read from the consent photos — add clearer photos first.");

      let matches = 0;
      let failures = 0;
      for (let i = 0; i < targets.length; i++) {
        const photo = targets[i]!;
        setScan({ stage: "Finding guests in the photos…", done: i, total: targets.length });
        try {
          const result = await scanPhoto(api, photo.url, refs);
          matches += result.faces.length;
          const saved = await saveReelScanAction(eventId, {
            source: photo.source,
            sourceId: photo.sourceId,
            width: result.width,
            height: result.height,
            faceCount: result.faceCount,
            faces: result.faces,
          });
          if (!saved.success) throw new Error(saved.error);
        } catch (err) {
          failures += 1;
          console.error("Scan failed for photo", photo.sourceId, err);
        }
      }
      setScan(null);
      const parts = [`Scanned ${targets.length} photo${targets.length === 1 ? "" : "s"} and recognised ${matches} face${matches === 1 ? "" : "s"}.`];
      if (missing.length) parts.push(`No face found in the consent photo for: ${missing.join(", ")} — ask for a clearer selfie.`);
      if (failures) parts.push(`${failures} photo(s) couldn't be read.`);
      setNotice({ tone: missing.length || failures ? "warn" : "ok", text: parts.join(" ") });
      router.refresh();
    } catch (err) {
      setScan(null);
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Face scan failed." });
    }
  }

  async function generate(ids: string[]) {
    if (ids.length === 0) return;
    setGenerating(true);
    setNotice(null);
    const result = await generateReelsAction(eventId, ids);
    setGenerating(false);
    if (!result.success) {
      setNotice({ tone: "error", text: result.error });
      return;
    }
    const { queued, skipped } = result.data;
    setNotice({
      tone: skipped.length ? "warn" : "ok",
      text:
        `${queued} reel${queued === 1 ? "" : "s"} rendering — usually 1–3 minutes each.` +
        (skipped.length ? ` Skipped: ${skipped.map((s) => `${s.name} (${s.reason})`).join("; ")}.` : ""),
    });
    const refreshed = await pollReelsAction(eventId);
    if (refreshed.success) setGuests(refreshed.data);
  }

  function shareUrl(g: ReelGuest) {
    return `${siteUrl}/reels/${g.reel!.shareToken}`;
  }

  function whatsappFor(g: ReelGuest) {
    const first = g.name.split(" ")[0];
    const text = `Hi ${first}! ${hostedBy} made you a personal reel from ${honoreeName}'s celebration 🎉 Watch it and share it to your Instagram or WhatsApp Status: ${siteUrl}/invite/${g.token}#reel`;
    const digits = (g.phone ?? "").replace(/\D/g, "");
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  const doneCount = guests.filter((g) => g.reel?.status === "done").length;
  const sortedGuests = useMemo(
    () =>
      [...guests].sort(
        (a, b) =>
          Number(Boolean(b.photoUrl)) - Number(Boolean(a.photoUrl)) ||
          b.togetherCount + b.soloCount - (a.togetherCount + a.soloCount) ||
          a.name.localeCompare(b.name),
      ),
    [guests],
  );

  return (
    <div className="grid gap-5">
      {notice ? (
        <p
          role="status"
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            notice.tone === "ok" && "border-green-200 bg-green-50 text-green-800",
            notice.tone === "warn" && "border-amber-200 bg-amber-50 text-amber-900",
            notice.tone === "error" && "border-red-200 bg-red-50 text-red-700",
          )}
        >
          {notice.text}
        </p>
      ) : null}

      <Step n={1} title="Turn on personal reels" done={enabled}>
        <label className="flex items-start gap-3 text-sm text-navy-700/85">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              void saveSettings({ enabled: e.target.checked });
            }}
            className="mt-0.5 h-4 w-4 rounded border-navy-950/30 text-gold-500 focus:ring-gold-500/40"
          />
          <span>
            Offer guests a personal reel. Guests see an optional <strong>&ldquo;add a selfie&rdquo;</strong> step (with a consent
            checkbox) on their RSVP, and after the event their invite link shows their reel with Instagram / WhatsApp sharing.
          </span>
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="reel-music" className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/60">
            Music
          </label>
          <select
            id="reel-music"
            value={music}
            onChange={(e) => {
              const value = e.target.value as ReelMusicKey;
              setMusic(value);
              void saveSettings({ music: value });
            }}
            className="rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          >
            {Object.entries(REEL_MUSIC).map(([key, track]) => (
              <option key={key} value={key}>
                {track.label}
              </option>
            ))}
          </select>
          {REEL_MUSIC[music].url ? (
            <audio src={REEL_MUSIC[music].url!} controls preload="none" className="h-9 max-w-full" aria-label="Preview music" />
          ) : null}
        </div>
      </Step>

      <Step n={2} title={`Photo of ${honoreeName}`} done={honoreeRef}>
        <p className="mb-3 text-sm text-navy-700/70">
          A clear, front-facing photo of the guest of honour — used to find them in the event photos so every reel features
          them with the guest.
        </p>
        <ConsentPhotoPicker
          target={{ kind: "honoree", eventId }}
          currentPhotoUrl={settings.honoreePhotoUrl}
          consentLabel={
            <>
              {honoreeName} has agreed that this photo may be used to recognise them in this event&apos;s photos and to create
              personalised reels for guests.
            </>
          }
        />
      </Step>

      <Step n={3} title="Guests who opted in" done={optedIn.length > 0}>
        <p className="mb-3 text-sm text-navy-700/70">
          {optedIn.length} of {guests.length} guests have added a photo. Guests add their own on the RSVP form or, after the
          event, on their invite link. You can also add one for a guest <strong>who has agreed</strong>.
        </p>
        <ul className="divide-y divide-navy-950/5 rounded-lg border border-navy-950/10">
          {sortedGuests.map((g) => (
            <li key={g.inviteeId} className="px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                {g.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed /media link
                  <img src={g.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-950/5 text-navy-700/40">
                    <UserRound size={16} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-950">{g.name}</p>
                  <p className="text-xs text-navy-700/55">
                    {g.photoUrl
                      ? `${g.consentSource === "host" ? "Added by host" : "Opted in"} · in ${g.togetherCount} photo${
                          g.togetherCount === 1 ? "" : "s"
                        } with ${honoreeName}, ${g.soloCount} without`
                      : "No photo yet"}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs text-gold-600 underline underline-offset-2"
                  onClick={() => setOpenGuest(openGuest === g.inviteeId ? null : g.inviteeId)}
                >
                  {openGuest === g.inviteeId ? "Close" : g.photoUrl ? "Change photo" : "Add photo"}
                </button>
              </div>
              {openGuest === g.inviteeId ? (
                <div className="mt-3 pl-12">
                  <ConsentPhotoPicker
                    target={{ kind: "invitee", eventId, inviteeId: g.inviteeId }}
                    currentPhotoUrl={g.photoUrl}
                    compact
                    consentLabel={
                      <>
                        {g.name} has agreed that this photo may be used to recognise them in this event&apos;s photos and make
                        them a personal reel.
                      </>
                    }
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Step>

      <Step n={4} title="Photos from the day" done={pool.length > 0}>
        <p className="mb-3 text-sm text-navy-700/70">
          Upload the photographer&apos;s set or anyone&apos;s photos from the event{eventEnded ? "" : " (once it's over)"}. Approved
          guest photos from the Memory Wall are included automatically. These are only used for reels — they don&apos;t
          appear on the public page.
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void uploadPhotos(e.target.files)}
        />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading !== null}>
          {uploading ? <Loader2 className="animate-spin" size={16} /> : <ImagePlus size={16} />}
          {uploading ? `Uploading ${uploading.done}/${uploading.total}…` : "Upload photos"}
        </Button>
        {pool.length > 0 ? (
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {pool.map((p) => (
              <li key={`${p.source}-${p.sourceId}`} className="group relative overflow-hidden rounded-lg bg-navy-950/5">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed /media link */}
                <img src={p.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4 text-[10px] leading-tight text-white">
                  {p.scan ? (
                    p.scan.people.length ? (
                      <span className="flex flex-wrap gap-x-1.5">
                        {p.scan.people.map((person) => (
                          <button
                            key={person.key}
                            type="button"
                            title={`Not ${person.name}? Remove`}
                            onClick={() => void removeMatch(p, person)}
                            className="underline decoration-white/40 underline-offset-2 hover:decoration-white"
                          >
                            {person.name} ×
                          </button>
                        ))}
                      </span>
                    ) : (
                      `${p.scan.faceCount} face${p.scan.faceCount === 1 ? "" : "s"}, none matched`
                    )
                  ) : (
                    "Not scanned"
                  )}
                  {p.source === "memory" ? <span className="block opacity-70">Memory Wall</span> : null}
                </div>
                {p.source === "event" ? (
                  <button
                    type="button"
                    aria-label="Delete photo"
                    onClick={() => void removePhoto(p)}
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Step>

      <Step n={5} title="Find guests in the photos" done={pool.length > 0 && unscanned === 0}>
        <p className="mb-3 text-sm text-navy-700/70">
          Face recognition runs here in your browser — photos aren&apos;t sent to any outside AI service, and only who-is-in-which-photo
          is saved. {honoreeRef ? "" : `Add ${honoreeName}'s photo first for the best reels.`}
        </p>
        {scan ? (
          <div className="grid gap-2" role="status">
            <p className="text-sm text-navy-950">{scan.stage}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-navy-950/5">
              <div
                className="h-full rounded-full bg-gold-500 transition-all"
                style={{ width: `${scan.total ? (scan.done / scan.total) * 100 : 5}%` }}
              />
            </div>
            <p className="text-xs text-navy-700/55">
              {scan.done} / {scan.total} photos — keep this tab open.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void runScan(false)} disabled={unscanned === 0 || references.length === 0}>
              <ScanFace size={16} /> Scan {unscanned} new photo{unscanned === 1 ? "" : "s"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void runScan(true)} disabled={pool.length === 0 || references.length === 0}>
              <RefreshCw size={16} /> Rescan all
            </Button>
          </div>
        )}
        <p className="mt-2 text-xs text-navy-700/50">
          Use &ldquo;Rescan all&rdquo; after new guests add selfies. Spot a wrong name on a photo in step 4? Tap it to remove
          that match before creating reels.
        </p>
      </Step>

      <Step n={6} title="Create & send reels" done={doneCount > 0}>
        <p className="mb-3 text-sm text-navy-700/70">
          Each guest gets a 9:16 video (ready for Instagram Reels and WhatsApp Status): {honoreeName}, then the photos they&apos;re
          in together, then a thank-you from {hostedBy}.{" "}
          {isOwner ? "" : `${Math.max(0, settings.renderLimit - settings.rendersUsed)} of ${settings.renderLimit} renders left.`}
        </p>
        {found.length === 0 ? (
          <p className="rounded-lg border border-dashed border-navy-950/15 py-6 text-center text-sm text-navy-700/50">
            No guests found in the photos yet — complete steps 2–5.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-navy-950/5 rounded-lg border border-navy-950/10">
              {found.map((g) => (
                <li key={g.inviteeId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Include ${g.name}`}
                    checked={selected.has(g.inviteeId)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(g.inviteeId);
                      else next.delete(g.inviteeId);
                      setSelected(next);
                    }}
                    className="h-4 w-4 rounded border-navy-950/30 text-gold-500 focus:ring-gold-500/40"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy-950">{g.name}</p>
                    <p className="text-xs text-navy-700/55">
                      {g.togetherCount + g.soloCount} photo{g.togetherCount + g.soloCount === 1 ? "" : "s"}
                      {g.reel ? ` · ${STATUS_LABEL[g.reel.status]}` : ""}
                      {g.reel?.status === "error" && g.reel.error ? ` — ${g.reel.error}` : ""}
                    </p>
                  </div>
                  {g.reel?.status === "rendering" || g.reel?.status === "queued" ? (
                    <Loader2 className="animate-spin text-gold-500" size={16} aria-label="Rendering" />
                  ) : null}
                  {g.reel?.videoUrl ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={g.reel.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-gold-600 underline underline-offset-2"
                      >
                        <ExternalLink size={12} /> Watch
                      </a>
                      <button
                        type="button"
                        onClick={() => void copy(shareUrl(g), g.inviteeId)}
                        className="inline-flex items-center gap-1 text-xs text-gold-600 underline underline-offset-2"
                      >
                        {copied === g.inviteeId ? <Check size={12} /> : <Copy size={12} />} Link
                      </button>
                      <a
                        href={whatsappFor(g)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2.5 py-1 text-xs font-medium text-white"
                      >
                        <MessageCircle size={12} /> Send
                      </a>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => void generate(Array.from(selected))} disabled={generating || selected.size === 0}>
                {generating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                {generating ? "Starting…" : `Create ${selected.size} reel${selected.size === 1 ? "" : "s"}`}
              </Button>
              <span className="text-xs text-navy-700/55">Re-creating a reel replaces the old one; the guest&apos;s link stays the same.</span>
            </div>
          </>
        )}
      </Step>
    </div>
  );
}
