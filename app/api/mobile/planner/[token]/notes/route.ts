import "server-only";
import { NextResponse } from "next/server";

import { getEventByPlannerToken, createPlannerNote } from "@/services/event-planner";
import { plannerNoteFormSchema } from "@/types/planner";

export const dynamic = "force-dynamic";

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

  const parsed = plannerNoteFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please write something first." },
      { status: 422 },
    );
  }

  try {
    const note = await createPlannerNote(event.id, parsed.data);
    return NextResponse.json({ note });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add note." }, { status: 500 });
  }
}
