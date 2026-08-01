import "server-only";
import OpenAI from "openai";

/**
 * Guest-facing "AI Avatar" chat host — a virtual stand-in for the event
 * host who can answer guest questions grounded only in that event's own
 * details (venue, time, dress code, etc.), and nudge guests toward
 * RSVP/Games/Memory Wall. Same client/model convention as
 * lib/ai-business-summary.ts and lib/ai-css.ts (OPENAI_API_KEY,
 * OPENAI_TEXT_MODEL) — deliberately reusing the existing provider
 * rather than adding a second AI vendor.
 *
 * Unlike the admin FaqChatbot (static, free, preset Q&A) and the guest
 * SupportChatWidget (a lead-capture form, no AI at all), this is a real
 * per-message API call — see services/ai-avatar-messages.ts for the
 * daily cap that bounds worst-case cost, and events.ai_avatar_enabled
 * for the opt-in toggle.
 */

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export const AI_AVATAR_CHAT_CONFIGURED = Boolean(process.env.OPENAI_API_KEY);

export class AiAvatarChatError extends Error {}

export interface AvatarEventContext {
  honoreeName: string;
  eventTitle: string;
  hostedBy: string;
  category: string;
  venueName: string | null;
  venueAddress: string | null;
  startAt: string;
  endAt: string;
  dressCode: string | null;
  parkingInfo: string | null;
  additionalNotes: string | null;
  wishMessage: string | null;
}

export interface AvatarGameLink {
  title: string;
  url: string;
}

export interface AvatarChatMessage {
  role: "user" | "assistant";
  content: string;
}

function formatDateTimeRange(startAt: string, endAt: string): string {
  try {
    const start = new Date(startAt);
    const end = new Date(endAt);
    const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
    return `${dateFmt.format(start)}, ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
  } catch {
    return `${startAt} – ${endAt}`;
  }
}

function buildSystemInstructions(event: AvatarEventContext, games: AvatarGameLink[]): string {
  const facts = [
    `Honoree: ${event.honoreeName}`,
    `Event: ${event.eventTitle} (${event.category})`,
    `Hosted by: ${event.hostedBy}`,
    `When: ${formatDateTimeRange(event.startAt, event.endAt)}`,
    event.venueName ? `Venue: ${event.venueName}` : null,
    event.venueAddress ? `Address: ${event.venueAddress}` : null,
    event.dressCode ? `Dress code: ${event.dressCode}` : null,
    event.parkingInfo ? `Parking: ${event.parkingInfo}` : null,
    event.additionalNotes ? `Other notes from the host: ${event.additionalNotes}` : null,
    event.wishMessage ? `A message from the host: "${event.wishMessage}"` : null,
    games.length > 0
      ? `Games available to play on this site: ${games.map((g) => `"${g.title}" (${g.url})`).join(", ")}`
      : null,
  ].filter(Boolean);

  return `You are a warm, friendly virtual host greeting guests on ${event.honoreeName}'s celebration website, on behalf of ${event.hostedBy}. You are NOT a general assistant — you only help with questions about this specific event.

Known facts about this event:
${facts.join("\n")}

Rules:
- Answer ONLY from the facts above. If asked something you don't have an answer for (e.g. specific gift ideas, unrelated topics, anything not listed), say you don't have that detail and suggest they contact the host directly.
- Keep replies short and warm — 1-3 sentences, no markdown, no headings, no bullet lists.
- If it fits naturally, you may mention RSVPing or playing one of the games listed above, but don't force it into every reply.
- Never invent facts (guest counts, other guests' names, gift registries, prices) that weren't given to you.
- Never discuss anything unrelated to this event — no general knowledge questions, no coding help, no other topics. Politely redirect back to the celebration.
- You cannot take real actions (you cannot RSVP for someone, send messages, or change any settings) — only talk.`;
}

export interface GenerateAvatarReplyParams {
  event: AvatarEventContext;
  games: AvatarGameLink[];
  history: AvatarChatMessage[];
  message: string;
}

export async function generateAvatarReply({ event, games, history, message }: GenerateAvatarReplyParams): Promise<string> {
  const client = getClient();
  if (!client) {
    throw new AiAvatarChatError("The AI Avatar isn't configured — add OPENAI_API_KEY to enable it.");
  }

  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";

  // Last 10 turns only — keeps token usage/cost bounded and this is a
  // light "chat with the event," not a long-running assistant session.
  const recentHistory = history.slice(-10);
  const transcript = recentHistory.map((m) => `${m.role === "user" ? "Guest" : "Host"}: ${m.content}`).join("\n");
  const input = transcript ? `${transcript}\nGuest: ${message}` : `Guest: ${message}`;

  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: buildSystemInstructions(event, games),
      input,
    });
  } catch (err) {
    throw new AiAvatarChatError(err instanceof Error ? err.message : "The AI Avatar couldn't reply right now.");
  }

  const text = response.output_text?.trim();
  if (!text) {
    throw new AiAvatarChatError("The AI Avatar couldn't reply right now — please try again.");
  }
  return text;
}
