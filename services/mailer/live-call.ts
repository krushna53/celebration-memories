import "server-only";
import { headers } from "next/headers";

import { SITE_URL } from "@/lib/constants";
import { MailerError } from "@/features/mailer/repository/types";
import type { MailerCallResult } from "@/features/mailer/repository/server-repository";
import { configuredBackendName } from "@/services/mailer-email-config/backend";
import { runAutomationsLive, runMailerMethod, sendCampaignLive } from "@/services/mailer/live-mailer";
import { createMailerLogoUpload } from "@/services/mailer/brand-logo";

/**
 * The one entry point both live-mode Server Actions share (the admin page's
 * features/mailer/actions.ts and the local preview's). The caller has
 * already worked out `tenantId` from the signed-in account; this only
 * routes the call and turns errors into safe messages.
 */

/** Where this app is reachable, for unsubscribe links: the real site in production, this dev server locally. */
export async function appOrigin(): Promise<string> {
  if (process.env.NODE_ENV === "production") return SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function handleMailerCall(tenantId: string, method: unknown, args: unknown): Promise<MailerCallResult> {
  try {
    if (configuredBackendName() !== "firestore") {
      throw new MailerError("Live mode stores Mailer data in Firebase — set MAILER_EMAIL_CONFIG_STORE=firestore and restart the server.");
    }
    if (typeof method !== "string" || !Array.isArray(args)) throw new MailerError("That request isn't valid.");
    if (method === "sendCampaign") {
      return { success: true, data: await sendCampaignLive(tenantId, args[0], args[1] ?? null, await appOrigin()) };
    }
    if (method === "requestLogoUpload") {
      return { success: true, data: await createMailerLogoUpload(tenantId, args[0]) };
    }
    if (method === "runAutomations") {
      return { success: true, data: await runAutomationsLive(tenantId, { date: args[0] ?? null, origin: await appOrigin() }) };
    }
    const data = await runMailerMethod(tenantId, method, args);
    return { success: true, data: data ?? null };
  } catch (err) {
    if (err instanceof MailerError) return { success: false, error: err.message };
    console.error("[mailer] live call failed", { method: typeof method === "string" ? method : "?", name: (err as Error)?.name });
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
