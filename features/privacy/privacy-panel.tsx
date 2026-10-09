"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { privacyAction } from "./actions";
import type { SupportAudit, SupportGrant, SupportRequest } from "@/services/support-access";

const button = "rounded-full bg-navy-950 px-4 py-2 text-sm text-white disabled:opacity-50";
export function PrivacyPanel({ eventId, mode, pinned = false, isOwner, requests, grants, audit }: {
  eventId: string; mode: string; pinned?: boolean; isOwner: boolean; requests: SupportRequest[]; grants: SupportGrant[]; audit: SupportAudit[];
}) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  function submit(form: FormData) {
    start(async () => { const result = await privacyAction(form); setMessage(result.error ?? result.success ?? ""); router.refresh(); });
  }
  return <div className="space-y-8 text-navy-950">
    {message && <p role="status">{message}</p>}
    {isOwner ? <form action={submit} className="space-y-4 rounded-xl border bg-white p-6">
      <h2 className="font-display text-xl">Who can view this event?</h2>
      <input type="hidden" name="action" value="privacy" /><input type="hidden" name="event" value={eventId} />
      <label className="block">Viewing privacy<select name="mode" defaultValue={mode} className="mt-2 block w-full rounded border p-3">
        <option value="public">Public — anyone with the link</option><option disabled={pinned} value="signed_in">Sign-in required</option><option disabled={pinned} value="invited_only">Invited guests only</option>
      </select></label>
      <p className="text-sm">Sign-in verifies an account; it does not restrict viewing to your guest list. Invited-only access requires a confirmed email on your invitee list. Team members retain access.</p>
      <p className="text-sm">Choosing Public makes published content viewable without signing in. Directory listing is a separate setting.</p>
      {pinned && <p>This ongoing event is kept public by the platform administrator. Remove its public exception before restricting access.</p>}
      <button disabled={pending} className={button}>Save privacy</button>
    </form> : <form action={submit} className="space-y-4 rounded-xl border bg-white p-6">
      <h2 className="font-display text-xl">Request temporary media access</h2>
      <input type="hidden" name="action" value="request" /><input type="hidden" name="event" value={eventId} />
      <label className="block">Support reason<textarea required minLength={10} maxLength={500} name="reason" className="mt-2 block w-full rounded border p-3" /></label>
      <label className="block">Duration<select name="minutes" className="ml-3 rounded border p-2"><option value="15">15 minutes</option><option value="30">30 minutes</option></select></label>
      <p className="text-sm">The customer owner must approve. This grants read-only media access, never editing, uploads, guest lists, or RSVP access.</p>
      <button disabled={pending} className={button}>Request access</button>
    </form>}
    <section><h2 className="font-display text-xl">Support requests</h2>
      <p className="my-2 text-sm">Requests expire after 24 hours. Approved access starts immediately and can be revoked at any time.</p>
      {!requests.length && <p>No requests yet.</p>}
      {requests.map(r => <div key={r.id} className="my-3 space-y-3 rounded-xl border bg-white p-5">
        <p>{r.reason}</p><p className="break-all text-sm">Requester: {r.admin_user_id}</p>
        <p className="text-sm">{r.duration_minutes} minutes · {new Date(r.created_at).toLocaleString()} · {r.status === "pending" && Date.parse(r.created_at) + 86400000 < Date.now() ? "expired" : r.status}</p>
        {isOwner && r.status === "pending" && Date.parse(r.created_at) + 86400000 > Date.now() && <div className="flex gap-3">{["approve", "reject"].map(a => <form key={a} action={submit}><input type="hidden" name="action" value={a} /><input type="hidden" name="request" value={r.id} /><button disabled={pending} className={button}>{a === "approve" ? "Approve read-only access" : "Reject"}</button></form>)}</div>}
      </div>)}
    </section>
    <section><h2 className="font-display text-xl">Access grants</h2>{!grants.length && <p>No grants.</p>}
      {grants.map(g => <div key={g.id} className="my-3 rounded-xl border bg-white p-5">
        <p>{g.status === "active" && Date.parse(g.expires_at) <= Date.now() ? "expired" : g.status} · Expires {new Date(g.expires_at).toLocaleString()}</p>
        {isOwner && g.status === "active" && Date.parse(g.expires_at) > Date.now() && <form action={submit} className="mt-3"><input type="hidden" name="action" value="revoke" /><input type="hidden" name="grant" value={g.id} /><button disabled={pending} className={button}>Revoke support access</button></form>}
        {!isOwner && g.status === "active" && Date.parse(g.expires_at) > Date.now() && <a className="mt-3 inline-block underline" href={`/admin/support-access/media?event=${encodeURIComponent(eventId)}`}>Open read-only media</a>}
      </div>)}
    </section>
    <section><h2 className="font-display text-xl">Recent support history</h2><p className="my-2 text-sm">Requests, decisions, access checks, link issuance, revocation and expiry are logged. Records are retained until an explicit retention policy is configured; administrators cannot edit them. Previously issued media links can work for up to 60 seconds after revocation.</p>
      <ul className="space-y-2 text-sm">{audit.map(a => <li key={a.id}>{new Date(a.created_at).toLocaleString()} — {a.action}: {a.outcome}</li>)}</ul>
    </section>
  </div>;
}
