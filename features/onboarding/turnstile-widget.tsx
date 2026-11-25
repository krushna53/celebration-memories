"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile ("I'm not a robot") for the sign-up form. The
 * token it hands back is checked on the server (lib/turnstile.ts) before
 * the account is created. Rendered only when the server has CAPTCHA keys.
 */

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id?: string): void;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("no turnstile"))));
    script.addEventListener("error", () => reject(new Error("turnstile failed to load")));
  });
}

export function TurnstileWidget({
  siteKey,
  onToken,
  resetKey,
  theme = "dark",
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  /** Change it to get a fresh challenge (tokens are single-use). */
  resetKey: number;
  theme?: "dark" | "light";
}) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const callback = useRef(onToken);
  callback.current = onToken;

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then((api) => {
        if (cancelled || !box.current) return;
        widgetId.current = api.render(box.current, {
          sitekey: siteKey,
          theme,
          callback: (token: string) => callback.current(token),
          "expired-callback": () => callback.current(null),
          "error-callback": () => callback.current(null),
        });
      })
      .catch(() => callback.current(null));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, theme]);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      callback.current(null);
    }
  }, [resetKey]);

  return <div ref={box} className="flex min-h-[65px] justify-center" />;
}
