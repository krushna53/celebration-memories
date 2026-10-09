"use client";
/* eslint-disable @next/next/no-img-element -- Direct media requests carry viewer cookies; shared image optimization must not be used. */
import { useEffect, useState } from "react";
export function SupportMediaViewer({ eventId, expiresAt, items }: { eventId: string; expiresAt: number; items: { id: string; url: string; video: boolean; audio: boolean }[] }) {
  const [allowed, setAllowed] = useState(Date.now() < expiresAt);
  useEffect(() => {
    const timeout = setTimeout(() => setAllowed(false), Math.max(0, expiresAt - Date.now()));
    // Revocation clears already displayed media on the next poll. Server media
    // requests always check the grant independently of this UI timer.
    const interval = setInterval(async () => {
      try { const response = await fetch(`/api/support-access?event=${encodeURIComponent(eventId)}`, { cache: "no-store" }); if (!response.ok) setAllowed(false); }
      catch { setAllowed(false); }
    }, 10000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [eventId, expiresAt]);
  if (!allowed) return <p role="alert">Support access has ended. A new request and owner approval are required.</p>;
  return <div><h1 className="font-display text-2xl">Read-only support media</h1><p className="my-4">Event {eventId} · Access expires {new Date(expiresAt).toLocaleString()}. Viewing is logged.</p><div className="grid gap-4 sm:grid-cols-2">{items.map(item => <div key={item.id}>{item.audio ? <audio controls src={item.url} /> : item.video ? <video className="w-full" controls src={item.url} /> : <img className="w-full" src={item.url} alt="Event media for approved support" />}</div>)}</div></div>;
}
