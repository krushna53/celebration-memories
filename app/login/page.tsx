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
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      {/* useSearchParams() (for ?verified=1) requires a Suspense boundary. */}
      <Suspense fallback={null}>
        <UnifiedLoginForm />
      </Suspense>
    </div>
  );
}
