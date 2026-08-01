"use server";

import { getEventById } from "@/services/events";
import { listEventGames } from "@/services/games";
import { countTodayAvatarMessages, recordAvatarMessage } from "@/services/ai-avatar-messages";
import { generateAvatarReply, type AvatarChatMessage } from "@/lib/ai-avatar-chat";
import { generateAvatarSpeech } from "@/lib/ai-avatar-voice";

export type AvatarChatResult = { success: true; reply: string } | { success: false; error: string };

export type AvatarSpeechResult = { success: true; audioDataUrl: string } | { success: false; error: string };

/**
 * Public, no-auth action backing the guest-facing AI Avatar widget (see
 * features/event-avatar/avatar-widget.tsx). Re-checks everything
 * server-side from eventId alone — enabled flag, daily cap — rather
 * than trusting anything the client sends beyond the message itself, so
 * a guest can't bypass the toggle or the cost cap by calling this
 * directly.
 */
export async function sendAvatarMessageAction(
  eventId: string,
  history: AvatarChatMessage[],
  message: string,
): Promise<AvatarChatResult> {
  try {
    const trimmed = message.trim();
    if (!trimmed) return { success: false, error: "Type a message first." };
    if (trimmed.length > 500) return { success: false, error: "That message is a bit long — please shorten it." };

    const event = await getEventById(eventId);
    if (!event) return { success: false, error: "This event isn't available anymore." };
    if (!event.aiAvatarEnabled) return { success: false, error: "The AI Avatar isn't turned on for this event." };

    const usedToday = await countTodayAvatarMessages(eventId);
    if (usedToday >= event.aiAvatarDailyMessageLimit) {
      return {
        success: false,
        error: "The AI Avatar has reached its message limit for today — please try again tomorrow, or contact the host directly.",
      };
    }

    const allGames = await listEventGames(eventId).catch(() => []);
    const activeGames = allGames
      .filter((g) => g.isActive)
      .map((g) => ({ title: g.title, url: `/games/${g.shareToken}` }));

    const reply = await generateAvatarReply({
      event: {
        honoreeName: event.honoreeName,
        eventTitle: event.eventTitle,
        hostedBy: event.hostedBy,
        category: event.category,
        venueName: event.venueName,
        venueAddress: event.venueAddress,
        startAt: event.startAt,
        endAt: event.endAt,
        dressCode: event.dressCode,
        parkingInfo: event.parkingInfo,
        additionalNotes: event.additionalNotes,
        wishMessage: event.wishMessage,
      },
      games: activeGames,
      history: history.slice(-10),
      message: trimmed,
    });

    await recordAvatarMessage(eventId);
    return { success: true, reply };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Something went wrong — please try again." };
  }
}

/**
 * Synthesizes spoken audio for one already-generated avatar reply (see
 * avatar-widget.tsx, which calls this right after a successful
 * sendAvatarMessageAction). Deliberately a separate action rather than
 * bundled into sendAvatarMessageAction — a guest can mute voice replies
 * without that changing anything about the text path or its cap
 * accounting. Still re-checks aiAvatarEnabled server-side so this
 * endpoint can't be driven standalone once a host turns the feature off.
 * Returns a data: URL (base64) rather than writing to Storage — replies
 * are short and ephemeral, so there's nothing worth persisting.
 */
export async function synthesizeAvatarSpeechAction(eventId: string, text: string): Promise<AvatarSpeechResult> {
  try {
    const trimmed = text.trim();
    if (!trimmed) return { success: false, error: "Nothing to speak." };

    const event = await getEventById(eventId);
    if (!event || !event.aiAvatarEnabled) {
      return { success: false, error: "Voice replies aren't available for this event." };
    }

    const { buffer, contentType } = await generateAvatarSpeech(trimmed);
    const audioDataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
    return { success: true, audioDataUrl };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't generate voice audio." };
  }
}
