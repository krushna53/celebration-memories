import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { listInvitees } from "@/services/admin-invitees";
import { normaliseWhatsAppNumber } from "@/services/event-extras";
import { DEFAULT_EVENT_TIMEZONE } from "@/lib/timezone";
import { MAX_POLL_OPTIONS, OPEN_ENDED_DURATION_MS, type DatePoll, type DatePollOption } from "@/lib/date-poll";

/**
 * Date poll (migration 20261027120000_date_poll.sql): instead of fixing a
 * date, the host lists a few candidates, guests tick every date that works
 * for them, and the host finalises one.
 *
 * While events.date_poll_open is true, events.start_at/end_at hold the
 * earliest candidate as a placeholder — never shown to guests (the
 * NOT NULL column and every "has the event ended?" check keep working),
 * but kept in sync here so the placeholder is never in the past while a
 * future candidate exists.
 */

interface OptionRow {
  id: string;
  start_at: string;
  end_at: string | null;
  label: string | null;
}

interface VoteRow {
  option_id: string;
  voter_key: string;
  voter_name: string;
}

export interface DatePollOptionInput {
  /** Existing option to keep (votes for it are kept too); omit for a new one. */
  id?: string;
  startAt: string;
  endAt: string | null;
  label: string | null;
}

/** A voter is an invitee (personal invite link) or a name + phone on the public event page. */
export interface DatePollVoterIdentity {
  key: string;
  name: string;
  phone: string | null;
  inviteeId: string | null;
}

export function inviteeVoterKey(inviteeId: string): string {
  return `inv:${inviteeId}`;
}

export async function getDatePoll(eventId: string, timezone: string = DEFAULT_EVENT_TIMEZONE): Promise<DatePoll> {
  const db = supabaseAdmin();
  const [eventRes, optionsRes, votesRes] = await Promise.all([
    db.from("events").select("date_poll_open").eq("id", eventId).maybeSingle<{ date_poll_open: boolean | null }>(),
    db.from("event_date_poll_options").select("id, start_at, end_at, label").eq("event_id", eventId).order("start_at"),
    db.from("event_date_poll_votes").select("option_id, voter_key, voter_name").eq("event_id", eventId).order("created_at"),
  ]);
  if (optionsRes.error) throw new Error(`Failed to load date poll: ${optionsRes.error.message}`);
  if (votesRes.error) throw new Error(`Failed to load date poll votes: ${votesRes.error.message}`);

  const votes = (votesRes.data ?? []) as VoteRow[];
  const options: DatePollOption[] = ((optionsRes.data ?? []) as OptionRow[]).map((row) => ({
    id: row.id,
    startAt: row.start_at,
    endAt: row.end_at,
    label: row.label,
    voters: votes.filter((v) => v.option_id === row.id).map((v) => ({ name: v.voter_name })),
  }));

  return {
    open: eventRes.data?.date_poll_open ?? false,
    timezone,
    options,
    voterCount: new Set(votes.map((v) => v.voter_key)).size,
  };
}

/** Option ids this voter has ticked — to pre-fill their choices when they come back. */
export async function getVoterChoices(eventId: string, voterKey: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("event_date_poll_votes")
    .select("option_id")
    .eq("event_id", eventId)
    .eq("voter_key", voterKey);
  if (error) return [];
  return (data as { option_id: string }[]).map((row) => row.option_id);
}

/**
 * Identifies a public-page voter. Phones are compared in wa.me form
 * ("+91 98765 43210" and "9876543210" match). Someone whose phone matches an invitee
 * counts as that invitee, so voting from the event page and then from
 * their personal link replaces rather than doubles their vote.
 */
export async function resolvePublicVoter(eventId: string, name: string, phone: string): Promise<DatePollVoterIdentity | null> {
  const digits = normaliseWhatsAppNumber(phone);
  if (!digits) return null;
  const invitees = await listInvitees(eventId);
  const match = invitees.find((inv) => inv.phone && normaliseWhatsAppNumber(inv.phone) === digits);
  return match
    ? { key: inviteeVoterKey(match.id), name, phone: digits, inviteeId: match.id }
    : { key: `ph:${digits}`, name, phone: digits, inviteeId: null };
}

/** Replaces this voter's choices with `optionIds` (empty = withdraw their vote). */
export async function castDatePollVote(eventId: string, voter: DatePollVoterIdentity, optionIds: string[]): Promise<void> {
  const db = supabaseAdmin();
  const { data: options, error: optionsError } = await db.from("event_date_poll_options").select("id").eq("event_id", eventId);
  if (optionsError) throw new Error(optionsError.message);
  const valid = new Set((options as { id: string }[]).map((o) => o.id));
  const chosen = [...new Set(optionIds)].filter((id) => valid.has(id));

  const { error: deleteError } = await db.from("event_date_poll_votes").delete().eq("event_id", eventId).eq("voter_key", voter.key);
  if (deleteError) throw new Error(deleteError.message);
  if (chosen.length === 0) return;

  const { error } = await db.from("event_date_poll_votes").insert(
    chosen.map((optionId) => ({
      event_id: eventId,
      option_id: optionId,
      invitee_id: voter.inviteeId,
      voter_key: voter.key,
      voter_name: voter.name,
      voter_phone: voter.phone,
    })),
  );
  if (error) throw new Error(error.message);
}

/**
 * Saves the host's candidate list: options with an id are updated (their
 * votes kept), new ones inserted, and any left out deleted with their votes.
 */
export async function saveDatePollOptions(eventId: string, inputs: DatePollOptionInput[]): Promise<void> {
  if (inputs.length > MAX_POLL_OPTIONS) throw new Error(`Add at most ${MAX_POLL_OPTIONS} dates.`);
  for (const input of inputs) {
    if (Number.isNaN(Date.parse(input.startAt))) throw new Error("Every date needs a start time.");
    if (input.endAt && Date.parse(input.endAt) <= Date.parse(input.startAt)) throw new Error("An end time must be after its start time.");
  }

  const db = supabaseAdmin();
  const { data: existing, error: existingError } = await db.from("event_date_poll_options").select("id").eq("event_id", eventId);
  if (existingError) throw new Error(existingError.message);
  const existingIds = new Set((existing as { id: string }[]).map((o) => o.id));
  const keptIds = new Set(inputs.flatMap((input) => (input.id && existingIds.has(input.id) ? [input.id] : [])));

  const removed = [...existingIds].filter((id) => !keptIds.has(id));
  if (removed.length > 0) {
    const { error } = await db.from("event_date_poll_options").delete().eq("event_id", eventId).in("id", removed);
    if (error) throw new Error(error.message);
  }

  for (const input of inputs) {
    const row = { start_at: input.startAt, end_at: input.endAt, label: input.label };
    const { error } =
      input.id && keptIds.has(input.id)
        ? await db.from("event_date_poll_options").update(row).eq("id", input.id).eq("event_id", eventId)
        : await db.from("event_date_poll_options").insert({ ...row, event_id: eventId });
    if (error) throw new Error(error.message);
  }

  await syncPlaceholderDate(eventId);
}

/** Opens or closes voting. Opening needs at least two dates to choose between. */
export async function setDatePollOpen(eventId: string, open: boolean): Promise<void> {
  const db = supabaseAdmin();
  if (open) {
    const { count, error } = await db
      .from("event_date_poll_options")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if (error) throw new Error(error.message);
    if ((count ?? 0) < 2) throw new Error("Add at least two dates for guests to choose from.");
  }
  const { error } = await db.from("events").update({ date_poll_open: open }).eq("id", eventId);
  if (error) throw new Error(error.message);
  if (open) await syncPlaceholderDate(eventId);
}

/** Makes `optionId` the event's real date and closes the poll. Votes are kept for the record. */
export async function finaliseDatePoll(eventId: string, optionId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("event_date_poll_options")
    .select("id, start_at, end_at, label")
    .eq("id", optionId)
    .eq("event_id", eventId)
    .maybeSingle<OptionRow>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That date is no longer in the poll.");

  const { error: updateError } = await db.from("events").update({ ...eventDatesFor(data), date_poll_open: false }).eq("id", eventId);
  if (updateError) throw new Error(updateError.message);
}

function eventDatesFor(option: Pick<OptionRow, "start_at" | "end_at">) {
  return {
    start_at: option.start_at,
    end_at: option.end_at ?? new Date(Date.parse(option.start_at) + OPEN_ENDED_DURATION_MS).toISOString(),
    has_end_time: option.end_at !== null,
  };
}

/** While the poll is open, keeps events.start_at/end_at on the earliest still-upcoming candidate. */
async function syncPlaceholderDate(eventId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: event } = await db.from("events").select("date_poll_open").eq("id", eventId).maybeSingle<{ date_poll_open: boolean | null }>();
  if (!event?.date_poll_open) return;

  const { data } = await db.from("event_date_poll_options").select("start_at, end_at").eq("event_id", eventId).order("start_at");
  const options = (data ?? []) as Pick<OptionRow, "start_at" | "end_at">[];
  const placeholder = options.find((o) => Date.parse(o.start_at) > Date.now()) ?? options[options.length - 1];
  if (!placeholder) return;
  const { error } = await db.from("events").update(eventDatesFor(placeholder)).eq("id", eventId);
  if (error) throw new Error(error.message);
}
