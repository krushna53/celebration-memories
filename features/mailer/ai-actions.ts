"use server";

import { getCurrentAdmin } from "@/services/admin-auth";
import { CAMPAIGN_KINDS, type CampaignKind } from "@/types/mailer";
import { normalizeHex } from "@/lib/mailer/brand";
import { AiEmailError, generateEmailFromPrompt, type GeneratedEmail } from "@/lib/mailer/ai-email";

export type GenerateEmailResult = { success: true; data: GeneratedEmail } | { success: false; error: string };

/**
 * "Generate with AI" in the Mailer's template and campaign editors (both
 * mock and live mode). Same access rule as the rest of the Mailer: the
 * signed-in owner/client admin. Brand colours come from the browser only as
 * styling hints and are re-validated; nothing here touches stored data.
 */
export async function generateEmailAction(input: {
  prompt: string;
  kind: CampaignKind;
  currentHtml?: string | null;
  brand?: { primaryColor: string; secondaryColor: string; hasLogo: boolean } | null;
}): Promise<GenerateEmailResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Please sign in again." };
  if (admin.role !== "client" && admin.role !== "owner") return { success: false, error: "Only the company's admin account can use the Mailer." };

  const prompt = typeof input?.prompt === "string" ? input.prompt : "";
  const kind = CAMPAIGN_KINDS.some((k) => k.kind === input?.kind) ? input.kind : "announcement";
  const primary = input?.brand ? normalizeHex(String(input.brand.primaryColor)) : null;
  const secondary = input?.brand ? normalizeHex(String(input.brand.secondaryColor)) : null;
  const brand = primary && secondary ? { primaryColor: primary, secondaryColor: secondary, hasLogo: Boolean(input.brand?.hasLogo) } : null;

  try {
    const data = await generateEmailFromPrompt({
      prompt,
      kind,
      currentHtml: typeof input?.currentHtml === "string" ? input.currentHtml : null,
      brand,
    });
    return { success: true, data };
  } catch (err) {
    if (err instanceof AiEmailError) return { success: false, error: err.message };
    console.error("[mailer] AI email generation failed", err);
    return { success: false, error: "Couldn't generate the email. Please try again." };
  }
}
