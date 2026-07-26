import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TimelineMilestoneRecord } from "@/types/content";

interface MilestoneRow {
  id: string;
  event_id: string;
  period: string;
  title: string;
  description: string;
  sort_order: number;
  created_at: string;
}

function mapRow(row: MilestoneRow): TimelineMilestoneRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    period: row.period,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function listMilestones(eventId: string): Promise<TimelineMilestoneRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("timeline_milestones")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to list milestones: ${error.message}`);
  return (data as MilestoneRow[]).map(mapRow);
}

export async function createMilestone(input: {
  eventId: string;
  period: string;
  title: string;
  description: string;
  sortOrder?: number;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("timeline_milestones").insert({
    event_id: input.eventId,
    period: input.period,
    title: input.title,
    description: input.description,
    sort_order: input.sortOrder ?? 0,
  });
  if (error) throw new Error(`Failed to add milestone: ${error.message}`);
}

export async function updateMilestone(
  id: string,
  input: { period?: string; title?: string; description?: string; sortOrder?: number },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.period !== undefined) patch.period = input.period;
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const { error } = await supabaseAdmin().from("timeline_milestones").update(patch).eq("id", id);
  if (error) throw new Error(`Failed to update milestone: ${error.message}`);
}

export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("timeline_milestones").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete milestone: ${error.message}`);
}
