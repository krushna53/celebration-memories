import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSupabaseUser, resolveLoginDestinationAction } from "@/features/auth/actions";
import { Suspense } from "react";
import type { Metadata } from "next";

import { UnifiedLoginForm } from "@/features/auth/unified-login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: true } };

/**
 * The one sign-in page for admin, business, and forms accounts — see
 * features/auth/unified-login-form.tsx's doc comment. /admin/login,
 * /business/login, and /forms/login all redirect here now.
 */
export default async function LoginPage() {
  const destination = await resolveLoginDestinationAction();
  if (destination.kind !== "none") redirect(destination.path);
  const user = await getCurrentSupabaseUser();
  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
        <div className="max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center text-ivory-100">
          <h1 className="font-display text-2xl">You’re signed in</h1>
          <p className="mt-3 text-sm">{user.email}</p>
          <p className="mt-3 text-sm">Your account doesn’t have a dashboard yet.</p>
          <Link href="/" className="mt-6 inline-block text-gold-300 underline">Explore EveryMoment</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      {/* useSearchParams() (for ?verified=1) requires a Suspense boundary. */}
      <Suspense fallback={null}>
        <UnifiedLoginForm />
      </Suspense>
    </div>
  );
}
