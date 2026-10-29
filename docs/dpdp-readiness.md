# DPDP readiness — 29 October 2026

These changes are a local readiness implementation, not a compliance certification or a production rollout.

## Implemented

- Optional Google Analytics requires a separate affirmative browser choice. Decline and withdrawal are equally available. Withdrawal disables tracking, clears accessible GA cookies and reloads. Cross-tab choices reload other tabs. Storage failures default to no new analytics.
- Removed root Microsoft Clarity recording injection. Session recording remains disabled.
- Expanded the privacy notice to cover accounts, RSVP, uploads, publication audiences, processors, international processing, optional face matching/AI, manual rights and grievances, children and current retention limitations.
- Added direct privacy/grievance contact using the existing operator contact. No message is sent until the visitor chooses to send it.
- Optional quick-RSVP details now require an unchecked consent box; server validation no longer fabricates consent for this form.
- Account creation links to the privacy notice separately from optional analytics.

## Additional enforcement fixes — 29 October 2026

- Public phone matching now rejects an existing record rather than returning it or overwriting its identity and RSVP. Existing guests must use a personal invitation or verified sign-in. This also affects game entry paths that reuse the same helper; existing guests cannot use a typed phone to assume someone else's identity. A new public guest can still register. No historical records are merged or deleted.
- Public quick RSVP and invitation one-tap RSVP require a separate unchecked consent box before submission. Quick RSVP actions reject absent, false or non-boolean consent on the server. Google sign-in no longer automatically submits an RSVP on return; guests explicitly consent and choose their reply again.
- RSVP and guestbook services enforce consent before database access, in addition to form/action validation.
- Signed-in guest matching requires a confirmed email and only uses a phone if Auth records it as confirmed. User-editable profile names are display data only.
- Five targeted regression tests cover unverified phone overwrite prevention, new guest registration, service-level consent denial, quick-action consent denial and verified session identity. Versioned RSVP/guestbook evidence is implemented in the next section; other collection paths remain outstanding.

## Consent receipts and privacy request workflow — 30 October 2026

Implemented locally; migration and application must be released together.

- `/privacy/requests` accepts access, correction, erasure, withdrawal, nomination and grievance requests without an account. It collects only a contact email, event/account label and request details and returns an on-screen UUID reference. No automatic email is sent and the reference does not authorise data access. A honeypot, bounded server validation and an atomic five-per-IP-hash/day database limit guard submission. Missing rate-limit identity or database errors fail closed with the existing privacy contact as fallback. Production ingress must supply a trusted client IP header; the existing helper prefers Netlify's header.
- `/admin/privacy-requests` is platform-owner only at page, service and review-action boundaries. It paginates requests and shows review history. Clients and event team members cannot inspect the platform queue. No public request lookup exists.
- Review transitions are `received → verifying → in_progress → completed`, with rejection from any open state. A row lock and expected-status check reject stale updates. In-progress and completed transitions require an identity/authority verification note; every transition requires a review/fulfilment note. History retains the actor, verification record, note and database timestamp. This records manual review, not automatic identity verification or fulfilment.
- RSVP (public, token, quick and optional details) and token guestbook forms render versioned purpose text. Their services record the version and database triggers append a receipt in the same transaction as the submission. Receipts contain source/subject IDs, purpose, notice version and database timestamp; no contact details, answers or invitation tokens are copied. Moderation without renewed consent does not create a receipt. Legacy records are not backfilled or relabelled.
- Old form versions fail validation; guests must refresh. Frozen purpose notices live in `consent_notices`; the matching full English notice source is archived in `docs/privacy-notices/2026-10-30.1.tsx.txt`. Increment the version and preserve both old purpose and full notices when changing purposes. Receipt coverage does not extend to imports, uploads, custom forms, analytics or optional face matching yet.
- New tables have RLS enabled and no anonymous/authenticated grants. Application service roles can read receipts/notices but cannot insert, update or delete them directly. The pinned-search-path consent trigger writes receipts; its direct EXECUTE privileges are revoked. Database operators remain privileged.

### Rollout and verification

1. Back up, apply `supabase/migrations/20261029212512_dpdp_consent_and_requests.sql` to staging, then release the application. The CLI generated this filename using host time; the work is documented with client date 30 October. The new application depends on these columns, tables and RPCs: do not deploy it before the migration. No live migration has been applied.
2. Run `DPDP_PGLITE_PATH=/absolute/path/to/@electric-sql/pglite node --test tests/dpdp-database.cjs tests/dpdp-consent.cjs tests/dpdp-requests.cjs tests/privacy-page.cjs`. The isolated Postgres fixture checks denied public reads/RPCs, atomic receipt rollback, legacy handling, renewal, immutable application receipts/notices, request rate limit, reviewer role, verification gating, stale decisions and history. Application tests check schema bounds, role denial, reference-only responses, and consent/identity enforcement.
3. On staging, submit each request kind, save the reference, log in as a platform owner, verify pagination/review history and test concurrent reviewers. Exercise public/token/quick RSVP and guestbook in a real browser. Confirm the submission and its matching receipt exist; test a stale form. Browser and production validation remain pending.
4. Assign staff to monitor the queue. Contact requesters manually, verify identity/authority proportionately, perform the requested changes across affected systems and processors, communicate the result and record the work. No automated deletion, email acknowledgement, reminder, processor notification or requester status portal is implemented. A withdrawal request still needs manual processing.
5. Approve retention and access-review policies for requests, history and consent evidence. They currently have no scheduled purge. Receipt IDs can remain linkable after a source submission is erased; assess necessity and legal holds before retention/deletion implementation. Do not collect identity-document copies in verification notes.
6. Changed-file lint and 13 targeted tests pass locally. Full TypeScript checking still reports the three pre-existing display-music errors; no new errors were reported in this feature. Obtain deployed security-advisor and browser checks before production rollout.

## Release blockers / owner actions

1. Confirm operator legal identity and designate the responsible privacy contact. Publish and operate a grievance response period no longer than 90 days when the applicable Rules commence. Current general support is not proof of an operational grievance process.
2. Inventory every collection path: public/token RSVP, one-tap replies, guestbook, uploads, testimonials, contact, wizard leads, custom forms, mobile, imported guest lists, notifications, games and AI. Map a lawful purpose and notice to each. One-tap replies still use affirmative submission and existing timestamp records; a timestamp alone is not proof of the exact notice shown. Add versioned server-side consent evidence and purpose-specific withdrawal before claiming complete consent coverage.
3. Establish verified parental/guardian consent before processing children's data. A checkbox or the notice's warning is insufficient. Enforce server-side restrictions on every affected collection route; current child-related features require further remediation. Do not describe this release as child-data compliant.
4. Implement and test identity-verified rights fulfilment across database rows, object storage, processors, rendered outputs, backups and exports. Existing account deletion must be audited against these requirements. Do not automatically delete based on an unverified contact request. Maintain a request register and acknowledgements; exercise nominee/guardian requests.
5. Approve a purpose-specific retention schedule and implement scheduled deletion with legal holds and evidence. Current event retention is open-ended. Evaluate Rule 8(3) and the Seventh Schedule, security-log requirements and tax/payment obligations with counsel; do not apply a universal deletion interval to all records.
6. Maintain a live processor/subprocessor inventory, regions, contracts and safeguards. Review AI/rendering providers and foreign transfer restrictions. Validate actual provider account configuration rather than assuming Indian-only hosting.
7. Exercise a breach runbook: detection, containment, affected-person notice without delay, Board initial notification without delay and detailed report within 72 hours (subject to applicable commencement and extensions). Assign an incident lead and processor reporting obligations. Test restoration and access monitoring.
8. Offer the notice/consent in English or an Eighth Schedule language of the person's choice as required by the Act; manual assistance text is not a completed multilingual notice implementation.
9. Verify deployed auth, RLS, private media access, revoked sessions, export authorisation and security monitoring. Prior privacy audit is historical evidence, not a fresh production audit. Review analytics withdrawal and cookies in a real browser, including third-party provider retention.
10. Deploy application changes, test on staging, train hosts/support and arrange legal review. No live schema, provider settings or production deployment was changed by this task.

## Primary legal sources checked

- Final Rules (G.S.R. 846(E)): https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf
- Act commencement (G.S.R. 843(E)): https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf
- MeitY Rules library, including corrigendum: https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025

The notifications provide phased commencement: institutional provisions first, consent-manager provisions after one year and most operational obligations after eighteen months from publication. Do not claim all duties are already in force on 29 October 2026. Recheck official amendments/commencement before rollout.
