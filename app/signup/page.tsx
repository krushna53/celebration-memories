import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { resolveLoginDestinationAction } from "@/features/auth/actions";
import { SignupForm } from "@/features/onboarding/signup-form";
import { captchaEnabled } from "@/lib/turnstile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create your account — EveryMoment", robots: { index: false, follow: true } };

/**
 * Sign up: Google, or email + password + confirm + CAPTCHA
 * (features/onboarding/signup-form.tsx). Already signed in → wherever
 * login would send them (including /welcome if they haven't picked a role).
 */
export default async function SignupPage() {
  const destination = await resolveLoginDestinationAction();
  if (destination.kind !== "none") redirect(destination.path);

  const siteKey = captchaEnabled() ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!.trim() : null;
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4 py-10">
      <SignupForm captchaSiteKey={siteKey} />
    </div>
  );
}
