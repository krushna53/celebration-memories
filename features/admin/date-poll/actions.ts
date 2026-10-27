"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminForEvent } from "@/services/admin-auth";
import { getEventById } from "@/services/events";
import { finaliseDatePoll, getDatePoll, saveDatePollOptions, setDatePollOpen } from "@/services/date-poll";
import { MAX_POLL_OPTIONS, type DatePoll } from "@/lib/date-poll";
import { zonedInputValueToUtcIso } from "@/lib/timezone";

type DatePollResult = { success: true; data: DatePoll } | { success: false; error: string };

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Every date needs a day and a start time.");

const optionsSchema = z
  .array(
    z.object({
      id: z.string().uuid().optional(),
      start: localDateTime,
      end: localDateTime.nullable(),
      label: z.string().trim().max(80).nullable(),
    }),
  )
  .max(MAX_POLL_OPTIONS, `Add at most ${MAX_POLL_OPTIONS} dates.`);

function revalidateEventPages() {
  revalidatePath("/admin/event-settings");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/invite/[token]", "page");
}

async function run(eventId: string, work: (timezone: string) => Promise<void>): Promise<DatePollResult> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }
  const event = await getEventById(eventId);
  if (!event) return { success: false, error: "Event not found." };
  try {
    await work(event.timezone);
    revalidateEventPages();
    return { success: true, data: await getDatePoll(eventId, event.timezone) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}

/** Saves the candidate dates. Times arrive as datetime-local values in the event's own timezone. */
export async function saveDatePollOptionsAction(
  eventId: string,
  options: { id?: string; start: string; end: string | null; label: string | null }[],
): Promise<DatePollResult> {
  const parsed = optionsSchema.safeParse(options);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the dates." };
  return run(eventId, (timezone) =>
    saveDatePollOptions(
      eventId,
      parsed.data.map((option) => ({
        id: option.id,
        startAt: zonedInputValueToUtcIso(option.start, timezone),
        endAt: option.end ? zonedInputValueToUtcIso(option.end, timezone) : null,
        label: option.label || null,
      })),
    ),
  );
}

export async function setDatePollOpenAction(eventId: string, open: boolean): Promise<DatePollResult> {
  return run(eventId, () => setDatePollOpen(eventId, open));
}

/** Makes one candidate the event's date (start/end in Event Settings) and closes voting. */
export async function finaliseDatePollAction(eventId: string, optionId: string): Promise<DatePollResult> {
  if (!z.string().uuid().safeParse(optionId).success) return { success: false, error: "Invalid date." };
  return run(eventId, () => finaliseDatePoll(eventId, optionId));
}
