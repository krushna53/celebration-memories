"use client";

import { useState } from "react";
import { MessageCircle, X, Send, Loader2, CheckCircle2 } from "lucide-react";

import { submitInquiryAction } from "@/features/contact/actions";
import { BUILDER } from "@/lib/constants";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/**
 * Site-wide "we're here to help" widget for anonymous visitors — hosts
 * evaluating the platform, guests stuck on an RSVP/upload page, anyone
 * who lands on a public page and wants a human. Rendered once from
 * components/layout/site-shell.tsx, so it shows up on every
 * marketing/event/guest page but never inside /admin (which has its
 * own FaqChatbot — see features/admin/support/faq-chatbot.tsx).
 *
 * Deliberately NOT a real-time chat: there's no WhatsApp Business API
 * integration here (same call made for guest invites — see
 * lib/whatsapp.ts), so "Chat on WhatsApp" is a wa.me deep link that
 * hands the conversation off to the actual WhatsApp app, where
 * {BUILDER.name} replies personally. The "leave your details" form is
 * the fully in-app path: it reuses the same inquiries pipeline as the
 * public Contact Us page (features/contact/actions.ts →
 * services/inquiries.ts → lib/email.ts's sendInquiryNotification),
 * which emails the owner (ADMIN_NOTIFICATION_EMAIL, falling back to
 * krushnawebworks@gmail.com) and saves a row visible in
 * /admin/inquiries — so a submission is never silently lost even if
 * the notification email doesn't land.
 */
export function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await submitInquiryAction({ name, email, phone, message });
    setSubmitting(false);
    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error);
    }
  }

  function reset() {
    setShowForm(false);
    setSubmitted(false);
    setError(null);
    setName("");
    setEmail("");
    setPhone("");
    setMessage("");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Chat with us"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-navy-950 text-gold-400 shadow-lg transition-luxury duration-300 hover:brightness-110"
      >
        <span className="absolute right-1 top-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
        </span>
        <MessageCircle size={22} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm overflow-hidden rounded-2xl border border-navy-950/10 bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-navy-950 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500/20 text-sm font-medium text-gold-300">
            {BUILDER.name.charAt(0)}
          </div>
          <div>
            <p className="font-display text-sm leading-tight text-ivory-50">{BUILDER.name}</p>
            <p className="flex items-center gap-1 text-[11px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          aria-label="Close"
          className="text-ivory-100/60 hover:text-ivory-50"
        >
          <X size={16} />
        </button>
      </div>

      <div className="max-h-[26rem] overflow-y-auto p-4">
        {submitted ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="text-gold-500" size={30} />
            <p className="text-sm text-navy-950">Thanks — we&rsquo;ve got your details.</p>
            <p className="text-xs text-navy-700/60">We&rsquo;ll get back to you by email shortly.</p>
            <button type="button" onClick={reset} className="mt-2 text-xs text-gold-600 underline underline-offset-2">
              Send another message
            </button>
          </div>
        ) : !showForm ? (
          <div className="grid gap-3">
            <p className="text-sm text-navy-700/80">
              Have a question or run into an issue? We&rsquo;re happy to help.
            </p>
            <a
              href={BUILDER.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white hover:brightness-105"
            >
              Chat on WhatsApp
            </a>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center justify-center gap-2 rounded-full border border-navy-950/15 px-4 py-2.5 text-sm font-medium text-navy-950 hover:bg-navy-950/5"
            >
              Leave your details instead
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-2.5">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className={inputClasses}
            />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              className={inputClasses}
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              className={inputClasses}
            />
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What do you need help with?"
              rows={3}
              className={`${inputClasses} resize-none`}
            />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={submitting}
              className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2.5 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-navy-700/50 hover:text-navy-700/80"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
