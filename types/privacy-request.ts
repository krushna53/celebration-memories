import { z } from "zod";

export const REQUEST_KINDS = ["access", "correction", "erasure", "withdrawal", "grievance", "nomination"] as const;
export const REQUEST_STATUSES = ["received", "verifying", "in_progress", "completed", "rejected"] as const;
export const privacyRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  event: z.string().trim().min(2).max(160),
  kind: z.enum(REQUEST_KINDS),
  details: z.string().trim().min(10).max(2000),
  website: z.string().max(200).optional(),
});
export type PrivacyRequestInput = z.infer<typeof privacyRequestSchema>;
export type RequestStatus = typeof REQUEST_STATUSES[number];
export const reviewRequestSchema = z.object({
  id: z.string().uuid(),
  expectedStatus: z.enum(REQUEST_STATUSES),
  status: z.enum(REQUEST_STATUSES),
  note: z.string().trim().min(10).max(2000),
  verification: z.string().trim().max(1000),
});
export function validRequestTransition(from: RequestStatus, to: RequestStatus) {
  return ({ received: ["verifying", "rejected"], verifying: ["in_progress", "rejected"], in_progress: ["completed", "rejected"], completed: [], rejected: [] } as Record<RequestStatus, string[]>)[from].includes(to);
}
