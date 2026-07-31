"use client";

import { PlannerBoard } from "@/features/planner/planner-board";
import {
  createPlannerTaskAdminAction,
  updatePlannerTaskAdminAction,
  deletePlannerTaskAdminAction,
  createPlannerNoteAdminAction,
  deletePlannerNoteAdminAction,
} from "@/features/admin/planner/actions";
import type { PlannerTask, PlannerNote } from "@/types/planner";

/** Binds PlannerBoard's generic callbacks to the session-authenticated admin actions for one event. */
export function PlannerAdminClient({
  eventId,
  adminName,
  tasks,
  notes,
}: {
  eventId: string;
  adminName: string | null;
  tasks: PlannerTask[];
  notes: PlannerNote[];
}) {
  return (
    <PlannerBoard
      tasks={tasks}
      notes={notes}
      currentName={adminName ?? undefined}
      onCreateTask={(values) => createPlannerTaskAdminAction(eventId, values)}
      onUpdateTask={(taskId, values) => updatePlannerTaskAdminAction(eventId, taskId, values)}
      onDeleteTask={(taskId) => deletePlannerTaskAdminAction(eventId, taskId)}
      onCreateNote={(values) => createPlannerNoteAdminAction(eventId, values)}
      onDeleteNote={(noteId) => deletePlannerNoteAdminAction(eventId, noteId)}
    />
  );
}
