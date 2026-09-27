"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { Check, Loader2, RotateCcw, Sparkles, Wand2, X } from "lucide-react";

import type { GalleryPhotoRecord } from "@/types/content";
import {
  applyGalleryCleanupAction,
  detectPrintBoundsAction,
  getCleanupSourceAction,
  previewGalleryCleanupAction,
  revertGalleryCleanupAction,
} from "@/features/admin/gallery/story-actions";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
type DragMode = "move" | "nw" | "ne" | "sw" | "se";

const FULL: Box = { x: 0, y: 0, width: 1, height: 1 };
const MIN = 0.08;

/**
 * Crop + enhance editor for one photo. The AI proposes where the printed
 * picture sits (detectPrintBoundsAction); the admin drags the box/corners
 * to adjust, previews the real server-side result, then saves. Always
 * edits the untouched original, which is kept for "Revert".
 */
function CleanupEditor({ photo, onClose }: { photo: GalleryPhotoRecord; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [box, setBox] = useState<Box>(FULL);
  const [enhance, setEnhance] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "save" | "revert" | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: DragMode; startX: number; startY: number; start: Box } | null>(null);

  async function detect() {
    setDetecting(true);
    setNote(null);
    const result = await detectPrintBoundsAction(photo.id);
    setDetecting(false);
    if (!result.success) {
      setNote(result.error);
      return;
    }
    setBox(result.data.box);
    setPreview(null);
    setNote(result.data.isPrint ? "AI found the printed photo — adjust the box if needed." : "This doesn't look like a photo of a print — you can still crop it by hand.");
  }

  useEffect(() => {
    getCleanupSourceAction(photo.id).then((r) => (r.success ? setSrc(r.data) : setNote(r.error)));
    void detect();
    // Run once per opened photo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id]);

  function onPointerDown(mode: DragMode) {
    return (e: ReactPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      drag.current = { mode, startX: e.clientX, startY: e.clientY, start: box };
    };
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current;
    const rect = frame.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = (e.clientX - d.startX) / rect.width;
    const dy = (e.clientY - d.startY) / rect.height;
    const s = d.start;
    let { x, y, width, height } = s;
    if (d.mode === "move") {
      x = Math.min(Math.max(0, s.x + dx), 1 - s.width);
      y = Math.min(Math.max(0, s.y + dy), 1 - s.height);
    } else {
      const right = s.x + s.width;
      const bottom = s.y + s.height;
      if (d.mode.includes("w")) x = Math.min(Math.max(0, s.x + dx), right - MIN);
      if (d.mode.includes("n")) y = Math.min(Math.max(0, s.y + dy), bottom - MIN);
      const newRight = d.mode.includes("e") ? Math.max(x + MIN, Math.min(1, right + dx)) : right;
      const newBottom = d.mode.includes("s") ? Math.max(y + MIN, Math.min(1, bottom + dy)) : bottom;
      width = newRight - x;
      height = newBottom - y;
    }
    setBox({ x, y, width, height });
    setPreview(null);
  }

  function onPointerUp() {
    drag.current = null;
  }

  async function run(kind: "preview" | "save" | "revert") {
    setBusy(kind);
    setNote(null);
    if (kind === "preview") {
      const r = await previewGalleryCleanupAction(photo.id, box, enhance);
      setBusy(null);
      if (r.success) setPreview(r.data);
      else setNote(r.error);
      return;
    }
    const r = kind === "save" ? await applyGalleryCleanupAction(photo.id, box, enhance) : await revertGalleryCleanupAction(photo.id);
    setBusy(null);
    if (!r.success) {
      setNote(r.error);
      return;
    }
    window.location.reload();
  }

  const pct = (v: number) => `${v * 100}%`;
  const handle = (mode: DragMode, style: React.CSSProperties) => (
    <span
      role="presentation"
      onPointerDown={onPointerDown(mode)}
      className="absolute h-5 w-5 rounded-full border-2 border-navy-950 bg-gold-400 shadow"
      style={{ ...style, touchAction: "none", cursor: `${mode}-resize` }}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 p-4" role="dialog" aria-modal="true" aria-label="Clean up photo">
      <div className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-medium text-navy-950">
            <Wand2 size={16} className="text-gold-600" /> Clean up scanned print
          </p>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-navy-700/60 hover:text-navy-950">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-navy-700/60">Original — drag the box or its corners</p>
            {src ? (
              <div
                ref={frame}
                className="relative mx-auto w-fit select-none"
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{ touchAction: "none" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- exact natural-size mapping for the crop box */}
                <img src={src} alt="" className="block max-h-[55vh] w-auto max-w-full" draggable={false} />
                <div
                  className="absolute border-2 border-gold-400"
                  style={{ left: pct(box.x), top: pct(box.y), width: pct(box.width), height: pct(box.height), boxShadow: "0 0 0 9999px rgba(10,16,36,0.55)", cursor: "move", touchAction: "none" }}
                  onPointerDown={onPointerDown("move")}
                >
                  {handle("nw", { left: -10, top: -10 })}
                  {handle("ne", { right: -10, top: -10 })}
                  {handle("sw", { left: -10, bottom: -10 })}
                  {handle("se", { right: -10, bottom: -10 })}
                </div>
                {detecting ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/40 text-xs text-navy-950">
                    <Loader2 size={16} className="mr-1.5 animate-spin" /> Finding the print…
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="flex h-60 items-center justify-center text-navy-700/50">
                <Loader2 className="animate-spin" size={20} />
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs text-navy-700/60">Result</p>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- server-rendered data URL preview
              <img src={preview} alt="Cleaned preview" className="mx-auto block max-h-[55vh] w-auto max-w-full rounded" />
            ) : (
              <div className="flex h-60 items-center justify-center rounded border border-dashed border-navy-950/15 text-center text-xs text-navy-700/50">
                Press Preview to see the cleaned photo
              </div>
            )}
          </div>
        </div>

        {note ? <p className="mt-3 text-xs text-navy-700">{note}</p> : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={detect} disabled={detecting || !!busy} className="flex items-center gap-1.5 rounded-lg border border-navy-950/15 px-3 py-2 text-xs disabled:opacity-50">
            <Sparkles size={13} /> Detect with AI
          </button>
          <button type="button" onClick={() => { setBox(FULL); setPreview(null); }} disabled={!!busy} className="rounded-lg border border-navy-950/15 px-3 py-2 text-xs disabled:opacity-50">
            Reset crop
          </button>
          <label className="flex items-center gap-1.5 px-2 text-xs text-navy-700">
            <input type="checkbox" checked={enhance} onChange={(e) => { setEnhance(e.target.checked); setPreview(null); }} />
            Enhance contrast &amp; colour
          </label>
          <span className="flex-1" />
          {photo.cleaned ? (
            <button type="button" onClick={() => run("revert")} disabled={!!busy} className="flex items-center gap-1.5 rounded-lg border border-navy-950/15 px-3 py-2 text-xs disabled:opacity-50">
              {busy === "revert" ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Revert to original
            </button>
          ) : null}
          <button type="button" onClick={() => run("preview")} disabled={!!busy || !src} className="flex items-center gap-1.5 rounded-lg border border-navy-950/15 px-3 py-2 text-xs disabled:opacity-50">
            {busy === "preview" ? <Loader2 size={13} className="animate-spin" /> : null} Preview
          </button>
          <button type="button" onClick={() => run("save")} disabled={!!busy || !src} className="flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-xs font-medium text-navy-950 disabled:opacity-50">
            {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
          </button>
        </div>
        <p className="mt-2 text-[11px] text-navy-700/50">The original is always kept — you can revert any time.</p>
      </div>
    </div>
  );
}

/** Admin panel listing gallery photos to clean up; opens the editor for one at a time. */
export function CleanupPanel({ photos }: { photos: GalleryPhotoRecord[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GalleryPhotoRecord | null>(null);

  return (
    <div className="mt-6 rounded-xl border border-navy-950/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-navy-950">
            <Wand2 size={15} className="text-gold-600" /> Clean up scanned prints
          </p>
          <p className="mt-0.5 text-xs text-navy-700/60">
            Crop a photographed print down to the picture and lift faded colours. Originals are always kept.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-lg border border-navy-950/15 px-3 py-2 text-xs">
          {open ? "Hide" : "Choose a photo"}
        </button>
      </div>
      {open ? (
        <div className="mt-3 grid max-h-80 grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-8 lg:grid-cols-10">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setEditing(photo)}
              aria-label={`Clean up ${photo.caption ?? "photo"}`}
              className="relative aspect-square overflow-hidden rounded border border-navy-950/10 hover:border-gold-500"
            >
              <Image src={photo.url} alt="" fill sizes="96px" className="object-cover" />
              {photo.cleaned ? (
                <span className="absolute inset-x-0 bottom-0 bg-gold-500/90 text-[10px] uppercase text-navy-950">Cleaned</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {editing ? <CleanupEditor photo={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
