"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createPromoCodeAction, setPromoCodeActiveAction } from "@/features/admin/promo-codes/actions";
import type { PromoCodeRecord } from "@/services/promo-codes";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

export function PromoCodeList({ initialCodes }: { initialCodes: PromoCodeRecord[] }) {
  const [codes, setCodes] = useState(initialCodes);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [creating, startCreate] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startCreate(async () => {
      const result = await createPromoCodeAction({
        code,
        description,
        maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
      });
      if (result.success) {
        setCode("");
        setDescription("");
        setMaxRedemptions("");
        // Simplest correct way to reflect the new row without a second
        // service function — reload picks it up from the server list.
        window.location.reload();
      } else {
        setError(result.error);
      }
    });
  }

  function toggle(id: string, active: boolean) {
    setBusyId(id);
    startCreate(async () => {
      const result = await setPromoCodeActiveAction(id, active);
      setBusyId(null);
      if (result.success) {
        setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)));
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <form onSubmit={submit} className="grid gap-3 rounded-xl border border-navy-950/10 bg-white p-5 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="CODE (e.g. LAUNCH100)"
          className={`${inputClasses} uppercase`}
          required
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Note (optional)"
          className={inputClasses}
        />
        <input
          value={maxRedemptions}
          onChange={(e) => setMaxRedemptions(e.target.value)}
          placeholder="Max uses"
          type="number"
          min={1}
          className={`${inputClasses} w-28`}
        />
        <Button type="submit" disabled={creating || !code.trim()}>
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Create
        </Button>
      </form>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-navy-950/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy-950/5 text-xs uppercase tracking-wide text-navy-700/60">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3">Used</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-950/5">
            {codes.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-mono font-medium text-navy-950">{c.code}</td>
                <td className="px-4 py-3 text-navy-700/60">{c.description || "—"}</td>
                <td className="px-4 py-3 text-navy-700/60">
                  {c.redemptionCount}
                  {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      c.active ? "bg-green-100 text-green-700" : "bg-navy-950/5 text-navy-700/50"
                    }`}
                  >
                    {c.active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => toggle(c.id, !c.active)}
                    className="text-xs text-navy-700/60 underline underline-offset-2 hover:text-navy-950 disabled:opacity-50"
                  >
                    {c.active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
            {codes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-navy-700/50">
                  No promo codes yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
