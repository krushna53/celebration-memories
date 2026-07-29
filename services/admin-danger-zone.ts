import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Every Storage path this platform ever writes for an event starts with
 * `${eventId}/...` (see services/uploads.ts — guest photo/video/audio,
 * Gallery, share-image, share-video, timeline images, AI-generated/
 * uploaded images, slideshow music: all of them). Recursively removing
 * everything under that prefix in each of these four buckets is
 * therefore a complete cleanup without needing to separately track every
 * upload type's own path convention. `platform/...` uploads (payment QR)
 * are deliberately NOT under an event prefix and are untouched by this.
 */
const EVENT_SCOPED_BUCKETS = ["photos", "videos", "audio", "gallery"] as const;

/**
 * Recursively deletes every object under `prefix` in `bucket`. Supabase
 * Storage's `list()` is one level at a time and represents subfolders as
 * entries with `id: null` (no file metadata) — so this walks down into
 * each one before removing files, since `remove()` only takes file paths,
 * not folders.
 */
async function deleteAllUnderPrefix(bucket: string, prefix: string): Promise<void> {
  const client = supabaseAdmin();
  const { data: entries, error } = await client.storage.from(bucket).list(prefix, { limit: 1000 });

  if (error || !entries || entries.length === 0) return;

  const files: string[] = [];
  const folders: string[] = [];
  for (const entry of entries) {
    if (entry.id === null) {
      folders.push(`${prefix}/${entry.name}`);
    } else {
      files.push(`${prefix}/${entry.name}`);
    }
  }

  if (files.length > 0) {
    await client.storage.from(bucket).remove(files);
  }
  for (const folder of folders) {
    await deleteAllUnderPrefix(bucket, folder);
  }
}

/**
 * Permanently deletes an event and everything in it:
 *
 * - Every dependent DB row — invitees, RSVPs, photos/videos/audio rows,
 *   guestbook, timeline milestones, gallery photos, AI image/CSS/
 *   slideshow generations and jobs, activity logs, wizard payments, and
 *   any `admins` row still pointing at this event — all `on delete
 *   cascade` from `events` (confirmed against the live schema's foreign
 *   keys), so deleting the `events` row handles all of this.
 * - Every Storage object under `${eventId}/` across the photos, videos,
 *   audio, and gallery buckets — NOT covered by the DB cascade, since
 *   Storage isn't a Postgres table.
 *
 * Irreversible. Callers are responsible for confirming with whoever
 * triggered this — this function itself does not ask (see
 * features/admin/members/actions.ts's deleteAdminAccountAction for the
 * confirmation gate).
 */
export async function deleteEventAndAllAssets(eventId: string): Promise<void> {
  await Promise.all(EVENT_SCOPED_BUCKETS.map((bucket) => deleteAllUnderPrefix(bucket, eventId)));

  const { error } = await supabaseAdmin().from("events").delete().eq("id", eventId);
  if (error) throw new Error(`Failed to delete event: ${error.message}`);
}

interface AdminLookupRow {
  id: string;
  role: "owner" | "client";
  event_id: string | null;
}

/**
 * Fully deletes a client account: their event and everything in it (see
 * deleteEventAndAllAssets above, if they have one), their `admins` row,
 * and their underlying Supabase Auth user — so unlike
 * deleteAdminAccess() (services/admin-users.ts, a reversible access
 * revocation), this is a complete, irreversible account deletion. The
 * email becomes free to register again from scratch afterward.
 *
 * Refuses to run against an owner account, and refuses to delete an
 * event that has more than one `admins` row pointing at it (shouldn't
 * normally happen, but is exactly the shape of state the pre-fix
 * flagship-fallback bug could produce — see lib/admin-event.ts — so
 * this checks explicitly rather than assuming it can't).
 */
export async function deleteAdminAccountAndAssets(adminId: string): Promise<void> {
  const client = supabaseAdmin();

  const { data: adminRow, error: lookupError } = await client
    .from("admins")
    .select("id, role, event_id")
    .eq("id", adminId)
    .maybeSingle<AdminLookupRow>();

  if (lookupError) throw new Error(`Failed to look up account: ${lookupError.message}`);
  if (!adminRow) return;
  if (adminRow.role === "owner") {
    throw new Error("Refusing to delete an owner account.");
  }

  if (adminRow.event_id) {
    const { count } = await client
      .from("admins")
      .select("id", { count: "exact", head: true })
      .eq("event_id", adminRow.event_id);

    if ((count ?? 0) > 1) {
      throw new Error(
        "More than one login is attached to this account's event — remove the others first, or use Remove Access instead of a full delete.",
      );
    }

    await deleteEventAndAllAssets(adminRow.event_id);
  }

  // Cascades automatically once the event above is gone (if event_id
  // was set), but this account might not have had an event at all —
  // delete explicitly either way rather than assuming the cascade ran.
  await client.from("admins").delete().eq("id", adminId);

  const { error: authError } = await client.auth.admin.deleteUser(adminId);
  if (authError) {
    throw new Error(
      `Deleted their data and dashboard access, but couldn't remove their login itself: ${authError.message}`,
    );
  }
}
