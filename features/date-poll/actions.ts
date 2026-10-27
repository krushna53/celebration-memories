"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getInviteeByToken } from "@/services/invitees";
import { getEventById } from "@/services/events";
import { canViewEvent } from "@/services/event-access";
import { currentIpHash, isLockedOut, recordFailure } from "@/services/abuse-guard";
import {
  castDatePollVote,
  getDatePoll,
  inviteeVoterKey,
  resolvePublicVoter,
  type DatePollVoterIdentity,
} from "@/services/date-poll";
import type { DatePoll } from "@/lib/date-poll";

type VoteResult = { success: true; data: DatePoll } | { success: false; error: string };

const optionIdsSchema = z.array(z.string().uuid()).max(20);

const publicVoterSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(80),
  phone: z.string().trim().min(7, "Please enter your phone number.").max(30),
});

async function vote(eventId: string, timezone: string, voter: DatePollVoterIdentity, optionIds: string[]): Promise<VoteResult> {
  try {
    await castDatePollVote(eventId, voter, optionIds);
    revalidatePath("/events/[slug]", "page");
    revalidatePath("/");
    return { success: true, data: await getDatePoll(eventId, timezone) };
  } catch (err) {
    console.error("date poll vote failed:", err);
    return { success: false, error: "Couldn't save your vote — please try again." };
  }
}

/** Votes from a personal invite link — the guest is identified by their token, never by anything the client sends. */
export async function voteWithInviteTokenAction(token: string, optionIds: string[]): Promise<VoteResult> {
  const ids = optionIdsSchema.safeParse(optionIds);
  if (!ids.success) return { success: false, error: "Invalid choice." };

  const found = await getInviteeByToken(token);
  if (!found) return { success: false, error: "This invitation link isn't valid." };
  const { invitee, event } = found;
  if (!event.datePollOpen) return { success: false, error: "Voting on the date has closed." };

  return vote(
    event.id,
    event.timezone,
    { key: inviteeVoterKey(invitee.id), name: invitee.name, phone: null, inviteeId: invitee.id },
    ids.data,
  );
}

/** Votes from the public event page — the visitor gives their name and phone (matched to the invitee list when possible). */
export async function votePublicAction(eventId: string, voter: { name: string; phone: string }, optionIds: string[]): Promise<VoteResult> {
  const ids = optionIdsSchema.safeParse(optionIds);
  if (!ids.success) return { success: false, error: "Invalid choice." };
  const parsed = publicVoterSchema.safeParse(voter);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };

  const event = await getEventById(eventId);
  if (!event || !event.datePollOpen || !(await canViewEvent(eventId))) {
    return { success: false, error: "Voting on the date has closed." };
  }

  const ipHash = await currentIpHash();
  if (await isLockedOut("date-poll-vote", ipHash)) {
    return { success: false, error: "Too many votes from this connection — please try again later." };
  }

  const identity = await resolvePublicVoter(eventId, parsed.data.name, parsed.data.phone);
  if (!identity) return { success: false, error: "Please enter a valid phone number." };

  const result = await vote(event.id, event.timezone, identity, ids.data);
  if (result.success) await recordFailure("date-poll-vote", ipHash);
  return result;
}
