"use server";
import { requireOwner } from "@/services/admin-auth";
import { saveCashfreeSettings } from "@/services/cashfree-settings";
import { revalidatePath } from "next/cache";
export async function saveCashfreeAction(_previous: string, form: FormData): Promise<string> {
  try {
    const admin = await requireOwner();
    const appId = String(form.get("appId") || "").trim(), secret = String(form.get("secret") || "").trim(), environment = String(form.get("environment"));
    if (appId.length > 500 || secret.length > 2000 || !["sandbox", "production"].includes(environment)) throw new Error("Check the fields and environment.");
    await saveCashfreeSettings(appId, secret, environment as "sandbox" | "production", admin.id);
    revalidatePath("/admin/billing/cashfree");
    return "Credentials saved securely. Checkout activation still requires payment-flow testing.";
  } catch (e) { return e instanceof Error ? e.message : "Could not save credentials."; }
}
