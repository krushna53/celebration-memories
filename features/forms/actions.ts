"use server";

import { headers } from "next/headers";

import { getFormById, listFields, submitFormResponse } from "@/services/custom-forms";
import { checkCustomFormSubmissionRateLimit, recordCustomFormSubmissionRequest } from "@/services/custom-form-rate-limit";
import { getClientIp, hashIp } from "@/lib/ip-hash";
import { sendCustomFormSubmissionNotification } from "@/lib/email";
import { SITE_URL } from "@/lib/constants";

export type SubmitFormResult = { success: true } | { success: false; error: string };

/**
 * Public, no-login submission — anyone with the form's public link
 * (/f/[slug]) can call this. formId itself isn't a secret (the fill
 * page already resolved it from the public slug before rendering); the
 * real gate is submitFormResponse's own `status === 'published'` check,
 * so a form that's still a draft or has been closed can't collect
 * responses just because someone has its id.
 *
 * Two spam guards, same shape as every other public/no-login form in
 * this app:
 * - `honeypot` is a hidden field real respondents never see or fill in
 *   (features/forms/public-form-fill.tsx) — a bot that fills every
 *   field trips it, and this quietly reports success without writing
 *   anything, same pattern as submitPublicRsvpAction.
 * - A per-form, per-IP rate limit (services/custom-form-rate-limit.ts)
 *   catches scripted spam that ignores the honeypot. `headers()` works
 *   here (unlike a plain fetch client) because Server Actions run as a
 *   real request on the server, same as a Route Handler.
 */
export async function submitCustomFormResponseAction(
  formId: string,
  data: Record<string, string | string[]>,
  honeypot?: string,
): Promise<SubmitFormResult> {
  if (honeypot) {
    return { success: true };
  }

  try {
    const ipHash = hashIp(getClientIp(await headers()));

    const rateLimit = await checkCustomFormSubmissionRateLimit(formId, ipHash);
    if (!rateLimit.allowed) {
      return { success: false, error: rateLimit.reason ?? "Please try again later." };
    }

    await submitFormResponse(formId, data);
    await recordCustomFormSubmissionRequest(formId, ipHash);

    // Best-effort notification — never let an email failure block a
    // response that's already saved.
    void (async () => {
      try {
        const form = await getFormById(formId);
        if (!form || !form.notifyOnSubmit || !form.notifyEmail) return;

        const fields = await listFields(formId);
        const preview = fields
          .filter((f) => data[f.id] !== undefined)
          .map((f) => {
            const value = data[f.id];
            return { label: f.label, value: Array.isArray(value) ? value.join(", ") : value || "" };
          });

        await sendCustomFormSubmissionNotification({
          to: form.notifyEmail,
          formTitle: form.title,
          responsePreview: preview,
          dashboardUrl: `${SITE_URL}/forms/dashboard`,
        });
      } catch (err) {
        console.error("sendCustomFormSubmissionNotification failed:", err);
      }
    })();

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to submit — please try again." };
  }
}
