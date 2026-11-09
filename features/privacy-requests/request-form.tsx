"use client";
import { useState } from "react";
import { submitPrivacyRequestAction } from "./actions";
import { REQUEST_KINDS } from "@/types/privacy-request";

export function PrivacyRequestForm() {
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  if (reference) return <div role="status" className="rounded border bg-white p-5"><p>Your request was received. Save this reference:</p><p className="my-3 break-all font-mono">{reference}</p><p>We will contact the email you supplied to verify identity and clarify your request. This reference alone does not authorise access or deletion. To follow up, contact the privacy team with this reference. No email acknowledgement has been sent automatically.</p></div>;
  return <form className="grid gap-5 rounded border bg-white p-5" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setMessage("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await submitPrivacyRequestAction(values);
      if (result.success) setReference(result.reference); else setMessage(result.error);
    } catch { setMessage("Unable to submit. Please use the privacy contact below."); }
    finally { setBusy(false); }
  }}>
    <label className="grid gap-1">Contact email<input name="email" type="email" required maxLength={254} className="rounded border p-2" /></label>
    <label className="grid gap-1">Event name or platform account<input name="event" required minLength={2} maxLength={160} className="rounded border p-2" /></label>
    <label className="grid gap-1">Request type<select name="kind" className="rounded border p-2">{REQUEST_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
    <label className="grid gap-1">What would you like us to do?<textarea name="details" required minLength={10} maxLength={2000} rows={5} className="rounded border p-2" /></label>
    <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <p className="text-sm">We use these details to handle and verify your request. Do not include passwords, invitation tokens, identity documents or card details. A request on behalf of another person requires verification of your authority.</p>
    {message ? <p role="alert">{message}</p> : null}
    <button type="submit" disabled={busy} className="rounded border px-4 py-2">{busy ? "Submitting…" : "Submit privacy request"}</button>
  </form>;
}
