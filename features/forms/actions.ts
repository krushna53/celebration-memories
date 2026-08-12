"use server";

import { getFormById, listFields, submitFormResponse } from "@/services/custom-forms";
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
 */
export async function submitCustomFormResponseAction(
  formId: string,
  data: Record<string, string | string[]>,
): Promise<SubmitFormResult> {
  try {
    await submitFormResponse(formId, data);

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
