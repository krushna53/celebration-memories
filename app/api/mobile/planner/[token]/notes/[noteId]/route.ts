import "server-only";
import { NextResponse } from "next/server";

import { getEventByPlannerToken, deletePlannerNote } from "@/services/event-planner";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string; noteId: string }> },
) {
  const { token, noteId } = await params;
  const event = await getEventByPlannerToken(token);
  if (!event) {
    return NextResponse.json(
      { error: "This planning link isn't valid or has been reset. Ask the host for a new one." },
      { status: 404 },
    );
  }

  try {
    await deletePlannerNote(event.id, noteId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete note." },
      { status: 500 },
    );
  }
}
