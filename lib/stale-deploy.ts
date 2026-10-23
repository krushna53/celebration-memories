/**
 * A Server Action call from a page loaded before the latest deploy fails
 * with "Failed to find Server Action" — the only fix is reloading, so say
 * that instead of a cryptic error (or, worse, silently stalling).
 */
export function staleDeployMessage(err: unknown): string | null {
  const text = err instanceof Error ? err.message : String(err);
  return /server action/i.test(text)
    ? "EveryMoment was updated while this page was open. Please reload the page and try again."
    : null;
}
