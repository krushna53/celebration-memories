"use server";

import { revalidatePath } from "next/cache";

import {
  getEventByPlannerToken,
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

export type PlanActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

/**
 * Token-gated counterparts to features/admin/planner/actions.ts, for the
 * no-login family-collaborator link at /plan/[token]. Every action
 * re-resolves the event from the token itself rather than trusting an
 * eventId the client might pass — same "never trust the caller's id
 * alone" rule the wizard's draft-token actions follow (see
 * features/start/actions/*.ts) — so a stale or tampered link can never
 * touch a different event's data.
 */
async function requireEventByToken(token: string) {
  const event = await getEventByPlannerToken(token);
  if (!event) throw new Error("This planning link isn't valid or has been reset. Ask the host for a new one.");
  return event;
}

export async function createPlannerTaskAction(
  token: string,
  values: unknown,
): Promise<PlanActionResult<PlannerTask>> {
  try {
    const event = await requireEventByToken(token);
    const parsed = plannerTaskFormSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "Please check the form and try again." };
    const task = await createPlannerTask(event.id, parsed.data);
    revalidatePath(`/plan/${token}`);
    return { success: true, data: task };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add task." };
  }
}

export async function updatePlannerTaskAction(
  token: string,
  taskId: string,
  values: unknown,
): Promise<PlanActionResult<undefined>> {
  try {
    const event = await requireEventByToken(token);
    const parsed = plannerTaskUpdateSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "Please check the update and try again." };
    await updatePlannerTask(event.id, taskId, parsed.data);
    revalidatePath(`/plan/${token}`);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update task." };
  }
}

export async function deletePlannerTaskAction(token: string, taskId: string): Promise<PlanActionResult<undefined>> {
  try {
    const event = await requireEventByToken(token);
    await deletePlannerTask(event.id, taskId);
    revalidatePath(`/plan/${token}`);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete task." };
  }
}

export async function createPlannerNoteAction(
  token: string,
  values: unknown,
): Promise<PlanActionResult<PlannerNote>> {
  try {
    const event = await requireEventByToken(token);
    const parsed = plannerNoteFormSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "Please write something first." };
    const note = await createPlannerNote(event.id, parsed.data);
    revalidatePath(`/plan/${token}`);
    return { success: true, data: note };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add note." };
  }
}

export async function deletePlannerNoteAction(token: string, noteId: string): Promise<PlanActionResult<undefined>> {
  try {
    const event = await requireEventByToken(token);
    await deletePlannerNote(event.id, noteId);
    revalidatePath(`/plan/${token}`);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete note." };
  }
}
