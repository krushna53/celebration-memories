import "server-only";

import { getCurrentAdmin } from "@/services/admin-auth";
import { supabaseServer } from "@/lib/supabase/server";
import { canUseTemplate, TEMPLATE_CATALOG, type TemplateSummary, type TemplateViewer } from "@/lib/template-catalog";
import { getEventCardTheme } from "@/services/event-extras";

/**
 * Server side of private templates (TemplateSummary.access): who the
 * current request is, for one event. Uses the real session only — never
 * an email or role the browser sends.
 */
export async function getTemplateViewer(eventId: string | null): Promise<TemplateViewer> {
  const admin = await getCurrentAdmin().catch(() => null);
  let email = admin?.email ?? null;
  if (!email) {
    try {
      const supabase = await supabaseServer();
      const { data } = await supabase.auth.getUser();
      email = data.user?.email ?? null;
    } catch {
      email = null;
    }
  }
  return { isPlatformOwner: admin?.role === "owner", email, eventId };
}

/**
 * Throws when `slug` is a private template this viewer may not apply.
 * Re-saving the template an event already uses is always allowed.
 */
export async function assertTemplateAllowed(eventId: string, slug: string, currentSlug: string | null): Promise<void> {
  if (slug === currentSlug) return;
  const template = TEMPLATE_CATALOG.find((t) => t.slug === slug);
  if (template?.requiresCardTheme && !(await getEventCardTheme(eventId))) {
    throw new Error("Upload your invitation card first to build a matching template.");
  }
  if (!template?.access) return;
  if (!canUseTemplate(template, await getTemplateViewer(eventId))) {
    throw new Error("That template isn't available for this event.");
  }
}

/**
 * The built-in templates this viewer can pick for this event: private
 * templates only for the people they're shared with, "Matched to your
 * card" only when the event has a card theme.
 */
export async function templatesForEvent(eventId: string, viewer?: TemplateViewer): Promise<TemplateSummary[]> {
  const [resolvedViewer, cardTheme] = await Promise.all([
    viewer ?? getTemplateViewer(eventId),
    getEventCardTheme(eventId),
  ]);
  return TEMPLATE_CATALOG.filter(
    (t) => canUseTemplate(t, resolvedViewer) && (!t.requiresCardTheme || cardTheme !== null),
  );
}
