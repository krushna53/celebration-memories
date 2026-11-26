"use client";
import { useEffect, useRef, useState } from "react";
import { CREATE_STORY_PATH, STORY_VIDEOS, storyPath } from "@/features/ai-video/lib/story-videos";
import { WeddingTabs } from "@/features/wedding-showcase/WeddingTabs";
import styles from "./StoryLibrary.module.css";

const clock = (s) => (s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");
const customizeHref = (story) => `${CREATE_STORY_PATH}?from=${encodeURIComponent(story.id)}`;
// Without a poster, show a frame from the first second of the video.
const thumbSrc = (story) => (story.poster ? story.src : `${story.src}#t=1`);

function ShareIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>;
}

// Plays muted while the pointer is over its card / list item (or the video itself), pauses when it leaves.
function HoverVideo({ story, className, onDuration, controls = false, autoPlayOnce = false }) {
  const ref = useRef(null);
  const userControl = useRef(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    userControl.current = false;
    const target = v.closest("[data-hover-play]") || v;
    const play = () => { if (userControl.current) return; v.muted = true; v.play().catch(() => {}); };
    const stop = () => { if (!userControl.current) v.pause(); };
    target.addEventListener("mouseenter", play);
    target.addEventListener("mouseleave", stop);
    target.addEventListener("focusin", play);
    target.addEventListener("focusout", stop);
    if (autoPlayOnce) play();
    return () => { target.removeEventListener("mouseenter", play); target.removeEventListener("mouseleave", stop); target.removeEventListener("focusin", play); target.removeEventListener("focusout", stop); };
  }, [story.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <video
    ref={ref}
    className={className}
    src={thumbSrc(story)}
    poster={story.poster || undefined}
    preload="metadata"
    playsInline
    muted
    loop={!controls}
    controls={controls}
    // Once someone unmutes or uses the controls, hovering no longer pauses their video.
    onVolumeChange={(e) => { if (!e.currentTarget.muted) userControl.current = true; }}
    onPointerDown={() => { if (controls) userControl.current = true; }}
    onLoadedMetadata={(e) => onDuration?.(story.id, e.currentTarget.duration)}
    aria-label={`${story.title} · ${story.couple}`}
  />;
}

function ShareButton({ story, className }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  // Each story has its own page, so the shared link shows that story's cover, title and names.
  const url = () => `${window.location.origin}${storyPath(story.id)}`;
  const text = `${story.couple}: ${story.title}. Watch our love story reel on EveryMoment.`;
  async function share() {
    setNote("");
    if (navigator.share) {
      try { await navigator.share({ title: story.title, text, url: url() }); return; }
      catch (e) { if (e?.name === "AbortError") return; }
    }
    setOpen((o) => !o);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url()); setNote("Link copied"); }
    catch { setNote(url()); }
  }
  return <div className={styles.shareWrap}>
    <button type="button" className={className} onClick={share} aria-expanded={open}><ShareIcon /> Share</button>
    {open && <div className={styles.shareMenu} role="menu">
      <a role="menuitem" href={`https://wa.me/?text=${encodeURIComponent(text + " " + url())}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a role="menuitem" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`} target="_blank" rel="noopener noreferrer">Facebook</a>
      <a role="menuitem" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url())}`} target="_blank" rel="noopener noreferrer">X / Twitter</a>
      <button type="button" role="menuitem" onClick={copy}>Copy link</button>
      {note && <small role="status">{note}</small>}
    </div>}
  </div>;
}

/**
 * The Stories tab of the wedding galleries (/wedding/stories, and /wedding/stories/<id> for a shared story):
 * a banner, the selected love story reel playing on the left with "Customize your story", and the story library on
 * the right. Ported from the EveryMoment Wedding studio's /reels/stories. "Customize your story" opens
 * /wedding/stories/create?from=<id>, where that same video loads in the story editor (features/ai-video).
 */
/** @param {{ initialId?: string }} props */
export default function StoryLibrary({ initialId } = {}) {
  // Until the file check finishes, show only stories that already have a poster, so empty slots never flash.
  const [missing, setMissing] = useState(() => Object.fromEntries(STORY_VIDEOS.filter((s) => !s.poster).map((s) => [s.id, true])));
  const [durations, setDurations] = useState({});
  const [selectedId, setSelectedId] = useState(initialId || STORY_VIDEOS[0].id);
  const [autoPlay, setAutoPlay] = useState(false);
  const playerRef = useRef(null);
  const stories = STORY_VIDEOS.filter((s) => !missing[s.id]);
  const selected = stories.find((s) => s.id === selectedId) || stories[0];
  const setDuration = (id, d) => Number.isFinite(d) && setDurations((m) => (m[id] === d ? m : { ...m, [id]: d }));
  const lengthOf = (s) => clock(durations[s.id] || s.duration);

  // Hide slots whose video file has not been added yet (checked once per page load).
  useEffect(() => {
    let alive = true;
    Promise.all(STORY_VIDEOS.map((s) => fetch(s.src, { method: "HEAD" }).then((r) => [s.id, !r.ok || !/video|octet/.test(r.headers.get("content-type") || "")]).catch(() => [s.id, true])))
      .then((list) => { if (alive) setMissing(Object.fromEntries(list.filter(([, gone]) => gone))); });
    return () => { alive = false; };
  }, []);

  // A shared link (/reels/stories/story-2, or the older ?v=story-2) opens that story in the player.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("v") || initialId;
    if (v && STORY_VIDEOS.some((s) => s.id === v)) {
      setSelectedId(v);
      setTimeout(() => playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(story) {
    setSelectedId(story.id);
    setAutoPlay(true);
    try { window.history.replaceState(null, "", storyPath(story.id)); } catch { /* history blocked */ }
    if (window.innerWidth < 900) playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <div className={styles.page}>
    <section className={styles.banner} aria-labelledby="story-banner-title">
      <div className={styles.bannerText}>
        <p className={styles.eyebrow}>LOVE STORY REELS</p>
        <h1 id="story-banner-title">Your memories.<br /><em>In motion.</em></h1>
        <p>Your first meeting, festivals, trips and the big yes, told as one animated video. Watch a few, then customise any of them with your own names, places and dates.</p>
        <div className={styles.heroActions}>
          <a className={styles.primary} href={CREATE_STORY_PATH}>Create your story</a>
          <a className={styles.ghost} href="/wedding/reels">Browse reel templates</a>
        </div>
      </div>
      <div className={styles.bannerArt} aria-hidden="true">
        {STORY_VIDEOS.filter((s) => s.poster && !missing[s.id]).slice(0, 3).map((s, i) => <img key={s.id} src={s.poster} alt="" className={styles[`fan${i}`]} />)}
      </div>
    </section>

    <WeddingTabs active="stories" />

    {selected && <section className={styles.library} ref={playerRef} aria-label="Story reel player">
      <article className={styles.player}>
        <div className={styles.stage} data-hover-play>
          <video className={styles.stageBackdrop} src={thumbSrc(selected)} aria-hidden="true" muted loop autoPlay playsInline preload="metadata" />
          <HoverVideo key={selected.id} story={selected} className={styles.mainVideo} controls autoPlayOnce={autoPlay} onDuration={setDuration} />
        </div>
        <div className={styles.info}>
          <div className={styles.infoText}>
            <p className={styles.kicker}>NOW PLAYING{lengthOf(selected) && ` · ${lengthOf(selected)}`}</p>
            <h2>{selected.title}</h2>
            <p className={styles.couple}>{selected.couple}</p>
            <p className={styles.desc}>{selected.description}</p>
            {selected.tags?.length > 0 && <ul className={styles.tags}>{selected.tags.map((t) => <li key={t}>{t}</li>)}</ul>}
          </div>
          <div className={styles.actions}>
            <a className={styles.primary} href={customizeHref(selected)}>✎ Customize your story</a>
            <ShareButton story={selected} className={styles.ghostDark} />
          </div>
        </div>
      </article>

      <aside className={styles.playlist} aria-label="More story reels">
        <p className={styles.playlistTitle}>Story library <span>{stories.length}</span></p>
        <ul>
          {stories.map((s) => <li key={s.id}>
            <button type="button" data-hover-play className={`${styles.item} ${s.id === selected.id ? styles.itemOn : ""}`} onClick={() => choose(s)} aria-pressed={s.id === selected.id}>
              <HoverVideo story={s} className={styles.itemThumb} onDuration={setDuration} />
              <span className={styles.itemText}><b>{s.title}</b><small>{s.couple}{lengthOf(s) && ` · ${lengthOf(s)}`}</small></span>
              <span className={styles.radio} aria-hidden="true" />
            </button>
          </li>)}
        </ul>
        <p className={styles.hint}>Hover to preview. Click to play it on the left.</p>
      </aside>
    </section>}

    <section className={styles.steps} aria-labelledby="make-it-yours">
      <h2 id="make-it-yours">Make it yours</h2>
      <p>Turn your memories into a polished story reel in three simple steps.</p>
      <div className={styles.stepGrid}>
        <div><span aria-hidden="true">📷</span><b>Add your photo</b><small>Upload one couple photo. We keep your faces recognisable in every scene.</small></div>
        <div><span aria-hidden="true">✎</span><b>Tell your story</b><small>Pick the moments, places and dates. Edit any text, even after the video is made.</small></div>
        <div><span aria-hidden="true">➦</span><b>Share it</b><small>Download a 9:16 MP4 for WhatsApp, Instagram Reels and Stories.</small></div>
      </div>
      <a className={styles.primary} href={CREATE_STORY_PATH}>Start your story</a>
    </section>
  </div>;
}
