"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteEventAction } from "@/features/admin/events/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/30";

interface DeleteEventButtonProps {
  eventId: string;
  slug: string;
  honoreeName: string;
  eventTitle: string;
  /** Whether any client login is currently attached — changes the warning copy. See app/admin/(dashboard)/events/page.tsx's membersByEvent. */
  hasClientLogin: boolean;
}

/**
 * Owner-only "delete this event" control for each row on /admin/events.
 * Deliberately separate from the Visibility toggle in the same row
 * (VisibilityToggle) — that one is the actual "unpublish" action
 * (reversible, just flips public/private); this one is the permanent,
 * irreversible removal of the event and everything in it, gated behind
 * typing the event's own slug to confirm (checked again server-side in
 * deleteEventAction — never trusts this component's own state).
 */
export function DeleteEventButton({ eventId, slug, honoreeName, eventTitle, hasClientLogin }: DeleteEventButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Delete this event permanently"
        className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-400 hover:bg-red-50"
      >
        <Trash2 size={13} /> Delete
      </button>

      {open ? (
        <DeleteEventDialog
          eventId={eventId}
          slug={slug}
          honoreeName={honoreeName}
          eventTitle={eventTitle}
          hasClientLogin={hasClientLogin}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function DeleteEventDialog({
  eventId,
  slug,
  honoreeName,
  eventTitle,
  hasClientLogin,
  onClose,
}: {
  eventId: string;
  slug: string;
  honoreeName: string;
  eventTitle: string;
  hasClientLogin: boolean;
  onClose: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);

  const matches = confirmText.trim().toLowerCase() === slug.trim().toLowerCase();

  async function handleDelete() {
    if (!matches) return;
    setDeleting(true);
    setError(null);
    const result = await deleteEventAction(eventId, confirmText);
    setDeleting(false);
    if (result.success) {
      setDone(true);
      // The row disappears once the server component re-renders after
      // revalidatePath — a brief "Deleted" state here avoids the dialog
      // just vanishing mid-click with no feedback.
      setTimeout(onClose, 600);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={20} />
            <h2 className="font-display text-lg text-navy-950">Delete Event Permanently</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tap-target text-navy-700/50 hover:text-navy-950"
            aria-label="Cancel"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-navy-700/80">
          This permanently deletes <strong>{honoreeName}</strong>&rsquo;s event, <strong>{eventTitle}</strong> —
          every photo, video, audio message, guestbook note, invitee, and RSVP in it. The public site and any
          shared links stop working immediately.
          {hasClientLogin ? (
            <>
              {" "}
              This event has a client login attached — it will stop working too, though the underlying account
              email isn&rsquo;t freed up unless you also delete it from{" "}
              <strong>Members &gt; Delete Permanently</strong>.
            </>
          ) : null}{" "}
          This cannot be undone.
        </p>

        <label className="mt-4 block text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
          Type <span className="font-mono normal-case text-red-600">{slug}</span> to confirm
        </label>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className={`${inputClasses} mt-1.5`}
          placeholder={slug}
          autoFocus
        />

        {error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {done ? <p className="mt-2 text-sm text-emerald-600">Deleted.</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <button
            type="button"
            disabled={!matches || deleting || done}
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-2 text-sm font-medium text-white transition-luxury duration-300 hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
}
