import type { Metadata } from "next";

import { BusinessLoginForm } from "@/features/business/login-form";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function BusinessLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <BusinessLoginForm />
    </div>
  );
}
