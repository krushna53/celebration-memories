import { redirect } from "next/navigation";
import { EventSignIn } from "@/features/privacy/event-sign-in";
import { safeAuthNext } from "@/lib/auth-redirect";
import { eventPermissions } from "@/services/event-access";
export const dynamic = "force-dynamic";
export const metadata = { title: "Event access | EveryMoment", robots: { index: false, follow: false } };
export default async function EventAccessPage({ searchParams }: { searchParams: Promise<{ event?: string; next?: string; error?: string }> }) {
  const params = await searchParams;
  if (!params.event) redirect("/");
  const permissions = await eventPermissions(params.event);
  const rawNext = safeAuthNext(params.next, "/");
  const cleanNext = new URL(rawNext, "https://local");
  cleanNext.searchParams.delete("auth_error");
  const next = cleanNext.pathname + cleanNext.search;
  if (permissions.view && !params.error) redirect(next === "/event-access" ? "/" : next);
  return <main className="flex min-h-screen items-center justify-center bg-navy-950 p-6 text-white"><div className="w-full max-w-md space-y-6"><h1 className="font-display text-3xl">This event requires access</h1>{params.error && <p role="alert">Sign-in was cancelled or could not be completed. Please try again.</p>}<EventSignIn next={next} signedIn={!!permissions.userId} /></div></main>;
}
