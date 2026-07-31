"use client";

import { NameGate } from "@/features/plan/name-gate";
import { PlannerBoard } from "@/features/planner/planner-board";
import {
  createPlannerTaskAction,
  updatePlannerTaskAction,
  deletePlannerTaskAction,
  createPlannerNoteAction,
  deletePlannerNoteAction,
} from "@/features/plan/actions";
import type { PlannerTask, PlannerNote } from "@/types/planner";

/** Binds PlannerBoard's generic callbacks to the token-authenticated public actions, gated behind a one-time name prompt (see NameGate). */
export function PlannerPublicClient({
  token,
  tasks,
  notes,
}: {
  token: string;
  tasks: PlannerTask[];
  notes: PlannerNote[];
}) {
  return (
    <NameGate storageKey={`cm-planner-name-${token}`}>
      {(name) => (
        <PlannerBoard
          tasks={tasks}
          notes={notes}
          currentName={name}
          onCreateTask={(values) => createPlannerTaskAction(token, values)}
          onUpdateTask={(taskId, values) => updatePlannerTaskAction(token, taskId, values)}
          onDeleteTask={(taskId) => deletePlannerTaskAction(token, taskId)}
          onCreateNote={(values) => createPlannerNoteAction(token, values)}
          onDeleteNote={(noteId) => deletePlannerNoteAction(token, noteId)}
        />
      )}
    </NameGate>
  );
}
