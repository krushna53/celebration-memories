"use server";
import { revalidatePath } from "next/cache";
import { SITE_URL } from "@/lib/constants";
import { supabaseServer } from "@/lib/supabase/server";

export async function privacyAction(form: FormData): Promise<{ error?: string; success?: string }> {
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const action = String(form.get("action") ?? "");
  let result;
  switch (action) {
    case "public-link": {
      let slug: string;
      try {
        const url = new URL(String(form.get("link")), SITE_URL);
        if (url.origin !== new URL(SITE_URL).origin || url.search || url.hash) throw new Error();
        const match = url.pathname.match(/^\/events\/([a-z0-9-]+)\/?$/);
        if (!match) throw new Error();
        slug = match[1]!;
      } catch { return { error: "Enter an EveryMoment event page link." }; }
      result = await client.rpc("pin_public_event", { event_slug: slug, keep_public: form.get("keep") === "true" });
      break;
    }
    case "request": result = await client.rpc("request_support_access", { eid: String(form.get("event")), support_reason: String(form.get("reason")), minutes: Number(form.get("minutes")) }); break;
    case "approve": case "reject": result = await client.rpc("decide_support_access", { rid: String(form.get("request")), approve: action === "approve" }); break;
    case "revoke": result = await client.rpc("revoke_support_access", { gid: String(form.get("grant")) }); break;
    case "privacy": result = await client.rpc("set_event_viewing_access", { eid: String(form.get("event")), mode: String(form.get("mode")) }); break;
    default: return { error: "Unknown action." };
  }
  if (result.error) return { error: result.error.message };
  revalidatePath("/admin/privacy");
  revalidatePath("/admin/public-event-links");
  revalidatePath("/admin/support-access");
  revalidatePath("/events", "layout");
  return { success: "Saved." };
}
