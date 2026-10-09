import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createFormOwnerAccount, getFormByDraftToken } from "@/services/custom-forms";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

import { safeAuthNext } from "@/lib/auth-redirect";

/** Only ever follow a same-site relative path — `next` arrives as a URL query param, so treat it as untrusted rather than passing it straight to redirect(). */

/**
 * The public origin to send the browser back to. On Netlify, `request.url`
 * carries the deploy's internal permalink host
 * (`<deploy-id>--ai-invitation-designer.netlify.app`), not the domain the
 * visitor actually used — so prefer the forwarded host, and never hand a
 * deploy permalink back to a real visitor (fall back to SITE_URL).
 */
function publicOrigin(_request: Request, url: URL): string {
  if (process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1"].includes(url.hostname)) return url.origin;
  return SITE_URL;
}

/**
 * OAuth callback for Supabase Auth's Google sign-in (Sign In With
 * Google button in features/admin/auth/google-auth-button.tsx). Google
 * redirects back to Supabase's own hosted callback first (which
 * exchanges the code with Google and creates/updates the auth.users
 * row), and Supabase then redirects here with a PKCE `code` for this
 * app to exchange for an actual session cookie.
 *
 * `link_event_id`, when present, links a brand-new OAuth signup to the
 * event they were creating an account for — either a wizard draft
 * (features/start/account-form.tsx) or an owner-issued registration
 * link (features/admin/register/register-form.tsx). The password-signup
 * equivalent of this happens inside the handle_new_confirmed_admin DB
 * trigger via `raw_user_meta_data->>'draft_event_id'`, but
 * signInWithOAuth can't set that metadata the way signUp's `options.data`
 * can — Google's own profile fields populate raw_user_meta_data instead.
 *
 * That trigger (migration 0052_admin_trigger_host_signups_only.sql)
 * now deliberately only fires when `draft_event_id` is present in
 * metadata — it used to fire for every confirmed signup on this
 * shared Supabase Auth project, including Marketplace vendor and Build
 * RSVP / Form signups that were never meant to be event hosts at all,
 * which left them with a stray `admins` row (role client, no event)
 * that the unified /login page's admin-first priority routing then
 * incorrectly sent to /admin, bouncing them to /start. Since Google
 * OAuth host signups can't supply `draft_event_id` either, they no
 * longer get an `admins` row from the trigger — this block creates it
 * directly instead, upserting rather than a plain UPDATE, but still
 * refusing to ever overwrite an *existing* event_id. Only an unclaimed
 * draft (status 'draft', no host yet) can be linked this way; an
 * existing host gets it added as one more event (admin_event_memberships).
 *
 * `business=1`, when present, means this OAuth round-trip came from the
 * Marketplace vendor sign-in/sign-up pages (features/business/
 * signup-form.tsx, login-form.tsx) rather than the event-host admin
 * flow. Vendors are a completely separate identity table
 * (business_accounts — see services/business-auth.ts's header comment)
 * with no DB trigger of their own the way handle_new_confirmed_admin
 * covers the admins table, and password signup normally creates that
 * row explicitly via completeBusinessSignupAction right after
 * auth.signUp() — a step Google's redirect-away flow can't run
 * client-side. So this does the equivalent provisioning here: if no
 * business_accounts row exists yet for this user id, create one from
 * Google's own profile fields (name, email). Phone is left null —
 * business_accounts.phone is nullable and editable later from the
 * vendor dashboard (updateBusinessAccountAction) — same reasoning
 * createBusinessAccount's doc comment gives for not gating a vendor's
 * ability to start building their listing on anything but the
 * account existing. Runs on every Google round-trip through this
 * flag, not just first-time signup, since sign-in and sign-up share
 * one button/one OAuth call — the "does a row already exist" check
 * makes repeat sign-ins a no-op.
 *
 * `form_token`, when present, means this came from the Build RSVP /
 * Form "Create an account to view responses" card
 * (features/forms/account-form.tsx). Same job as the password path's
 * createFormOwnerAccountAction: upsert the form_owners row and claim
 * that one form. The form is re-resolved from its draft_token here
 * (never a client-supplied id), and createFormOwnerAccount only claims
 * a form whose owner_id is still null, so a replayed or guessed token
 * can't take over someone else's form.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let failed = !code || !!url.searchParams.get("error");
  const next = safeAuthNext(url.searchParams.get("next"));
  const linkEventId = url.searchParams.get("link_event_id");
  const isBusinessFlow = url.searchParams.get("business") === "1";
  const formToken = url.searchParams.get("form_token");

  if (code) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    failed = !!error;

    if (!error && data.user && linkEventId) {
      const meta = data.user.user_metadata as { full_name?: string; name?: string } | null;
      // Only an unclaimed wizard draft can be linked from this URL parameter —
      // never a live event or one that already has a host, whatever id is passed.
      const [{ data: draft }, { count: hostCount }] = await Promise.all([
        supabaseAdmin().from("events").select("id").eq("id", linkEventId).eq("status", "draft").maybeSingle<{ id: string }>(),
        supabaseAdmin()
          .from("admin_event_memberships")
          .select("admin_id", { count: "exact", head: true })
          .eq("event_id", linkEventId),
      ]);
      const { data: existingAdmin, error: lookupError } = await supabaseAdmin()
        .from("admins")
        .select("id, role")
        .eq("id", data.user.id)
        .maybeSingle<{ id: string; role: string }>();

      if (!draft || (hostCount ?? 0) > 0) {
        console.error("auth callback: refused to link a non-draft or already-claimed event:", linkEventId);
      } else if (lookupError) {
        console.error("auth callback: failed to look up admin row before linking event:", lookupError.message);
      } else if (!existingAdmin) {
        const { error: insertError } = await supabaseAdmin().from("admins").insert({
          id: data.user.id,
          email: data.user.email ?? "",
          name: meta?.full_name ?? meta?.name ?? data.user.email ?? "Host",
          role: "client",
          event_id: linkEventId,
        });
        if (insertError) console.error("auth callback: failed to create admin row for Google host signup:", insertError.message);
      } else if (existingAdmin.role !== "owner") {
        // An existing host starting another event: add it to their account (they can run several).
        const { error: linkError } = await supabaseAdmin()
          .from("admin_event_memberships")
          .upsert({ admin_id: data.user.id, event_id: linkEventId, role: "client" }, { onConflict: "admin_id,event_id" });
        if (linkError) console.error("auth callback: failed to link event to admin:", linkError.message);
        await supabaseAdmin().from("admins").update({ event_id: linkEventId }).eq("id", data.user.id).is("event_id", null);
      }
    } else if (!error && data.user && isBusinessFlow) {
      const { data: existingAccount, error: lookupError } = await supabaseAdmin()
        .from("business_accounts")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle<{ id: string }>();

      if (lookupError) {
        console.error("auth callback: failed to check for existing business account:", lookupError.message);
      } else if (!existingAccount) {
        const meta = data.user.user_metadata as { full_name?: string; name?: string } | null;
        const { error: createError } = await supabaseAdmin().from("business_accounts").insert({
          id: data.user.id,
          email: data.user.email ?? "",
          name: meta?.full_name ?? meta?.name ?? data.user.email ?? "Vendor",
          phone: null,
        });
        if (createError) console.error("auth callback: failed to create business account for Google sign-in:", createError.message);
      }
    } else if (!error && data.user && formToken) {
      const form = await getFormByDraftToken(formToken);
      if (!form) {
        console.error("auth callback: form_token did not match any form");
      } else {
        const meta = data.user.user_metadata as { full_name?: string; name?: string } | null;
        const email = data.user.email ?? "";
        try {
          await createFormOwnerAccount(data.user.id, email, meta?.full_name ?? meta?.name ?? email, form.id);
        } catch (err) {
          console.error("auth callback: failed to create form owner for Google sign-in:", err instanceof Error ? err.message : err);
        }
      }
    } else if (error) {
      console.error("auth callback: exchangeCodeForSession failed:", error.message);
    }
  }

  const destination = new URL(next, publicOrigin(request, url));
  if (failed) destination.searchParams.set("auth_error", "1");
  return NextResponse.redirect(destination);
}
