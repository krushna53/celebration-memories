"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import type { MailerData } from "@/types/mailer";
import type { MailerMode } from "@/lib/mailer/mode";
import { createMailerRepository, MailerError, type MailerCall, type MailerRepository } from "@/features/mailer/repository";

/**
 * Gives Mailer components the current data snapshot and a `run` helper
 * for writes. Components never see the repository's storage — only this
 * context — so swapping LocalStorage for Supabase only touches
 * features/mailer/repository/.
 */

interface MailerContextValue {
  mode: MailerMode;
  data: MailerData | null;
  loadError: string | null;
  /**
   * Runs a repository write, then reloads the snapshot. Resolves with the
   * write's result, or `{ error }` with a message to show for MailerErrors.
   */
  run: <T>(fn: (repo: MailerRepository) => Promise<T>) => Promise<{ ok: true; value: T } | { ok: false; error: string }>;
}

const MailerContext = createContext<MailerContextValue | null>(null);

export function MailerProvider({ mode, call, children }: { mode: MailerMode; call?: MailerCall; children: React.ReactNode }) {
  // Created in an effect, not during render: the LocalStorage repository needs `window`.
  const [repo, setRepo] = useState<MailerRepository | null>(null);
  const [data, setData] = useState<MailerData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const r = createMailerRepository(mode, call);
    setRepo(r);
    r.load().then(setData, (err: unknown) => setLoadError(err instanceof Error ? err.message : "Couldn't load the Mailer."));
  }, [mode, call]);

  const run = useCallback<MailerContextValue["run"]>(
    async (fn) => {
      if (!repo) return { ok: false, error: "Still loading — try again in a moment." };
      try {
        const value = await fn(repo);
        setData(await repo.load());
        return { ok: true, value };
      } catch (err) {
        if (err instanceof MailerError) return { ok: false, error: err.message };
        console.error("Mailer action failed:", err);
        return { ok: false, error: "Something went wrong. Please try again." };
      }
    },
    [repo],
  );

  return <MailerContext.Provider value={{ mode, data, loadError, run }}>{children}</MailerContext.Provider>;
}

export function useMailer(): MailerContextValue & { data: MailerData } {
  const ctx = useContext(MailerContext);
  if (!ctx) throw new Error("useMailer must be used inside <MailerProvider>.");
  if (!ctx.data) throw new Error("useMailer called before the Mailer data loaded.");
  return ctx as MailerContextValue & { data: MailerData };
}

export function useMailerStatus() {
  const ctx = useContext(MailerContext);
  if (!ctx) throw new Error("useMailerStatus must be used inside <MailerProvider>.");
  return ctx;
}
