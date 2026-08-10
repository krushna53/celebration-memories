"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import {
  getRecycleItemEventId,
  purgeItem,
  restoreFromTrash,
  type RecycleBinKind,
} from "@/services/recycle-bin";

function revalidateTrashPaths() {
  revalidatePath("/admin/recycle-bin");
  revalidatePath("/admin/gallery");
  revalidatePath("/admin/memories");
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Looks up which event a (possibly trashed) media item belongs to and confirms the caller is allowed to manage it — same "re-resolve from id, don't trust the client" pattern as requireAdminForPhoto/requireAdminForMemory elsewhere in the codebase. */
async function requireAdminForTrashItem(kind: RecycleBinKind, id: string) {
  const eventId = await getRecycleItemEventId(kind, id);
  if (!eventId) throw new Error("Item not found.");
  await requireAdminForEvent(eventId);
}

export async function restoreTrashItemAction(kind: RecycleBinKind, id: string) {
  try {
    await requireAdminForTrashItem(kind, id);
    await restoreFromTrash(kind, id);
    revalidateTrashPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Permanently deletes a trashed item ahead of the automatic 30-day purge — irreversible, unlike the normal Delete button. */
export async function purgeTrashItemAction(kind: RecycleBinKind, id: string) {
  try {
    await requireAdminForTrashItem(kind, id);
    await purgeItem(kind, id);
    revalidateTrashPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}
