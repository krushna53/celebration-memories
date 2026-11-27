import "server-only";

import type { GraphConfig } from "./client";

/**
 * Server-side env for the Cloud API. Nothing here is NEXT_PUBLIC_ — the
 * access token and app secret never reach a browser bundle (the
 * `server-only` import makes that a build error).
 *
 *   WHATSAPP_ENABLED              "true" to allow any send at all (default off)
 *   WHATSAPP_TEST_MODE            anything but "false" = only the owner's
 *                                 test recipients can receive (default on)
 *   WHATSAPP_GRAPH_API_VERSION    e.g. v26.0
 *   WHATSAPP_PHONE_NUMBER_ID      the sending number's id (not the number)
 *   WHATSAPP_BUSINESS_ACCOUNT_ID  the WABA id
 *   WHATSAPP_ACCESS_TOKEN         System User permanent token
 *   WHATSAPP_APP_SECRET           Meta app secret (webhook signatures)
 *   WHATSAPP_VERIFY_TOKEN         any random string, also entered in Meta
 *   WHATSAPP_DEFAULT_COUNTRY_CODE for numbers typed without one (91)
 */

/** Used when WHATSAPP_GRAPH_API_VERSION is unset — current at time of writing (Graph API v26.0, released 2026-07-29). */
export const FALLBACK_GRAPH_API_VERSION = "v26.0";

export interface WhatsAppEnvStatus {
  enabled: boolean;
  testMode: boolean;
  apiVersion: string;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
  defaultCountryCode: string;
  /** Names of missing/invalid variables — never their values. */
  problems: string[];
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function whatsappEnvStatus(): WhatsAppEnvStatus {
  const problems: string[] = [];
  const versionRaw = env("WHATSAPP_GRAPH_API_VERSION");
  const apiVersion = versionRaw ? (versionRaw.startsWith("v") ? versionRaw : `v${versionRaw}`) : FALLBACK_GRAPH_API_VERSION;
  if (!/^v\d{2,3}\.\d$/.test(apiVersion)) problems.push("WHATSAPP_GRAPH_API_VERSION (expected e.g. v26.0)");

  const phoneNumberId = env("WHATSAPP_PHONE_NUMBER_ID") ?? null;
  if (!phoneNumberId) problems.push("WHATSAPP_PHONE_NUMBER_ID");
  else if (!/^\d{6,20}$/.test(phoneNumberId)) problems.push("WHATSAPP_PHONE_NUMBER_ID (digits only — the id, not the phone number)");

  const businessAccountId = env("WHATSAPP_BUSINESS_ACCOUNT_ID") ?? null;
  if (!businessAccountId) problems.push("WHATSAPP_BUSINESS_ACCOUNT_ID");

  const hasAccessToken = Boolean(env("WHATSAPP_ACCESS_TOKEN"));
  if (!hasAccessToken) problems.push("WHATSAPP_ACCESS_TOKEN");
  const hasAppSecret = Boolean(env("WHATSAPP_APP_SECRET"));
  if (!hasAppSecret) problems.push("WHATSAPP_APP_SECRET");
  const hasVerifyToken = Boolean(env("WHATSAPP_VERIFY_TOKEN"));
  if (!hasVerifyToken) problems.push("WHATSAPP_VERIFY_TOKEN");

  const defaultCountryCode = (env("WHATSAPP_DEFAULT_COUNTRY_CODE") ?? "91").replace(/\D/g, "") || "91";

  return {
    enabled: env("WHATSAPP_ENABLED") === "true",
    testMode: env("WHATSAPP_TEST_MODE") !== "false",
    apiVersion,
    phoneNumberId,
    businessAccountId,
    hasAccessToken,
    hasAppSecret,
    hasVerifyToken,
    defaultCountryCode,
    problems,
  };
}

/** Credentials for a Graph call, or null when sending isn't configured. */
export function graphConfig(): GraphConfig | null {
  const status = whatsappEnvStatus();
  const accessToken = env("WHATSAPP_ACCESS_TOKEN");
  if (!status.phoneNumberId || !accessToken || status.problems.some((p) => p.startsWith("WHATSAPP_PHONE_NUMBER_ID") || p.startsWith("WHATSAPP_GRAPH"))) {
    return null;
  }
  return { apiVersion: status.apiVersion, phoneNumberId: status.phoneNumberId, accessToken };
}

export function webhookSecrets(): { appSecret: string | undefined; verifyToken: string | undefined } {
  return { appSecret: env("WHATSAPP_APP_SECRET"), verifyToken: env("WHATSAPP_VERIFY_TOKEN") };
}
