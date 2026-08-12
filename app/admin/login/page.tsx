import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface AdminLoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * /admin/login, /business/login, and /forms/login now all forward to
 * the single shared sign-in page (app/login/page.tsx,
 * features/auth/unified-login-form.tsx) — kept as thin redirects
 * rather than deleted so every existing link/bookmark/`redirect()`
 * call across the app pointing at this exact path keeps working.
 * Query params (e.g. `?verified=1`) are forwarded as-is.
 */
export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const qs = params.toString();
  redirect(qs ? `/login?${qs}` : "/login");
}
