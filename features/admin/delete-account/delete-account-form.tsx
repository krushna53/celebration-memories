"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { confirmAccountDeletionAction, requestAccountDeletionCodeAction } from "@/features/admin/delete-account/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3.5 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30";

/**
 * Client self-serve account deletion (task #71) — two steps: send a
 * code to the account's own email, then confirm with that code plus a
 * typed "DELETE". Deliberately does NOT let the client type back their
 * own email as the confirmation (unlike the owner-facing version in
 * /admin/members, which confirms against SOMEONE ELSE's email) — the
 * emailed code already proves they still control the account's inbox,
 * which is the stronger and more relevant check here.
 */
export function DeleteAccountForm({ eventTitle, honoreeName }: { eventTitle: string; honoreeName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"warn" | "code">("warn");
  const [code, setCode] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleRequestCode() {
    setPending(true);
    setError(null);
    const result = await requestAccountDeletionCodeAction();
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSentTo(result.eventTitle);
    setStep("code");
  }

  async function handleConfirm() {
    if (!confirm(`This permanently deletes ${honoreeName}'s ${eventTitle} and everything in it — every guest, photo, video, and message. This cannot be undone. Continue?`)) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await confirmAccountDeletionAction(code, confirmText);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/");
  }

  return (
    <div className="max-w-xl rounded-xl border border-red-500/20 bg-red-500/5 p-6">
      <p className="flex items-center gap-2 font-display text-lg text-red-700">
        <AlertTriangle size={18} /> Delete My Account
      </p>
      <p className="mt-2 text-sm text-navy-700/70">
        This permanently deletes your login <strong>and</strong> {honoreeName}&rsquo;s {eventTitle} — every invitee,
        RSVP, gallery photo, timeline entry, guest photo/video/audio upload, and message. Every backup for this
        event is deleted too. If any other team members or session organizers have their own login on this event,
        remove them first (Admin → Team / Session Organizers) — this won&rsquo;t proceed while they&rsquo;re still
        attached. This cannot be undone.
      </p>

      {step === "warn" ? (
        <Button variant="outline" className="mt-4 border-red-500/40 text-red-700 hover:bg-red-500/10" disabled={pending} onClick={handleRequestCode}>
          {pending ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
          Send Me a Verification Code
        </Button>
      ) : (
        <div className="mt-4 grid gap-3">
          {sentTo ? <p className="text-sm text-navy-700/60">A code was sent to your account email — it expires in 15 minutes.</p> : null}
          <div>
            <label className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70" htmlFor="deletion-code">
              6-digit code
            </label>
            <input
              id="deletion-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              inputMode="numeric"
              placeholder="000000"
              className={`${inputClasses} mt-1.5`}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70" htmlFor="deletion-confirm">
              Type DELETE to confirm
            </label>
            <input
              id="deletion-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className={`${inputClasses} mt-1.5`}
            />
          </div>
          <Button
            variant="outline"
            className="border-red-500/40 text-red-700 hover:bg-red-500/10"
            disabled={pending || code.trim().length !== 6 || confirmText.trim().toUpperCase() !== "DELETE"}
            onClick={handleConfirm}
          >
            {pending ? <Loader2 className="animate-spin" size={16} /> : null} Permanently Delete Everything
          </Button>
        </div>
      )}

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
