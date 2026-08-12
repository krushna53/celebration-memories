"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import type { FormOwnerRole } from "@/services/custom-forms";
import { updateFormOwnerRoleAction } from "@/features/forms/dashboard-actions";

/**
 * "All Forms" / "RSVP Forms Only" pill toggle at the top of
 * /forms/dashboard — flips the signed-in owner's own form_owners.role
 * (see services/custom-forms.ts's updateFormOwnerRole doc comment for
 * why this is self-service rather than admin-assigned). Persists
 * across sessions/devices since it's stored on the account, not just
 * local UI state.
 */
export function DashboardRoleToggle({ role }: { role: FormOwnerRole }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(role);

  function setRole(next: FormOwnerRole) {
    if (next === current) return;
    setCurrent(next);
    startTransition(async () => {
      const result = await updateFormOwnerRoleAction(next);
      if (!result.success) {
        setCurrent(role);
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="inline-flex items-center rounded-full border border-navy-950/10 bg-white p-1 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() => setRole("owner")}
        className={cn(
          "rounded-full px-3 py-1.5 font-medium transition-luxury duration-200",
          current === "owner" ? "bg-navy-950 text-ivory-50" : "text-navy-700/60 hover:text-navy-950",
        )}
      >
        All Forms
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setRole("rsvp")}
        className={cn(
          "rounded-full px-3 py-1.5 font-medium transition-luxury duration-200",
          current === "rsvp" ? "bg-gold-500 text-navy-950" : "text-navy-700/60 hover:text-navy-950",
        )}
      >
        RSVP Forms Only
      </button>
    </div>
  );
}
