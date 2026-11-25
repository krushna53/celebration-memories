import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { MailerApp } from "@/features/mailer/mailer-app";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event Mailer (demo)", robots: { index: false, follow: false } };

/**
 * Event Mailer demo, no login needed — for reviewing the Mailer on Netlify
 * deploy previews. Always mock mode: demo data lives only in the visitor's
 * own browser (LocalStorage) and sending is simulated, so nothing here can
 * read real Mailer data or send real email.
 *
 * Opens only under `npm run dev` and on *.netlify.app hosts (deploy
 * previews, branch deploys); the production domain gets a 404. The real
 * Mailer stays at /admin/mailer behind the admin login.
 */
function demoAllowed(host: string): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const name = host.toLowerCase().split(":")[0] ?? "";
  return name.endsWith(".netlify.app");
}

export default async function MailerDemoPage() {
  const host = (await headers()).get("host") ?? "";
  if (!demoAllowed(host)) notFound();

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-6">
      <p className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <strong>Event Mailer demo</strong> — demo data saved only in this browser; sending is simulated, no real email
        goes out. The real Mailer is at /admin/mailer (admin login).
      </p>
      <MailerApp mode="mock" />
    </div>
  );
}
