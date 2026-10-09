import { notFound } from "next/navigation";
import { requireOwner } from "@/services/admin-auth";
import { supportExpiry } from "@/services/event-access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedMediaPath } from "@/lib/media-url";
import { SupportMediaViewer } from "@/features/privacy/support-media-viewer";
export const dynamic = "force-dynamic";
export default async function SupportMediaPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  await requireOwner();
  const eventId = (await searchParams).event;
  if (!eventId) notFound();
  const expiresAt = await supportExpiry(eventId);
  if (!expiresAt) notFound();
  const items: { id: string; url: string; video: boolean; audio: boolean }[] = [];
  for (const bucket of ["gallery", "photos", "videos", "audio"] as const) {
    const table = bucket === "gallery" ? "gallery_photos" : bucket;
    const { data, error } = await supabaseAdmin().from(table).select("id,storage_path").eq("event_id", eventId).is("deleted_at", null).limit(100);
    if (error) throw new Error("Could not load support media.");
    for (const row of data ?? []) items.push({ id: `${bucket}-${row.id}`, url: signedMediaPath(bucket, row.storage_path) + "&support=1", video: /\.(mp4|webm|mov|m4v)$/i.test(row.storage_path), audio: bucket === "audio" });
  }
  return <SupportMediaViewer eventId={eventId} expiresAt={expiresAt} items={items} />;
}
