"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { privacyAction } from "./actions";
export function PublicLinksPanel({ events, siteUrl }: { events: { slug: string; honoree_name: string; public_access_pinned: boolean; viewing_access: string; page_status: string }[]; siteUrl: string }) {
  const [message, setMessage] = useState(""); const [busy, start] = useTransition(); const router = useRouter();
  function submit(form: FormData) { start(async () => { const result = await privacyAction(form); setMessage(result.error ?? "Public-link setting saved."); router.refresh(); }); }
  return <div className="space-y-6"><p>Keep ongoing events accessible without sign-in. This overrides viewing privacy for published content only; it never publishes drafts, unapproved uploads or private guest details.</p>
    <form action={submit} className="space-y-3 rounded-xl border bg-white p-5"><input type="hidden" name="action" value="public-link" /><input type="hidden" name="keep" value="true" /><label className="block">Event page link<input name="link" type="url" required placeholder={`${siteUrl}/events/your-event`} className="mt-2 block w-full rounded border p-3" /></label><button disabled={busy} className="rounded-full bg-navy-950 px-5 py-2 text-white">Keep this event public</button></form>
    {message && <p role="status">{message}</p>}
    <ul className="space-y-3">{events.map(e => <li key={e.slug} className="rounded-xl border bg-white p-5"><a className="font-semibold underline" href={`/events/${e.slug}`}>{e.honoree_name}</a><p className="my-2 text-sm">{e.public_access_pinned ? "Keep public — privacy restrictions disabled" : `Owner controls access: ${e.viewing_access.replaceAll("_", " ")}`} · {e.page_status}</p><form action={submit}><input type="hidden" name="action" value="public-link" /><input type="hidden" name="link" value={`${siteUrl}/events/${e.slug}`} /><input type="hidden" name="keep" value={String(!e.public_access_pinned)} /><button disabled={busy} className="text-sm underline">{e.public_access_pinned ? "Remove public exception" : "Keep public"}</button></form></li>)}</ul>
    <p className="text-sm">Removing an exception leaves the event public until its owner explicitly changes the privacy setting. It does not change the event’s published status or directory listing.</p>
  </div>;
}
