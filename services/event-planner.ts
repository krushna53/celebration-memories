import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateDraftToken } from "@/lib/tokens";
import type {
  PlannerTask,
  PlannerTaskFormValues,
  PlannerTaskUpdateValues,
  PlannerNote,
  PlannerNoteFormValues,
} from "@/types/planner";

/**
 * Backing service for the Event Planner (to-dos + notes) — see
 * features/admin/planner (client/owner, session-authenticated) and
 * features/plan (public, token-authenticated) for the two call sites.
 *
 * There's deliberately no per-person login for family collaborators:
 * the client shares one link (`events.planner_share_token`, same
 * "possession of the token is the auth" pattern as the wizard's
 * draft_token — see services/event-drafts.ts) and everyone who has it
 * can read/write the whole board. `assignedTo` / `createdBy` /
 * `authorName` are plain free-text names typed by whoever's using the
 * link, not references to any account — this is a deliberate
 * trade-off for zero-friction family access, not an oversight.
 */

interface PlannerTaskRow {
  id: string;
  event_id: string;
  title: string;
  notes: string | null;
  assigned_to: string | null;
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface PlannerNoteRow {
  id: string;
  event_id: string;
  author_name: string | null;
  content: string;
  created_at: string;
}

function mapTask(row: PlannerTaskRow): PlannerTask {
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    notes: row.notes,
    assignedTo: row.assigned_to,
    status: row.status,
    dueDate: row.due_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNote(row: PlannerNoteRow): PlannerNote {
  return {
    id: row.id,
    eventId: row.event_id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
  };
}

/** Resolves an event by its planner share link token. Works for any event status (unlike the wizard's draft token, which stops resolving once claimed) — planning happens throughout, not just before launch. */
export async function getEventByPlannerToken(
  token: string,
): Promise<{ id: string; slug: string; honoreeName: string; eventTitle: string } | null> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("id, slug, honoree_name, event_title")
    .eq("planner_share_token", token)
    .maybeSingle<{ id: string; slug: string; honoree_name: string; event_title: string }>();

  if (error) {
    console.error("getEventByPlannerToken failed:", error.message);
    return null;
  }
  if (!data) return null;
  return { id: data.id, slug: data.slug, honoreeName: data.honoree_name, eventTitle: data.event_title };
}

/** Returns the event's existing planner share token, generating and saving one on first use. */
export async function ensurePlannerShareToken(eventId: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("planner_share_token")
    .eq("id", eventId)
    .maybeSingle<{ planner_share_token: string | null }>();

  if (error) throw new Error(`Failed to load planner link: ${error.message}`);
  if (data?.planner_share_token) return data.planner_share_token;

  const token = generateDraftToken();
  const { error: updateError } = await supabaseAdmin()
    .from("events")
    .update({ planner_share_token: token })
    .eq("id", eventId);
  if (updateError) throw new Error(`Failed to create planner link: ${updateError.message}`);
  return token;
}

/** Issues a fresh token, invalidating the old link — for when a client wants to revoke access already handed out. */
export async function regeneratePlannerShareToken(eventId: string): Promise<string> {
  const token = generateDraftToken();
  const { error } = await supabaseAdmin().from("events").update({ planner_share_token: token }).eq("id", eventId);
  if (error) throw new Error(`Failed to regenerate planner link: ${error.message}`);
  return token;
}

export async function listPlannerTasks(eventId: string): Promise<PlannerTask[]> {
  const { data, error } = await supabaseAdmin()
    .from("event_planner_tasks")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load tasks: ${error.message}`);
  return (data ?? []).map(mapTask);
}

export async function createPlannerTask(eventId: string, input: PlannerTaskFormValues): Promise<PlannerTask> {
  const { data, error } = await supabaseAdmin()
    .from("event_planner_tasks")
    .insert({
      event_id: eventId,
      title: input.title,
      notes: input.notes || null,
      assigned_to: input.assignedTo || null,
      due_date: input.dueDate || null,
      created_by: input.createdBy || null,
    })
    .select("*")
    .single<PlannerTaskRow>();

  if (error || !data) throw new Error(`Failed to add task: ${error?.message}`);
  return mapTask(data);
}

export async function updatePlannerTask(
  eventId: string,
  taskId: string,
  input: PlannerTaskUpdateValues,
): Promise<void> {
  const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.assignedTo !== undefined) patch.assigned_to = input.assignedTo;
  if (input.status !== undefined) patch.status = input.status;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate;

  // Scoped by event_id as well as id — a family member holding one
  // event's planner link should never be able to touch another event's
  // task even by guessing/tampering with an id.
  const { error } = await supabaseAdmin()
    .from("event_planner_tasks")
    .update(patch)
    .eq("id", taskId)
    .eq("event_id", eventId);
  if (error) throw new Error(`Failed to update task: ${error.message}`);
}

export async function deletePlannerTask(eventId: string, taskId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("event_planner_tasks")
    .delete()
    .eq("id", taskId)
    .eq("event_id", eventId);
  if (error) throw new Error(`Failed to delete task: ${error.message}`);
}

export async function listPlannerNotes(eventId: string): Promise<PlannerNote[]> {
  const { data, error } = await supabaseAdmin()
    .from("event_planner_notes")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load notes: ${error.message}`);
  return (data ?? []).map(mapNote);
}

export async function createPlannerNote(eventId: string, input: PlannerNoteFormValues): Promise<PlannerNote> {
  const { data, error } = await supabaseAdmin()
    .from("event_planner_notes")
    .insert({ event_id: eventId, author_name: input.authorName || null, content: input.content })
    .select("*")
    .single<PlannerNoteRow>();

  if (error || !data) throw new Error(`Failed to add note: ${error?.message}`);
  return mapNote(data);
}

export async function deletePlannerNote(eventId: string, noteId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("event_planner_notes")
    .delete()
    .eq("id", noteId)
    .eq("event_id", eventId);
  if (error) throw new Error(`Failed to delete note: ${error.message}`);
}
