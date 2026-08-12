import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface FormOwnerLoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** See app/admin/login/page.tsx's doc comment — same shared-login redirect shim. */
export default async function FormOwnerLoginPage({ searchParams }: FormOwnerLoginPageProps) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const qs = params.toString();
  redirect(qs ? `/login?${qs}` : "/login");
}
