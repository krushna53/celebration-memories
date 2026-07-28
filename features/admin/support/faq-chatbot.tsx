"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, Loader2, MessageCircleQuestion, Send, X } from "lucide-react";

import { FAQ_ENTRIES, type FaqEntry } from "@/lib/faq-content";
import { requestCustomDomainAction } from "@/features/admin/support/actions";

const SESSION_KEY = "cm-admin-faq-auto-opened";

/**
 * Floating FAQ widget for the admin dashboard — fixed preset Q&A (see
 * lib/faq-content.ts), no AI, no per-message cost. Auto-opens once per
 * browser session right after an admin lands on the dashboard (tracked
 * via sessionStorage, not a server-side "seen" flag like the feature
 * tour, since this is meant to be low-stakes and easy to dismiss, not
 * something to track per-admin in the database). Rendered for both
 * owner and client roles from app/admin/(dashboard)/layout.tsx.
 */
export function FaqChatbot() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FaqEntry | null>(null);
  const [domain, setDomain] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setOpen(true);
    }
  }, []);

  function selectEntry(entry: FaqEntry | null) {
    setSelected(entry);
    setSent(false);
    setError(null);
    setDomain("");
    setNotes("");
  }

  async function submitDomainRequest(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const result = await requestCustomDomainAction(domain, notes);
    setSending(false);
    if (result.success) {
      setSent(true);
    } else {
      setError(result.error);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open help"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gold-500 text-navy-950 shadow-lg transition-luxury duration-300 hover:brightness-110"
      >
        <MessageCircleQuestion size={20} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm overflow-hidden rounded-2xl border border-navy-950/10 bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-navy-950 px-4 py-3">
        <div className="flex items-center gap-2 text-ivory-50">
          {selected ? (
            <button type="button" onClick={() => selectEntry(null)} aria-label="Back">
              <ChevronLeft size={16} />
            </button>
          ) : null}
          <span className="font-display text-sm">Help &amp; FAQ</span>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-ivory-100/60 hover:text-ivory-50">
          <X size={16} />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto p-4">
        {!selected ? (
          <div className="grid gap-1.5">
            {FAQ_ENTRIES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelected(entry)}
                className="rounded-lg px-3 py-2.5 text-left text-sm text-navy-950 hover:bg-navy-950/5"
              >
                {entry.question}
              </button>
            ))}
          </div>
        ) : selected.isDomainRequest ? (
          <div>
            <p className="text-sm text-navy-700/80">{selected.answer}</p>
            {sent ? (
              <p className="mt-4 flex items-center gap-1.5 text-sm text-green-700">
                <Check size={14} /> Sent — we&rsquo;ll be in touch by email.
              </p>
            ) : (
              <form onSubmit={submitDomainRequest} className="mt-4 grid gap-2.5">
                <input
                  required
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="yourdomain.com"
                  className="w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything else we should know? (optional)"
                  className="min-h-16 w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                />
                {error ? <p className="text-xs text-red-600">{error}</p> : null}
                <button
                  type="submit"
                  disabled={sending}
                  className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Send Request
                </button>
              </form>
            )}
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-navy-700/80">{selected.answer}</p>
        )}
      </div>
    </div>
  );
}
