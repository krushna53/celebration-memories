"use client";

import { useState } from "react";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

import { submitLeadAction } from "@/features/business/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/** Contact-the-vendor form on a listing page — writes to business_leads, the vendor's own dashboard inbox. */
export function LeadForm({ businessId }: { businessId: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await submitLeadAction(businessId, { name, email, phone, message });
    setSubmitting(false);
    if (result.success) {
      setSent(true);
    } else {
      setError(result.error);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-5 text-center">
        <CheckCircle2 className="mx-auto text-gold-600" size={22} />
        <p className="mt-2 text-sm font-medium text-navy-950">Message sent!</p>
        <p className="mt-1 text-xs text-navy-700/60">They&rsquo;ll get back to you directly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2.5 rounded-xl border border-navy-950/10 bg-white p-5">
      <p className="font-display text-base text-navy-950">Contact this vendor</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputClasses} required />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        className={inputClasses}
        required
      />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your phone (optional)" className={inputClasses} />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Tell them about your event — date, guest count, budget..."
        rows={3}
        className={`${inputClasses} resize-none`}
        required
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting || !name.trim() || !email.trim() || !message.trim()}
        className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2.5 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send Message
      </button>
    </form>
  );
}
