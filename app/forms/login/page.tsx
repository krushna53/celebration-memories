import { Suspense } from "react";
import type { Metadata } from "next";

import { FormOwnerLoginForm } from "@/features/forms/login-form";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function FormOwnerLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      {/* useSearchParams() (for ?verified=1) requires a Suspense boundary — same pattern as app/admin/login/page.tsx. */}
      <Suspense fallback={null}>
        <FormOwnerLoginForm />
      </Suspense>
    </div>
  );
}
