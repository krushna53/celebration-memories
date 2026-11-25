import "server-only";

/**
 * Cloudflare Turnstile (free CAPTCHA) for the email sign-up form
 * (app/signup). Checked on the server before the account is created.
 *
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY  — shown to the browser (the widget)
 *   TURNSTILE_SECRET_KEY            — server only (this check)
 *
 * Unset = CAPTCHA off (the form says nothing about it), like every other
 * optional integration here. For local testing Cloudflare publishes
 * always-pass keys: site 1x00000000000000000000AA, secret
 * 1x0000000000000000000000000000000AA.
 *
 * This guards our own sign-up form only. Supabase Auth can enforce a
 * CAPTCHA on every sign-up/sign-in too (Auth → Bot protection), but that
 * applies to all of this project's forms at once, so it's left off.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function captchaEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim() && env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

/** True when the token is valid — or when CAPTCHA isn't configured at all. */
export async function verifyCaptcha(token: string | null | undefined, remoteIp: string | null): Promise<boolean> {
  if (!captchaEnabled()) return true;
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!.trim(), response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8_000) });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
