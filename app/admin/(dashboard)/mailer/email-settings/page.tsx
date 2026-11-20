import { redirect } from "next/navigation";

import type { EmailConfigView } from "@/types/mailer-email-config";
import { getCurrentAdmin } from "@/services/admin-auth";
import { credentialEncryptionReady, EmailConfigError, listEmailConfigs } from "@/services/mailer-email-config/store";
import { EmailConfigManager } from "@/features/mailer/email-config/email-config-manager";
import { localSmtpAllowed } from "@/lib/mailer/email-config/local-smtp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email Configuration — EveryMoment Admin" };

/**
 * Company Email Configuration (Event Mailer → Settings). The company is
 * the signed-in host account; only that account (client role) or the
 * platform owner can open it — the same rule as /admin/branding.
 */
export default async function EmailSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  if (admin.role !== "client" && admin.role !== "owner") redirect("/admin");

  let configs: EmailConfigView[] = [];
  let setupProblem: string | null = null;
  try {
    configs = await listEmailConfigs(admin.id);
  } catch (err) {
    setupProblem = err instanceof EmailConfigError ? err.message : "Email Configuration couldn't be loaded. Please try again.";
  }

  return (
    <EmailConfigManager
      initialConfigs={configs}
      setupProblem={setupProblem}
      encryptionReady={credentialEncryptionReady()}
      adminEmail={admin.email}
      localSmtpAllowed={localSmtpAllowed()}
    />
  );
}
