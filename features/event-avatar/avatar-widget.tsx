"use client";

import { useEffect, useRef, useState } from "react";
import { Gamepad2, Loader2, Send, Sparkles, X } from "lucide-react";

import { sendAvatarMessageAction } from "@/features/event-avatar/actions";
import type { AvatarChatMessage } from "@/lib/ai-avatar-chat";

interface AvatarGameLink {
  title: string;
  url: string;
}

interface AvatarWidgetProps {
  eventId: string;
  honoreeName: string;
  games: AvatarGameLink[];
}

/**
 * Guest-facing "AI Avatar" — a small floating host that (a) greets
 * visitors shortly after the page loads and (b) opens into a real chat
 * grounded in this event's own details, via sendAvatarMessageAction
 * (see lib/ai-avatar-chat.ts). Deliberately positioned bottom-LEFT so it
 * never overlaps SupportChatWidget (bottom-right, site-wide, for
 * contacting the platform builder — a different purpose entirely). Only
 * rendered at all when events.ai_avatar_enabled is true (see
 * avatar-widget-loader.tsx).
 */
export function AvatarWidget({ eventId, honoreeName, games }: AvatarWidgetProps) {
  const [open, setOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [messages, setMessages] = useState<AvatarChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const showTimer = setTimeout(() => setShowGreeting(true), 1400);
    const hideTimer = setTimeout(() => setShowGreeting(false), 9000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function openChat() {
    setOpen(true);
    setShowGreeting(false);
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: `Hi! I'm here to help with anything about ${honoreeName}'s celebration — the venue, timing, dress code, or anything else you're wondering about.`,
        },
      ]);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const nextMessages: AvatarChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError(null);

    const result = await sendAvatarMessageAction(eventId, messages, text);
    setBusy(false);
    if (result.success) {
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
    } else {
      setError(result.error);
    }
  }

  if (!open) {
    return (
      <div className="fixed bottom-5 left-5 z-40 flex flex-col items-start gap-2">
        {showGreeting ? (
          <button
            type="button"
            onClick={openChat}
            className="max-w-[15rem] rounded-2xl rounded-bl-sm border border-gold-500/25 bg-navy-950 px-4 py-3 text-left text-xs leading-relaxed text-ivory-100/90 shadow-lg transition-luxury duration-300 hover:border-gold-400/40"
          >
            Hi! Want to know more about {honoreeName}&rsquo;s celebration? Tap here to ask me anything.
          </button>
        ) : null}
        <button
          type="button"
          onClick={openChat}
          aria-label="Chat with the event host"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-500 text-navy-950 shadow-lg transition-luxury duration-300 hover:brightness-105"
        >
          <Sparkles size={22} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 left-5 z-40 flex w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-gold-500/20 bg-navy-950 shadow-2xl">
      <div className="flex items-center justify-between bg-navy-900 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500/20 text-gold-300">
            <Sparkles size={16} />
          </div>
          <div>
            <p className="font-display text-sm leading-tight text-ivory-50">{honoreeName}&rsquo;s Host</p>
            <p className="flex items-center gap-1 text-[11px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Here to help
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-ivory-100/60 hover:text-ivory-50">
          <X size={16} />
        </button>
      </div>

      <div ref={scrollRef} className="max-h-80 min-h-[10rem] flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-sm bg-gold-500 text-navy-950"
                  : "rounded-bl-sm bg-navy-900 text-ivory-100/90"
              }`}
            >
              {m.content}
            </p>
          </div>
        ))}
        {busy ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-navy-900 px-3.5 py-2.5 text-ivory-100/60">
              <Loader2 size={13} className="animate-spin" />
            </div>
          </div>
        ) : null}
      </div>

      {games.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-gold-500/10 px-4 pt-3">
          {games.map((g) => (
            <a
              key={g.url}
              href={g.url}
              className="flex items-center gap-1 rounded-full border border-gold-500/25 px-2.5 py-1 text-[11px] text-gold-300 hover:border-gold-400/50"
            >
              <Gamepad2 size={11} /> {g.title}
            </a>
          ))}
        </div>
      ) : null}

      <form onSubmit={handleSend} className="flex items-center gap-2 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          maxLength={500}
          className="flex-1 rounded-full border border-gold-500/20 bg-navy-900/60 px-3.5 py-2 text-sm text-ivory-50 placeholder:text-ivory-100/40 focus:border-gold-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500 text-navy-950 hover:brightness-110 disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </form>
      {error ? <p className="px-4 pb-3 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
