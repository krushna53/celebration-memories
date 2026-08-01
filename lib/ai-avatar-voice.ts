import "server-only";
import OpenAI from "openai";

/**
 * Text-to-speech for the guest-facing AI Avatar (see lib/ai-avatar-chat.ts
 * for the text side of the same feature). Same client/config convention
 * as the other lib/ai-*.ts modules — OPENAI_API_KEY, with a dedicated
 * OPENAI_TTS_MODEL/OPENAI_TTS_VOICE override pair rather than reusing
 * OPENAI_TEXT_MODEL, since chat completion and speech synthesis are
 * different model families entirely.
 *
 * Cost note: this is a second, separate paid call on top of the text
 * reply (lib/ai-avatar-chat.ts's generateAvatarReply) — roughly
 * proportional to reply length. It only ever runs for a reply that
 * already passed the daily message cap (services/ai-avatar-messages.ts),
 * so it doesn't open a new spam/cost surface, but it does mean each
 * "message" now costs noticeably more than text alone — worth knowing
 * before setting event.ai_avatar_daily_message_limit tighter or looser.
 */

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export const AI_AVATAR_VOICE_CONFIGURED = Boolean(process.env.OPENAI_API_KEY);

export class AiAvatarVoiceError extends Error {}

export interface GeneratedAvatarSpeech {
  buffer: Buffer;
  contentType: string;
}

const MAX_SPEECH_INPUT_LENGTH = 900;

/** Synthesizes short spoken audio for one avatar chat reply. Truncates very long replies rather than failing — a voice reply that trails off is better than none at all. */
export async function generateAvatarSpeech(text: string): Promise<GeneratedAvatarSpeech> {
  const client = getClient();
  if (!client) {
    throw new AiAvatarVoiceError("Voice replies aren't configured — add OPENAI_API_KEY to enable them.");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new AiAvatarVoiceError("Nothing to speak.");
  }

  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  const voice = (process.env.OPENAI_TTS_VOICE || "alloy") as
    | "alloy"
    | "echo"
    | "fable"
    | "onyx"
    | "nova"
    | "shimmer";

  let response;
  try {
    response = await client.audio.speech.create({
      model,
      voice,
      input: trimmed.slice(0, MAX_SPEECH_INPUT_LENGTH),
      response_format: "mp3",
    });
  } catch (err) {
    throw new AiAvatarVoiceError(err instanceof Error ? err.message : "Couldn't generate voice audio.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType: "audio/mpeg" };
}
