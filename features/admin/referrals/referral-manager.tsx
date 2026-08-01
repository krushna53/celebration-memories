"use client";

import { useState } from "react";
import { Check, Copy, Loader2, MessageCircle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  addReferralConversionAction,
  createReferralCodeAction,
  setConversionPayoutStatusAction,
} from "@/features/admin/referrals/actions";
import type { ReferralCode } from "@/services/referrals";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

interface ReferralManagerProps {
  initialCodes: ReferralCode[];
}

export function ReferralManager({ initialCodes }: ReferralManagerProps) {
  // Mutations below trigger a full reload (simplest correct approach given
  // Server Actions already revalidate the route) rather than hand-rolling
  // optimistic local state for every code/conversion field.
  const codes = initialCodes;
  const [label, setLabel] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const result = await createReferralCodeAction(label, whatsapp || null);
    setCreating(false);
    if (result.success) {
      setLabel("");
      setWhatsapp("");
      window.location.reload();
    } else {
      setError(result.error);
    }
  }

  function copyLink(code: string) {
    const link = `${origin}/?ref=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  }

  const totalPending = codes.reduce(
    (sum, c) =>
      sum +
      c.conversions
        .filter((conv) => conv.payoutStatus === "pending")
        .reduce((s, conv) => s + (conv.rewardAmount ?? 0), 0),
    0,
  );

  return (
    <div className="grid gap-8">
      <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 text-sm text-navy-700/80">
        Referrals here are tracked by link visits and manually-logged
        conversions — there&rsquo;s no automated payment. Mark a conversion
        &ldquo;Paid&rdquo; once you&rsquo;ve actually sent the reward yourself (bank
        transfer, UPI, etc). Total pending payouts:{" "}
        <strong>₹{totalPending.toFixed(2)}</strong>.
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-3 rounded-xl border border-navy-950/10 bg-white p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <div>
          <label className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
            Referrer Name
          </label>
          <input
            className={`${inputClasses} mt-1.5`}
            placeholder="e.g. Priya Shah"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
            WhatsApp (optional)
          </label>
          <input
            className={`${inputClasses} mt-1.5`}
            placeholder="+91..."
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={creating}>
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          New Referral Link
        </Button>
        {error ? <p className="text-sm text-red-600 sm:col-span-3">{error}</p> : null}
      </form>

      <div className="grid gap-4">
        {codes.length === 0 ? (
          <p className="text-sm text-navy-700/60">No referral links yet — create one above.</p>
        ) : (
          codes.map((code) => (
            <ReferralCard key={code.id} code={code} origin={origin} onCopy={copyLink} copied={copiedCode === code.code} />
          ))
        )}
      </div>
    </div>
  );
}

function ReferralCard({
  code,
  origin,
  onCopy,
  copied,
}: {
  code: ReferralCode;
  origin: string;
  onCopy: (code: string) => void;
  copied: boolean;
}) {
  const [note, setNote] = useState("");
  const [reward, setReward] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = `${origin}/?ref=${code.code}`;
  const whatsappShare = `https://wa.me/?text=${encodeURIComponent(
    `Check out Celebration Memories — premium digital invitations for birthdays, weddings, and more: ${link}`,
  )}`;

  async function handleAddConversion(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    const result = await addReferralConversionAction(
      code.id,
      note,
      reward ? Number(reward) : null,
    );
    setAdding(false);
    if (result.success) {
      setNote("");
      setReward("");
      window.location.reload();
    } else {
      setError(result.error);
    }
  }

  async function togglePayout(conversionId: string, current: "pending" | "paid") {
    await setConversionPayoutStatusAction(conversionId, current === "pending" ? "paid" : "pending");
    window.location.reload();
  }

  return (
    <div className="rounded-xl border border-navy-950/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base text-navy-950">{code.label}</h3>
          <p className="text-xs text-navy-700/50">
            {code.visitCount} visit{code.visitCount === 1 ? "" : "s"} · code {code.code}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onCopy(code.code)}
            className="flex items-center gap-1.5 rounded-full border border-navy-950/15 px-3 py-1.5 text-xs text-navy-700/70 hover:border-gold-500/50"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy Link"}
          </button>
          <a
            href={whatsappShare}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-navy-950/15 px-3 py-1.5 text-xs text-navy-700/70 hover:border-gold-500/50"
          >
            <MessageCircle size={13} /> WhatsApp
          </a>
        </div>
      </div>

      {code.conversions.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {code.conversions.map((conv) => (
            <li
              key={conv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ivory-100 px-3 py-2 text-sm"
            >
              <span className="text-navy-700/80">
                {conv.note}
                {conv.rewardAmount ? ` · ₹${conv.rewardAmount.toFixed(2)}` : ""}
              </span>
              <button
                type="button"
                onClick={() => togglePayout(conv.id, conv.payoutStatus)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  conv.payoutStatus === "paid"
                    ? "bg-green-100 text-green-700"
                    : "bg-gold-500/15 text-gold-700"
                }`}
              >
                {conv.payoutStatus === "paid" ? "Paid" : "Pending — mark paid"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={handleAddConversion} className="mt-4 flex flex-wrap gap-2">
        <input
          className={`${inputClasses} flex-1 min-w-[160px]`}
          placeholder="Log a conversion, e.g. 'New wedding site for Sharma family'"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <input
          className={`${inputClasses} w-28`}
          type="number"
          min="0"
          step="0.01"
          placeholder="Reward ₹"
          value={reward}
          onChange={(e) => setReward(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={adding}>
          {adding ? <Loader2 size={14} className="animate-spin" /> : "Log"}
        </Button>
      </form>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
