"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import {
  ensurePlannerShareToken,
  regeneratePlannerShareToken,
  createPlannerTask,
  updatePlannerTask,
  deletePlannerTask,
  createPlannerNote,
  deletePlannerNote,
} from "@/services/event-planner";
import {
  plannerTaskFormSchema,
  plannerTaskUpdateSchema,
  plannerNoteFormSchema,
  type PlannerTask,
  type PlannerNote,
} from "@/types/planner";

export type PlannerActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function getPlannerShareLinkAction(eventId: string): Promise<PlannerActionResult<string>> {
  try {
    await requireAdminForEvent(eventId);
    const token = await ensurePlannerShareToken(eventId);
    return { success: true, data: token };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load share link." };
  }
}

export async function regeneratePlannerShareLinkAction(eventId: string): Promise<PlannerActionResult<string>> {
  try {
    await requireAdminForEvent(eventId);
    const token = await regeneratePlannerShareToken(eventId);
    revalidatePath("/admin/planner");
    return { success: true, data: token };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to regenerate share link." };
  }
}

export async function createPlannerTaskAdminAction(
  eventId: string,
  values: unknown,
): Promise<PlannerActionResult<PlannerTask>> {
  try {
    await requireAdminForEvent(eventId);
    const parsed = plannerTaskFormSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "Please check the form and try again." };
    const task = await createPlannerTask(eventId, parsed.data);
    revalidatePath("/admin/planner");
    return { success: true, data: task };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add task." };
  }
}

export async function updatePlannerTaskAdminAction(
  eventId: string,
  taskId: string,
  values: unknown,
): Promise<PlannerActionResult<undefined>> {
  try {
    await requireAdminForEvent(eventId);
    const parsed = plannerTaskUpdateSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "Please check the update and try again." };
    await updatePlannerTask(eventId, taskId, parsed.data);
    revalidatePath("/admin/planner");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update task." };
  }
}

export async function deletePlannerTaskAdminAction(
  eventId: string,
  taskId: string,
): Promise<PlannerActionResult<undefined>> {
  try {
    await requireAdminForEvent(eventId);
    await deletePlannerTask(eventId, taskId);
    revalidatePath("/admin/planner");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete task." };
  }
}

export async function createPlannerNoteAdminAction(
  eventId: string,
  values: unknown,
): Promise<PlannerActionResult<PlannerNote>> {
  try {
    await requireAdminForEvent(eventId);
    const parsed = plannerNoteFormSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "Please write something first." };
    const note = await createPlannerNote(eventId, parsed.data);
    revalidatePath("/admin/planner");
    return { success: true, data: note };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add note." };
  }
}

export async function deletePlannerNoteAdminAction(
  eventId: string,
  noteId: string,
): Promise<PlannerActionResult<undefined>> {
  try {
    await requireAdminForEvent(eventId);
    await deletePlannerNote(eventId, noteId);
    revalidatePath("/admin/planner");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete note." };
  }
}
