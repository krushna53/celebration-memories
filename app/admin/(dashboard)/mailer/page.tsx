import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getMailerMode } from "@/lib/mailer/mode";
import { MailerApp } from "@/features/mailer/mailer-app";
import { mailerCallAction } from "@/features/mailer/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event Mailer — EveryMoment Admin" };

/**
 * Corporate Event Mailer. For the company's own admin account (client
 * role — the host account, like /admin/branding) and the platform owner.
 * The normal admin login and role check apply in every mode (mock mode
 * only changes where Mailer data is stored, see lib/mailer/mode.ts).
 */
export default async function AdminMailerPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  if (admin.role !== "client" && admin.role !== "owner") redirect("/admin");

  const mode = getMailerMode();
  return <MailerApp mode={mode} call={mode === "live" ? mailerCallAction : undefined} />;
}
