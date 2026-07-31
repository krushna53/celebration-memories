import { z } from "zod";

export type PlannerTaskStatus = "todo" | "in_progress" | "done";

export interface PlannerTask {
  id: string;
  eventId: string;
  title: string;
  notes: string | null;
  assignedTo: string | null;
  status: PlannerTaskStatus;
  dueDate: string | null; // YYYY-MM-DD
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerNote {
  id: string;
  eventId: string;
  authorName: string | null;
  content: string;
  createdAt: string;
}

export const plannerTaskFormSchema = z.object({
  title: z.string().trim().min(1, "Please add a title.").max(200),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  assignedTo: z.string().trim().max(120).optional().or(z.literal("")),
  dueDate: z.string().trim().max(10).optional().or(z.literal("")),
  createdBy: z.string().trim().max(120).optional().or(z.literal("")),
});
export type PlannerTaskFormValues = z.infer<typeof plannerTaskFormSchema>;

export const plannerTaskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  assignedTo: z.string().trim().max(120).nullable().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  dueDate: z.string().trim().max(10).nullable().optional(),
});
export type PlannerTaskUpdateValues = z.infer<typeof plannerTaskUpdateSchema>;

export const plannerNoteFormSchema = z.object({
  authorName: z.string().trim().max(120).optional().or(z.literal("")),
  content: z.string().trim().min(1, "Please write something.").max(2000),
});
export type PlannerNoteFormValues = z.infer<typeof plannerNoteFormSchema>;
