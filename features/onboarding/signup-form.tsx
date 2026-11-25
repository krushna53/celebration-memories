"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, MailCheck, UserPlus } from "lucide-react";

import { GoogleAuthButton } from "@/features/admin/auth/google-auth-button";
import { TurnstileWidget } from "@/features/onboarding/turnstile-widget";
import { signUpWithEmailAction } from "@/features/onboarding/actions";
import { homePathForRole, SIGNUP_ROLES, type SignupRole } from "@/lib/signup-role";
import { cn } from "@/lib/utils";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs uppercase tracking-[0.15em] text-ivory-100/60";

/**
 * Sign-up: Role first (Event Owner / Business Owner), then Google, or
 * email + password + confirm + CAPTCHA. A Business Owner lands on the
 * Event Mailer dashboard; an Event Owner on the event wizard
 * (lib/signup-role.ts).
 */
export function SignupForm({ captchaSiteKey }: { captchaSiteKey: string | null }) {
  const router = useRouter();
  const [role, setRole] = useState<SignupRole | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!role) return setError("Choose your role first.");
    if (password !== confirm) return setError("The two passwords don't match.");
    if (captchaSiteKey && !captchaToken) return setError("Please complete the \"I'm not a robot\" check.");
    setLoading(true);
    const result = await signUpWithEmailAction({ email, password, confirmPassword: confirm, role, captchaToken });
    setLoading(false);
    // A CAPTCHA token works once — get a fresh one for any retry.
    setCaptchaReset((n) => n + 1);
    if (!result.success) return setError(result.error);
    if (result.data.needsConfirmation) {
      setSentTo(email.trim());
      return;
    }
    router.replace(result.data.next);
    router.refresh();
  }

  if (sentTo) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
          <MailCheck size={22} />
        </div>
        <h1 className="mt-4 font-display text-2xl text-ivory-50">Check your email</h1>
        <p className="mt-3 text-sm text-ivory-100/70">
          We sent a confirmation link to <strong className="text-ivory-50">{sentTo}</strong>. Open it in this browser to finish creating your account
          {role === "business_owner" ? <> — it takes you straight to your Email Campaign dashboard</> : <> — it takes you to create your event</>}.
        </p>
        <p className="mt-4 text-xs text-ivory-100/50">No email after a few minutes? Check spam, or sign up again.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
        <UserPlus size={22} />
      </div>
      <h1 className="mt-4 font-display text-2xl text-ivory-50">Create your account</h1>
      <p className="mt-1 text-sm text-ivory-100/60">Events, greetings and email campaigns — in one place.</p>

      <fieldset className="mt-6 text-left">
        <legend className={labelClasses}>Role</legend>
        <div className="mt-1.5 grid gap-2" role="radiogroup">
          {SIGNUP_ROLES.map((r) => (
            <label
              key={r.role}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition",
                role === r.role ? "border-gold-500 bg-gold-500/10" : "border-ivory-100/15 hover:border-ivory-100/30",
              )}
            >
              <input
                type="radio"
                name="signup-role"
                value={r.role}
                checked={role === r.role}
                onChange={() => {
                  setRole(r.role);
                  setError(null);
                }}
                className="mt-1 h-4 w-4 accent-[var(--color-gold-500)]"
              />
              <span>
                <span className="block text-sm font-medium text-ivory-50">{r.label}</span>
                <span className="block text-xs text-ivory-100/55">{r.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        <GoogleAuthButton
          label="Sign up with Google"
          disabled={!role}
          redirectTo={
            role
              ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(homePathForRole(role))}&signup_role=${role}`
              : ""
          }
        />
        {!role ? <p className="mt-2 text-xs text-ivory-100/45">Choose your role to continue.</p> : null}
      </div>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-ivory-100/40">
        <span className="h-px flex-1 bg-ivory-100/15" /> or <span className="h-px flex-1 bg-ivory-100/15" />
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 text-left" noValidate>
        <div>
          <label htmlFor="su-email" className={labelClasses}>
            Email
          </label>
          <input id="su-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClasses} mt-1.5`} />
        </div>
        <div>
          <label htmlFor="su-password" className={labelClasses}>
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              id="su-password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClasses} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide passwords" : "Show passwords"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-navy-700/55 hover:text-navy-950"
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="mt-1 text-xs text-ivory-100/45">At least 8 characters, with a letter and a number.</p>
        </div>
        <div>
          <label htmlFor="su-confirm" className={labelClasses}>
            Confirm password
          </label>
          <input
            id="su-confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`${inputClasses} mt-1.5`}
          />
        </div>

        {captchaSiteKey ? <TurnstileWidget siteKey={captchaSiteKey} onToken={setCaptchaToken} resetKey={captchaReset} /> : null}

        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2.5 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ivory-100/60">
        Already have an account?{" "}
        <Link href="/login" className="text-gold-300 underline underline-offset-4 hover:text-gold-200">
          Sign in
        </Link>
      </p>
      <p className="mt-3 text-xs text-ivory-100/40">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
