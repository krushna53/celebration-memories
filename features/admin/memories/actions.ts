"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import {
  deleteMemory,
  getMemoryEventId,
  setMemoryApproval,
  setMemoryFeatured,
  type ModerationKind,
} from "@/services/admin-memories";
import { moveToTrash, type RecycleBinKind } from "@/services/recycle-bin";

function revalidateMemoryPaths() {
  revalidatePath("/admin/memories");
  revalidatePath("/admin/recycle-bin");
  revalidatePath("/admin");
  revalidatePath("/");
}

/** guestbook has no Recycle Bin equivalent (text, not media — see services/recycle-bin.ts) so it keeps its original hard-delete path below; the three media kinds share the same table name against RecycleBinKind. */
function toRecycleBinKind(kind: Exclude<ModerationKind, "guestbook">): RecycleBinKind {
  return kind;
}

/** Looks up which event a memory item belongs to and confirms the caller is allowed to moderate it — closes the gap where any logged-in admin could approve/feature/delete another client's guest memories by id alone. */
async function requireAdminForMemory(kind: ModerationKind, id: string) {
  const eventId = await getMemoryEventId(kind, id);
  if (!eventId) throw new Error("Memory not found.");
  await requireAdminForEvent(eventId);
}

export async function approveMemoryAction(kind: ModerationKind, id: string) {
  await requireAdminForMemory(kind, id);
  await setMemoryApproval(kind, id, true);
  revalidateMemoryPaths();
}

export async function rejectMemoryAction(kind: ModerationKind, id: string) {
  await requireAdminForMemory(kind, id);
  await setMemoryApproval(kind, id, false);
  revalidateMemoryPaths();
}

export async function toggleFeaturedAction(kind: ModerationKind, id: string, featured: boolean) {
  await requireAdminForMemory(kind, id);
  await setMemoryFeatured(kind, id, featured);
  revalidateMemoryPaths();
}

/** Photos/videos/audio move to the Recycle Bin (soft delete, 30-day undo window — see services/recycle-bin.ts); guestbook messages are text, not media, and are still removed immediately. */
export async function deleteMemoryAction(kind: ModerationKind, id: string) {
  await requireAdminForMemory(kind, id);
  if (kind === "guestbook") {
    await deleteMemory(kind, id);
  } else {
    await moveToTrash(toRecycleBinKind(kind), id);
  }
  revalidateMemoryPaths();
}
