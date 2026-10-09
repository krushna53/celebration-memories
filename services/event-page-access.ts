import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { eventPermissions } from "@/services/event-access";
import { safeAuthNext } from "@/lib/auth-redirect";

export async function protectEventPage(eventId: string, fallbackPath: string) {
  const permissions = await eventPermissions(eventId);
  if (!permissions.event) notFound();
  if (permissions.view) return;
  if (permissions.event.status !== "active" || permissions.event.page_status !== "published") notFound();
  const next = safeAuthNext((await headers()).get("x-event-request-path"), fallbackPath);
  const failed = new URL(next, "https://local").searchParams.has("auth_error");
  redirect(`/event-access?${failed ? "error=1&" : ""}event=${encodeURIComponent(eventId)}&next=${encodeURIComponent(next)}`);
}

export async function protectTokenPage(table: string, column: string, token: string, path: string) {
  const { data, error } = await supabaseAdmin().from(table).select(table === "events" ? "id" : "event_id").eq(column, token).maybeSingle();
  if (error || !data) notFound();
  const row = data as unknown as { id?: string; event_id?: string };
  await protectEventPage((row.event_id ?? row.id)!, path);
}
