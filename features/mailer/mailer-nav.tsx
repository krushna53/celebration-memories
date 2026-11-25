"use client";

import { createContext, useContext } from "react";

import type { CampaignKind } from "@/types/mailer";

/** Which Mailer screen is showing. Kept in React state by MailerApp — not in the URL. */
export type MailerView =
  | { name: "dashboard" }
  | { name: "campaigns" }
  | { name: "analytics" }
  | { name: "contacts" }
  | { name: "lists" }
  | { name: "templates" }
  | { name: "automations" }
  | { name: "brand" }
  | { name: "campaign"; id: string }
  | { name: "editor"; id?: string; kind?: CampaignKind };

export const MailerNavContext = createContext<((view: MailerView) => void) | null>(null);

export function useMailerNav(): (view: MailerView) => void {
  const nav = useContext(MailerNavContext);
  if (!nav) throw new Error("useMailerNav must be used inside MailerApp.");
  return nav;
}
