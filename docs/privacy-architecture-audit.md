# Event privacy: implementation and rollout notes

Status: implementation and local automated validation completed on 2026-10-09; production rollout tracked in the final task response. The following architecture findings describe the pre-change baseline.

## Architecture verified

- Next.js 15 App Router, React, TypeScript, Supabase Auth/Postgres/Storage. Browser auth uses `@supabase/ssr`; application data services use a server-only service-role client.
- Live project: `ktbpnjrovzhjwardyime`. Read-only inspection found 14 active events, 10 without a client membership. No `events.owner_id` or `owner_user_id` exists. `getAdminByEventId` currently treats the earliest client membership as the host; all client members otherwise share the same role.
- `admins.role = owner` means PLATFORM administrator, not customer event owner. `adminForEvent`, `requireAdminForEvent`, `isAdminForEvent`, and `resolveAdminEvent` currently give this role cross-event management. This must not be reused as owner approval authority.
- Existing `events.visibility` (`public`/`private`) controls directory listing only. A private event is still accessible through its link. Publication uses separate `status` and `page_status` fields.
- Events, invitees, RSVPs, gallery photos, timeline milestones, photos, videos, audio, guestbook, session registrations, planner data, memberships, and admin notifications already exist. Reuse these rather than duplicate guest/media tables.
- Live public-schema tables have RLS enabled. No public or storage policies were returned: direct anon/authenticated queries are denied; trusted server services bypass RLS. Adding broad authenticated policies would weaken the current database boundary.
- Live PRIVATE buckets: `photos`, `videos`, `audio`, `gallery`. PUBLIC buckets: `hero`, `avatars`, `business`. Public bucket URLs cannot be described as private. Audit object-to-event ownership before any bucket migration.
- `lib/media-url.ts` signs locally; `/media/[bucket]/[...path]` checks the signature but does not re-check event/viewer authorization or publication. Links last 6–12 hours. Image responses are publicly cacheable, and video/audio redirects use cached Storage signed URLs. This does not meet immediate access revocation.
- `services/external-media.ts` creates 24-hour links for rendering; multiple AI/video Edge Functions issue 7-day links. Their job authorization and returned result URLs also need updating. Simply securing the main event page leaves these paths open.
- `/events/[slug]`, gallery, `/p/[kind]/[id]`, and share collection pages use revalidation. Metadata/JSON-LD currently loads event data before an access gate. Protected responses must be dynamic and private/no-store, including media and image optimization paths.
- Existing Google OAuth button and callback can be reused. Callback `next` validation rejects `//` but needs robust backslash/control-character validation and an approved redirect origin. Middleware currently refreshes sessions only for admin/login routes.
- `admin_notifications` provides an in-app notification mechanism. Google provider settings and OAuth redirect allowlist have NOT been verified in the dashboard.

## Ownership policy

The 10 active events without a customer host cannot produce verified customer approval. Do not silently assign them to the requesting platform admin. Implemented policy: leave customer-owner identity unassigned and deny support grants until an explicit owner is assigned. Alternative requiring product approval: explicitly designate those events as platform-owned, keeping that separate from customer events.

For events with client memberships, introduce an explicit event owner identity after verifying the existing host relationship. Do not automatically let every team member approve support access or transfer ownership. Record and constrain ownership changes so a platform administrator cannot change the owner to themselves to bypass approval.

## Planned implementation order

1. Add an explicit owner relationship and `viewing_access` (`public`, `signed_in`, `invited_only`). Preserve existing directory visibility independently. Backfill viewing access to public/link-access to preserve existing behavior, including unlisted links; retain publication checks. Do not list currently unlisted events.
2. Implement shared server/database authorization for event reads, published media reads, owner/member writes, and invitee contributions as separate permissions. Match confirmed Auth email against authoritative invitees; never authorize with editable user metadata. Preserve token-based contribution scopes for public events; tokens must not bypass stronger event-viewing restrictions.
3. Gate every event surface: main page, metadata, gallery, display, RSVP, invite, event-day/session tokens, memory uploads, public media cards, share collections, planner/games, reels, mobile API, exports, and Server Actions. Audit direct joined event reads as well as `getEventById` calls.
4. Replace bearer-only media access with exact object/event/publication checks on every request. Deny unpublished, deleted, cross-event, and unapproved content. Use private/no-store responses and disable shared image optimization for protected media. Support links should last at most 60 seconds and never beyond grant expiry; revoke/expire checks precede every issuance. Existing issued URLs remain usable until expiry.
5. Build support requests, grants, and append-only audit tables, RLS, and narrow authenticated RPCs. Use server/database actors and time, row locks, unique request/grant constraints, 15/30 minute bounds, and request throttling. Pending/rejected requests grant nothing. Owner decisions, notification insertion, grant activation, and audit events must be atomic. A requester cannot approve themselves.
6. Add admin request/status/read-only media screen and owner approval/rejection/revocation/history screen. Reuse in-app notifications with authenticated links, no media or secrets. A grant must not unlock the existing management dashboard or mutation functions. Stop rendering media at expiry, while backend checks remain authoritative.
7. Rework admin cross-event bypasses, including native mobile sessions, exports, AI jobs, and media URL conversion. Keep operational metadata available without thumbnails or private guest information. Re-check exact event membership for all mutations.
8. Add database and application integration tests for all allow/deny cases and concurrent decisions in the supplied specification. Verify expiry without cron, revocation, storage denial, notification scope, append-only audit, and cache isolation. Run advisors again after schema changes.

## Rollout and verification requirements

- Generate additive migrations with the Supabase CLI. There is no checked-in `supabase/config.toml`; initialize an isolated local test configuration or use a dedicated staging project before applying security migrations.
- Back up database ownership/membership mappings and affected storage metadata first. Do not delete media or globally privatize the shared hero/avatar/business buckets without an object inventory and compatible readers.
- Stage application changes and schema together, test legacy links, then remove old cached responses and account for existing 24-hour/7-day signed URLs. Do not promise immediate invalidation of already-issued Storage URLs.
- Rollback must preserve stronger privacy selections. A rollback to the previous public-link application would leak protected events; use maintenance/deny behavior for protected events rather than reopening them.
- Existing environment names: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MEDIA_URL_SECRET`, `NEXT_PUBLIC_SITE_URL`. No secret values were read or written into this report.
- Configure Google provider credentials in Supabase Auth and the Google console; allow the canonical app `/auth/callback` URL and explicit development/staging URLs. Test success, cancellation, session expiry, non-invitee denial, and malicious redirects before claiming setup is complete.
- Define and document audit retention before launch; no automated audit deletion is proposed in this initial audit.

## Checks actually performed

- Read repository services, migrations, routes, storage helpers, OAuth callback, middleware, and admin authorization helpers; searched service-role and Storage URL/signing usages.
- Read-only live SQL confirmed bucket visibility, RLS/policies, ownership-column absence, and active-event membership counts.
- Read Supabase changelog and current Storage/Google documentation.
- Read-only security advisors report intentional RLS-without-policy information plus existing warnings: public `http` extension, callable `sync_admin_primary_membership()` security-definer trigger function, and leaked-password protection disabled. These are findings, not fixes. Trigger functions cannot be treated as proven arbitrary RPC execution merely from the advisor warning; still revoke unnecessary EXECUTE permissions in a reviewed migration.
- Implementation now includes additive privacy/ownership fields, pinned public exceptions, request/approve/reject/revoke RPCs, append-only application audit, RLS, owner and platform UI, media authorization, route/service gates, OAuth redirect hardening, private responses and AI/mobile access checks.
- 39 application regression tests pass. The migration and support lifecycle SQL checks run in an isolated PostgreSQL 16 database with separate anon/authenticated/service roles. The tests cover pending access, ownerless denial, requester self-approval, unrelated owners/admins, duplicate decisions, direct grant/audit mutation denial, exact-event scope, revocation, expiry without cron, throttling and public pins.
- Credential SQL was tested in the same disposable database. Public storage inventory found only two platform testimonial assets in `hero` and no `avatars` objects; no event assets were moved or deleted.
- Full Google OAuth consent/cancellation and customer support UI tests still require real accounts in a browser. Existing 24-hour/7-day Storage URLs cannot be retroactively revoked by these changes. Newly issued interactive URLs last at most 60 seconds; explicitly authorized customer render inputs may last up to one hour. Downloaded/cached content cannot be recalled.
- Audit history is retained indefinitely until a retention policy is defined. Platform users cannot alter it through the application or authenticated database role. Service/database operators remain privileged infrastructure operators.
- External URLs and third-party embeds have their own access controls. Marking an event private gates this application's pages and managed private media; it cannot make an independently hosted external URL private.
- Cashfree keys can be stored via `/admin/billing/cashfree`; live checkout and subscription activation are not enabled by saving credentials. Merchant credentials and sandbox/payment-webhook validation remain required.

References:
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
