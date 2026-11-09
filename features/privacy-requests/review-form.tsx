"use client";
import { useState } from "react";
import { reviewPrivacyRequestAction } from "./actions";
import { REQUEST_STATUSES, validRequestTransition, type RequestStatus } from "@/types/privacy-request";
export function PrivacyReviewForm({ id, status, verification }: { id: string; status: RequestStatus; verification: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const options = REQUEST_STATUSES.filter((value) => validRequestTransition(status, value));
  if (!options.length) return <p className="mt-3 text-sm">Review closed.</p>;
  return <form className="mt-4 grid gap-3" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await reviewPrivacyRequestAction({ ...data, id, expectedStatus: status });
      setMessage(result.success ? "Review saved." : result.error);
    } catch { setMessage("Unable to save review. Refresh and try again."); }
    finally { setBusy(false); }
  }}>
    <label className="grid gap-1">Next status<select name="status" className="rounded border p-2">{options.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label className="grid gap-1">Identity and authority verification record<textarea name="verification" defaultValue={verification} maxLength={1000} className="rounded border p-2" placeholder="Record the verification method and date; do not paste identity documents." /></label>
    <label className="grid gap-1">Review / fulfilment note<textarea name="note" required minLength={10} maxLength={2000} className="rounded border p-2" placeholder="Record action taken, systems/processors checked, exceptions, and communication sent." /></label>
    <button type="submit" disabled={busy} className="rounded border p-2">{busy ? "Saving…" : "Save review"}</button>
    {message ? <p role="status">{message}</p> : null}
  </form>;
}
