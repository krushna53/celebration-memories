"use server";

import type { EmailConfigInput, EmailConfigView } from "@/types/mailer-email-config";
import { getCurrentAdmin, type CurrentAdmin } from "@/services/admin-auth";
import { EmailDeliveryError } from "@/services/mailer-email-config/transport";
import {
  checkEmailConfigDomain,
  deleteEmailConfig,
  EmailConfigError,
  listEmailConfigs,
  saveEmailConfig,
  sendEmailConfigTestEmail,
  testEmailConfigConnection,
} from "@/services/mailer-email-config/store";

/**
 * Email Configuration actions. The company is always the signed-in
 * account itself (admins.id — the host account, like /admin/branding),
 * never an id the browser sends. Hosts (client role) and the platform
 * owner may manage it; organizers and session organizers work inside
 * someone else's event and can't.
 *
 * Errors come back as short messages written by us — never raw database
 * or SMTP output, and never anything containing a credential.
 */

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireCompanyAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new EmailConfigError("Please sign in again.");
  if (admin.role !== "client" && admin.role !== "owner") throw new EmailConfigError("Only the company's admin account can manage email settings.");
  return admin;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireId(id: unknown): string {
  if (typeof id !== "string" || !UUID.test(id)) throw new EmailConfigError("That email configuration doesn't exist.");
  return id;
}

function failure(err: unknown): { success: false; error: string } {
  if (err instanceof EmailConfigError || err instanceof EmailDeliveryError) return { success: false, error: err.message };
  console.error("[mailer-email-config] unexpected error", { name: err instanceof Error ? err.name : typeof err });
  return { success: false, error: "Something went wrong. Please try again." };
}

export async function listEmailConfigsAction(): Promise<Result<EmailConfigView[]>> {
  try {
    const admin = await requireCompanyAdmin();
    return { success: true, data: await listEmailConfigs(admin.id) };
  } catch (err) {
    return failure(err);
  }
}

export async function saveEmailConfigAction(input: EmailConfigInput, id?: string | null): Promise<Result<EmailConfigView>> {
  try {
    const admin = await requireCompanyAdmin();
    const configId = id ? requireId(id) : undefined;
    return { success: true, data: await saveEmailConfig(admin.id, admin.id, input, configId) };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteEmailConfigAction(id: string): Promise<Result<null>> {
  try {
    const admin = await requireCompanyAdmin();
    await deleteEmailConfig(admin.id, admin.id, requireId(id));
    return { success: true, data: null };
  } catch (err) {
    return failure(err);
  }
}

export async function testEmailConfigConnectionAction(id: string): Promise<Result<{ ok: boolean; message: string; config: EmailConfigView }>> {
  try {
    const admin = await requireCompanyAdmin();
    return { success: true, data: await testEmailConfigConnection(admin.id, admin.id, requireId(id)) };
  } catch (err) {
    return failure(err);
  }
}

export async function sendEmailConfigTestEmailAction(
  id: string,
  recipient: string,
): Promise<Result<{ ok: boolean; message: string; messageId: string | null; config: EmailConfigView }>> {
  try {
    const admin = await requireCompanyAdmin();
    if (typeof recipient !== "string") throw new EmailConfigError("Enter a valid email address to send the test email to.");
    return { success: true, data: await sendEmailConfigTestEmail(admin.id, admin.id, requireId(id), recipient) };
  } catch (err) {
    return failure(err);
  }
}

export async function checkEmailConfigDomainAction(id: string): Promise<Result<EmailConfigView>> {
  try {
    const admin = await requireCompanyAdmin();
    return { success: true, data: await checkEmailConfigDomain(admin.id, admin.id, requireId(id)) };
  } catch (err) {
    return failure(err);
  }
}
