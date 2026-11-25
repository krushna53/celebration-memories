"use server";

import { headers } from "next/headers";

import { SITE_URL } from "@/lib/constants";
import { isValidEmail, normalizeEmail } from "@/lib/mailer/email";
import { supabaseServer } from "@/lib/supabase/server";
import { verifyCaptcha } from "@/lib/turnstile";
import { homePathForRole, isSignupRole, validateNewPassword, type SignupRole } from "@/lib/signup-role";
import { ensureBusinessOwnerAccess } from "@/services/signup-role";

/**
 * Email sign-up for app/signup: email + password + confirm + CAPTCHA + Role.
 * The role is saved on the account (user_metadata.signup_role) and applied
 * when the confirmation link signs them in (app/auth/callback).
 */

type Result<T> = { success: true; data: T } | { success: false; error: string };

/** Where the confirmation link sends people back to: the real site in production, this dev server locally. */
async function publicOrigin(): Promise<string> {
  if (process.env.NODE_ENV === "production") return SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signUpWithEmailAction(input: {
  email: string;
  password: string;
  confirmPassword: string;
  role: SignupRole;
  captchaToken: string | null;
}): Promise<Result<{ needsConfirmation: boolean; next: string }>> {
  if (!isSignupRole(input.role)) return { success: false, error: "Choose your role." };
  const email = normalizeEmail(typeof input.email === "string" ? input.email : "");
  if (!isValidEmail(email)) return { success: false, error: "Enter a valid email address." };
  const password = typeof input.password === "string" ? input.password : "";
  const passwordError = validateNewPassword(password, typeof input.confirmPassword === "string" ? input.confirmPassword : "");
  if (passwordError) return { success: false, error: passwordError };

  const h = await headers();
  const ip = h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifyCaptcha(input.captchaToken, ip))) {
    return { success: false, error: "Please complete the \"I'm not a robot\" check and try again." };
  }

  const next = homePathForRole(input.role);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { signup_role: input.role },
      emailRedirectTo: `${await publicOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("already")) return { success: false, error: "An account with this email already exists — sign in instead." };
    if (lower.includes("rate")) return { success: false, error: "Too many sign-up attempts. Please wait a few minutes and try again." };
    return { success: false, error: "Couldn't create your account. Please try again." };
  }
  // With email confirmation on, Supabase hides "already registered" by returning a user with no identities.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { success: false, error: "An account with this email already exists — sign in instead." };
  }
  // Projects without email confirmation sign them in straight away: open the Mailer now.
  if (data.session && data.user && input.role === "business_owner") await ensureBusinessOwnerAccess(data.user);
  return { success: true, data: { needsConfirmation: !data.session, next } };
}
