"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compression";
import type { TimelineMilestoneRecord } from "@/types/content";
import {
  confirmTimelineImageUploadAction,
  createMilestoneAction,
  deleteMilestoneAction,
  removeTimelineImageAction,
  requestTimelineImageUploadUrlAction,
  updateMilestoneAction,
} from "@/features/admin/timeline/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/** See AiImageActions's doc comment — same override pattern for the self-serve wizard. */
export interface TimelineActions {
  createMilestone: typeof createMilestoneAction;
  updateMilestone: typeof updateMilestoneAction;
  deleteMilestone: typeof deleteMilestoneAction;
  requestImageUpload: typeof requestTimelineImageUploadUrlAction;
  confirmImageUpload: typeof confirmTimelineImageUploadAction;
  removeImage: typeof removeTimelineImageAction;
}

const DEFAULT_ACTIONS: TimelineActions = {
  createMilestone: createMilestoneAction,
  updateMilestone: updateMilestoneAction,
  deleteMilestone: deleteMilestoneAction,
  requestImageUpload: requestTimelineImageUploadUrlAction,
  confirmImageUpload: confirmTimelineImageUploadAction,
  removeImage: removeTimelineImageAction,
};

interface TimelineManagerProps {
  eventId: string;
  initialMilestones: TimelineMilestoneRecord[];
  actions?: TimelineActions;
}

const EMPTY = { period: "", title: "", description: "" };

export function TimelineManager({ eventId, initialMilestones, actions = DEFAULT_ACTIONS }: TimelineManagerProps) {
  const [milestones, setMilestones] = useState(
    [...initialMilestones].sort((a, b) => a.sortOrder - b.sortOrder),
  );
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageBusyId, setImageBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingMilestoneId = useRef<string | null>(null);

  async function handleAdd() {
    if (!form.period.trim() || !form.title.trim() || !form.description.trim()) return;
    setBusy(true);
    const result = await actions.createMilestone({
      eventId,
      ...form,
      sortOrder: milestones.length,
    });
    setBusy(false);
    if (result.success) {
      setForm(EMPTY);
      window.location.reload();
    } else {
      alert(result.error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this milestone?")) return;
    setBusyId(id);
    const result = await actions.deleteMilestone(id);
    setBusyId(null);
    if (result.success) {
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } else {
      alert(result.error);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= milestones.length) return;

    const reordered = [...milestones];
    const a = reordered[index];
    const b = reordered[target];
    if (!a || !b) return;
    reordered[index] = b;
    reordered[target] = a;
    setMilestones(reordered);

    setBusy(true);
    await Promise.all(
      reordered.map((m, i) => actions.updateMilestone(m.id, { sortOrder: i })),
    );
    setBusy(false);
  }

  function triggerImageUpload(milestoneId: string) {
    pendingMilestoneId.current = milestoneId;
    fileInputRef.current?.click();
  }

  async function handleImageFile(rawFile: File) {
    const milestoneId = pendingMilestoneId.current;
    if (!milestoneId) return;

    setImageBusyId(milestoneId);
    try {
      const file = await compressImage(rawFile);
      const signed = await actions.requestImageUpload(eventId, file.name, file.type, file.size);
      if (!signed.success) throw new Error(signed.error);

      const { bucket, path, token } = signed.data;
      const { error: uploadError } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, file);
      if (uploadError) throw new Error(uploadError.message);

      const confirmed = await actions.confirmImageUpload(milestoneId, path);
      if (!confirmed.success) throw new Error(confirmed.error);

      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed.");
      setImageBusyId(null);
    }
  }

  async function handleRemoveImage(milestoneId: string) {
    if (!confirm("Remove this milestone's photo?")) return;
    setImageBusyId(milestoneId);
    const result = await actions.removeImage(milestoneId);
    if (result.success) {
      window.location.reload();
    } else {
      alert(result.error);
      setImageBusyId(null);
    }
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])}
      />

      <div className="grid gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 sm:grid-cols-3">
        <input
          placeholder="Period (e.g. Early Years)"
          value={form.period}
          onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
          className={inputClasses}
        />
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className={inputClasses}
        />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className={inputClasses}
        />
        <div className="sm:col-span-3">
          <Button onClick={handleAdd} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
            Add Milestone
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-navy-700/50">
        Add the milestone first, then attach a photo to it below — photos also become
        selectable slides in the Slideshow Video composer.
      </p>

      <div className="mt-6 space-y-3">
        {milestones.map((m, index) => (
          <div
            key={m.id}
            className="flex items-start gap-3 rounded-xl border border-navy-950/10 bg-white p-4"
          >
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={index === 0 || busy}
                onClick={() => move(index, -1)}
                className="tap-target flex items-center justify-center text-navy-700/50 hover:text-gold-600 disabled:opacity-30"
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                disabled={index === milestones.length - 1 || busy}
                onClick={() => move(index, 1)}
                className="tap-target flex items-center justify-center text-navy-700/50 hover:text-gold-600 disabled:opacity-30"
              >
                <ArrowDown size={16} />
              </button>
            </div>

            {m.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.imageUrl} alt={m.title} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-navy-950/15 text-navy-700/30">
                <ImagePlus size={18} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-gold-600">{m.period}</p>
              <p className="font-display text-lg text-navy-950">{m.title}</p>
              <p className="text-sm text-navy-700/70">{m.description}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={imageBusyId === m.id}
                  onClick={() => triggerImageUpload(m.id)}
                >
                  {imageBusyId === m.id ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
                  {m.imageUrl ? "Replace photo" : "Add photo"}
                </Button>
                {m.imageUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={imageBusyId === m.id}
                    onClick={() => handleRemoveImage(m.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <X size={13} /> Remove photo
                  </Button>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              disabled={busyId === m.id}
              onClick={() => handleDelete(m.id)}
              className="tap-target flex items-center justify-center text-navy-700/50 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {milestones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
            No milestones yet — add the first one above.
          </p>
        ) : null}
      </div>
    </div>
  );
}
