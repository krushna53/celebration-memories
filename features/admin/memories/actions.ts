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

function revalidateMemoryPaths() {
  revalidatePath("/admin/memories");
  revalidatePath("/admin");
  revalidatePath("/");
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

export async function deleteMemoryAction(kind: ModerationKind, id: string) {
  await requireAdminForMemory(kind, id);
  await deleteMemory(kind, id);
  revalidateMemoryPaths();
}
