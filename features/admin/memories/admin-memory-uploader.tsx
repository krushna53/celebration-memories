"use client";

import { useRef, useState } from "react";
import { ImagePlus, Video, Mic, FileText, Loader2, CheckCircle2, X, UploadCloud } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  adminRequestMediaUploadAction,
  adminConfirmMediaUploadAction,
  adminAddGuestbookNoteAction,
} from "@/features/admin/memories/upload-actions";
import { ACCEPTED_MIME_TYPES, UPLOAD_LIMITS } from "@/types/memory";

type Tab = "photo" | "video" | "audio" | "note";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "photo", label: "Photo", icon: ImagePlus },
  { id: "video", label: "Video", icon: Video },
  { id: "audio", label: "Audio", icon: Mic },
  { id: "note", label: "Note", icon: FileText },
];

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

function FileDropZone({
  kind,
  accept,
  label,
  onFile,
}: {
  kind: "photo" | "video" | "audio";
  accept: string;
  label: string;
  onFile: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gold-500/30 bg-gold-500/5 px-4 py-10 text-center transition-all duration-200 hover:border-gold-500/60 hover:bg-gold-500/10"
      >
        <UploadCloud className="text-gold-500" size={28} />
        <span className="text-sm font-medium text-navy-950">{label}</span>
        <span className="text-xs text-navy-700/50">
          {UPLOAD_LIMITS[kind].label} max
        </span>
      </button>
    </div>
  );
}

interface MediaUploadPanelProps {
  kind: "photo" | "video" | "audio";
  onDone: () => void;
}

function MediaUploadPanel({ kind, onDone }: MediaUploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const accept = [...ACCEPTED_MIME_TYPES[kind]].join(",");
  const label =
    kind === "photo"
      ? "Choose a photo"
      : kind === "video"
        ? "Choose a video"
        : "Choose an audio file";

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // Compress photos before upload
      const toUpload = kind === "photo" ? await compressImage(file) : file;
      const mime = (toUpload.type.split(";")[0] ?? toUpload.type).trim();

      const signed = await adminRequestMediaUploadAction(kind, toUpload.name, mime, toUpload.size);
      if (!signed.success) throw new Error(signed.error);

      const { bucket, path, token } = signed.data;
      const { error: putError } = await supabaseBrowser()
        .storage.from(bucket)
        .uploadToSignedUrl(path, token, toUpload);
      if (putError) throw new Error(putError.message);

      const confirmed = await adminConfirmMediaUploadAction(kind, path, caption.trim() || undefined);
      if (!confirmed.success) throw new Error(confirmed.error);

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="text-gold-500" size={32} />
        <p className="font-medium text-navy-950">Uploaded and live on the Memory Wall</p>
        <Button variant="outline" size="sm" onClick={() => { setFile(null); setCaption(""); setDone(false); onDone(); }}>
          Upload another
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {file ? (
        <div className="flex items-center justify-between rounded-lg border border-navy-950/10 px-3 py-2 text-sm">
          <span className="truncate text-navy-950">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} className="ml-2 shrink-0 text-navy-700/50 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      ) : (
        <FileDropZone kind={kind} accept={accept} label={label} onFile={setFile} />
      )}

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-navy-700/60">
          Caption <span className="normal-case font-normal">(optional)</span>
        </label>
        <input
          className={inputClasses}
          placeholder="Add a caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={200}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleUpload} disabled={!file || uploading} size="sm">
        {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : "Upload"}
      </Button>
    </div>
  );
}

function NotePanel({ onDone }: { onDone: () => void }) {
  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await adminAddGuestbookNoteAction(guestName, message, country);
    setSaving(false);
    if (!result.success) { setError(result.error); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="text-gold-500" size={32} />
        <p className="font-medium text-navy-950">Note added to the Memory Wall</p>
        <Button variant="outline" size="sm" onClick={() => { setGuestName(""); setMessage(""); setCountry(""); setDone(false); onDone(); }}>
          Add another
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-navy-700/60">Name *</label>
        <input className={inputClasses} placeholder="Guest name" value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={120} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-navy-700/60">Message *</label>
        <textarea
          className={cn(inputClasses, "resize-y")}
          rows={4}
          placeholder="Write the message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={3000}
        />
        <p className="mt-1 text-right text-xs text-navy-700/40">{message.length}/3000</p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-navy-700/60">
          Country <span className="normal-case font-normal">(optional)</span>
        </label>
        <input className={inputClasses} placeholder="e.g. India" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={80} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={handleSave} disabled={!guestName.trim() || !message.trim() || saving} size="sm">
        {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Add Note"}
      </Button>
    </div>
  );
}

/**
 * Admin-side memory uploader — lets the event host or client admin add
 * photos, videos, audio, or guestbook notes directly without needing a
 * guest invite link. All uploads bypass the moderation queue (approved
 * immediately) and are attributed to the admin's account via
 * uploaded_by_admin_id (migration 0056).
 */
export function AdminMemoryUploader({ onUploaded }: { onUploaded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("photo");

  function handleDone() {
    onUploaded?.();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <UploadCloud size={15} />
        Add Memory
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-gold-500/20 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base text-navy-950">Add a Memory</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-navy-700/40 hover:text-navy-950">
          <X size={18} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="mb-5 flex gap-1 rounded-lg bg-navy-950/5 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-150",
              tab === id
                ? "bg-white text-navy-950 shadow-sm"
                : "text-navy-700/60 hover:text-navy-950",
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === "photo" && <MediaUploadPanel kind="photo" onDone={handleDone} />}
      {tab === "video" && <MediaUploadPanel kind="video" onDone={handleDone} />}
      {tab === "audio" && <MediaUploadPanel kind="audio" onDone={handleDone} />}
      {tab === "note"  && <NotePanel onDone={handleDone} />}
    </div>
  );
}
