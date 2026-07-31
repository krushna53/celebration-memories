import "server-only";
import { NextResponse } from "next/server";

import { getEventByPlannerToken, updatePlannerTask, deletePlannerTask } from "@/services/event-planner";
import { plannerTaskUpdateSchema } from "@/types/planner";

export const dynamic = "force-dynamic";

/** Updates a task's status/fields — scoped by event_id as well as id server-side (see updatePlannerTask), so a stale link can never touch another event's task. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string; taskId: string }> },
) {
  const { token, taskId } = await params;
  const event = await getEventByPlannerToken(token);
  if (!event) {
    return NextResponse.json(
      { error: "This planning link isn't valid or has been reset. Ask the host for a new one." },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = plannerTaskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the update and try again." }, { status: 422 });
  }

  try {
    await updatePlannerTask(event.id, taskId, parsed.data);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update task." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string; taskId: string }> },
) {
  const { token, taskId } = await params;
  const event = await getEventByPlannerToken(token);
  if (!event) {
    return NextResponse.json(
      { error: "This planning link isn't valid or has been reset. Ask the host for a new one." },
      { status: 404 },
    );
  }

  try {
    await deletePlannerTask(event.id, taskId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete task." },
      { status: 500 },
    );
  }
}
