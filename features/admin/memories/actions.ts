"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/services/admin-auth";
import {
  deleteMemory,
  setMemoryApproval,
  setMemoryFeatured,
  type ModerationKind,
} from "@/services/admin-memories";

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorized.");
}

function revalidateMemoryPaths() {
  revalidatePath("/admin/memories");
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function approveMemoryAction(kind: ModerationKind, id: string) {
  await requireAdmin();
  await setMemoryApproval(kind, id, true);
  revalidateMemoryPaths();
}

export async function rejectMemoryAction(kind: ModerationKind, id: string) {
  await requireAdmin();
  await setMemoryApproval(kind, id, false);
  revalidateMemoryPaths();
}

export async function toggleFeaturedAction(kind: ModerationKind, id: string, featured: boolean) {
  await requireAdmin();
  await setMemoryFeatured(kind, id, featured);
  revalidateMemoryPaths();
}

export async function deleteMemoryAction(kind: ModerationKind, id: string) {
  await requireAdmin();
  await deleteMemory(kind, id);
  revalidateMemoryPaths();
}
