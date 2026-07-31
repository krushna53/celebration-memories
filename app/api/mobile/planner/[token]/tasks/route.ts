import "server-only";
import { NextResponse } from "next/server";

import { getEventByPlannerToken, createPlannerTask } from "@/services/event-planner";
import { plannerTaskFormSchema } from "@/types/planner";

export const dynamic = "force-dynamic";

/** Adds a task to the planner board — same schema/service the web /plan/[token] link uses. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
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

  const parsed = plannerTaskFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please check the task and try again." },
      { status: 422 },
    );
  }

  try {
    const task = await createPlannerTask(event.id, parsed.data);
    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add task." }, { status: 500 });
  }
}
