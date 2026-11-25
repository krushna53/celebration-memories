"use server";

import { getCurrentAdmin } from "@/services/admin-auth";
import type { MailerCallResult } from "@/features/mailer/repository/server-repository";
import { handleMailerCall } from "@/services/mailer/live-call";

/**
 * Live-mode Event Mailer (NEXT_PUBLIC_MAILER_MODE=live). The company is
 * always the signed-in host account itself (admins.id — the same rule as
 * Email Configuration and /admin/branding), never an id from the browser.
 */
export async function mailerCallAction(method: string, args: unknown[]): Promise<MailerCallResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Please sign in again." };
  if (admin.role !== "client" && admin.role !== "owner") return { success: false, error: "Only the company's admin account can use the Mailer." };
  return handleMailerCall(admin.id, method, args);
}
