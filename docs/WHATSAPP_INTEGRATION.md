# WhatsApp Cloud API integration

EveryMoment sends event notifications (invitations, RSVP confirmations,
reminders, thank-you and photo-sharing messages) from **one platform
WhatsApp number** using Meta's official **WhatsApp Business Cloud API**,
called directly from the Next.js server — no Twilio or other provider, no
extra server.

The old tap-to-send `wa.me` links on **Invitees** (`lib/whatsapp.ts`) are
untouched and keep working without any of this.

> **Database note.** The original brief described Firebase/Firestore. This
> project has no Firebase. It runs on **Supabase (Postgres)**, so everything
> here uses the existing `supabaseAdmin()` service-role client and Supabase
> migrations, the same way every other feature does.

---

## 1. Architecture

```
Guest RSVP form ──► features/rsvp/*actions.ts ──► services/whatsapp.ts ─┐
Host: /admin/event-whatsapp ──► features/admin/whatsapp/actions.ts ─────┤
Owner: /admin/whatsapp ─────────► features/admin/whatsapp/actions.ts ───┤
pg_cron (every 15 min) ──► POST /api/cron/whatsapp ─────────────────────┤
                                                                        ▼
                         whatsapp_messages (outbox + log, unique idempotency_key)
                                                                        │
                                       lib/whatsapp-cloud/client.ts ──► graph.facebook.com/{v}/{phone-number-id}/messages
                                                                        │
Meta ──► POST /api/whatsapp/webhook ──► signature check ──► whatsapp_webhook_events (dedupe) ──► status / opt-out updates
```

| File | Role |
| --- | --- |
| `lib/whatsapp-cloud/types.ts` | Category registry (template name, variables, Meta category, scope), shared types |
| `lib/whatsapp-cloud/config.ts` | Server-only env reading and validation (`server-only`) |
| `lib/whatsapp-cloud/client.ts` | Graph API fetch with a 10 s timeout, error classification, retry backoff |
| `lib/whatsapp-cloud/payloads.ts` | Template, text, image and document bodies; template parameter validation |
| `lib/whatsapp-cloud/phone.ts` | Normalises numbers to international digits; masks them for display |
| `lib/whatsapp-cloud/policy.ts` | Consent rules, 24-hour window, status ordering, reminder timing, STOP/START |
| `lib/whatsapp-cloud/webhook-verification.ts` | GET handshake and `X-Hub-Signature-256` HMAC check (timing-safe) |
| `lib/whatsapp-cloud/webhook-handler.ts` | Parses Meta's webhook body into flat events |
| `lib/whatsapp-cloud/event-messages.ts` | Template values for an event and guest (event timezone, guest's own link) |
| `services/whatsapp.ts` | The only code that sends: settings, consent, outbox, automations, webhook application, stats |
| `app/api/whatsapp/webhook/route.ts` | `GET` verification, `POST` events |
| `app/api/cron/whatsapp/route.ts` | Queues due automations, drains the outbox, purges old data (`CRON_SECRET`) |
| `app/admin/(dashboard)/whatsapp` | Owner page: status, master switch, templates, test send, platform stats |
| `app/admin/(dashboard)/event-whatsapp` | Host page for one event: toggles, consent, invitations, that event's log |

### The send pipeline (`sendWhatsAppMessage`)

Every message, whatever triggers it, passes these checks in order:

1. `WHATSAPP_ENABLED=true`, credentials present, and the owner switch on.
2. **Test mode** (the default): only numbers in the owner's verified test
   recipient list receive anything. Everyone else is skipped and not logged.
3. The phone number normalises to 8–15 digits.
4. **Consent** (`consentDecision`): a global STOP blocks everything. Event
   categories need `whatsapp_consents.opted_in` for that guest. Marketing
   categories also need `marketing_opted_in`. Test sends skip consent
   because they only go to test recipients.
5. Free-form text (non-template) only within 24 hours of the person's last
   message to us.
6. One row per `idempotency_key`, inserted with `ON CONFLICT DO NOTHING`, so
   a repeat call is a no-op. The keys are `invitation:<invitee>`,
   `rsvp_confirmation:<invitee>:<answer>`, and `<category>:<invitee>` for
   scheduled messages.

The row is then delivered right away or left queued. Delivery first
*claims* the row (`queued → sending`), so two workers can't send it twice.
Results:

- Accepted by Meta: status `accepted`, plus the Meta message id (`wamid`).
- Retryable error (throttling, 5xx, timeouts, Meta codes 130429, 131056,
  131000…): back to `queued` with exponential backoff (about 1, 2, 4, 8
  minutes), up to 5 attempts.
- Permanent error (bad token 190, template missing or mismatched 132001 or
  132000, undeliverable 131026, outside the window 131047…): `failed` at once.
- A row stuck in `sending` for over 10 minutes (a crash mid-send) is
  marked failed, not retried. Meta has no idempotency key, so a retry could
  double-send.

Webhook statuses then move it forward: `sent → delivered → read`. They
only move forward, because Meta can deliver them out of order. A status
that arrives before we've stored the `wamid` is replayed from
`whatsapp_webhook_events` once we have it.

### Database (`supabase/migrations/20261124120000_whatsapp_cloud_api.sql`)

| Table | Contents |
| --- | --- |
| `whatsapp_settings` | Singleton: owner switch, template name and language per category, test recipients. **No secrets.** |
| `event_whatsapp_settings` | Per event: on/off, RSVP confirmation, 24h/2h reminders, thank-you, feedback, photo reminder |
| `whatsapp_consents` | Per guest: phone, `opted_in`, `consent_at`, `consent_source`, `opted_out_at`, plus separate `marketing_opted_in` / `marketing_consent_at` |
| `whatsapp_contacts` | Per phone (shared platform number): `opted_out_at` (STOP), `last_inbound_at` (24h window) |
| `whatsapp_messages` | Outbox and log: `wamid`, recipient, event, guest, type, template, category, status, attempts, each status timestamp, Meta error code and title |
| `whatsapp_webhook_events` | Raw notifications with a unique `dedupe_key` |
| `whatsapp_audit_log` | Admin actions: settings changes, host-recorded consent, bulk and test sends |
| `whatsapp_status_counts()` | RPC for the stats cards (service role only) |

RLS is on with no policies, the same as every other table. Access is only
through server code. The migration also schedules the `whatsapp-dispatch`
pg_cron job (fill in `<SITE_URL>` and `<CRON_SECRET>` first).

### Access control

- **Owner** (`/admin/whatsapp`): platform settings, test sends, and stats
  aggregated across all events (counts only). The message list shows only
  test sends and events the platform account owns (`ownedEventIds`). Guest
  data on customer events stays behind the customer's login, matching the
  existing privacy rules.
- **Event hosts** (`/admin/event-whatsapp`, owner on own events and
  client role): only their event. Every read is filtered by that event's
  id, and every action calls `requireAdminForEvent(eventId)`.
- **Guests** never see any message history.
- No endpoint can send arbitrary text to arbitrary numbers. Test sends go
  only to the stored test recipients, at most 10 per hour. Invitation
  sends are limited to one batch a minute per event, and only reach
  consented guests of that event.

### Consent

- RSVP forms (`/invite/[token]` and public `/events/[slug]/rsvp`) show
  "Send me updates about this event on WhatsApp", but **only when the
  event has WhatsApp turned on**. Ticking it records `consent_source =
  rsvp_form` / `public_rsvp_form`. Unticking it later withdraws consent.
  The quick and name-only RSVP flows don't collect a phone number, so they
  don't offer it.
- Hosts can record consent for guests who agreed directly ("they asked to
  be invited on WhatsApp"). This needs a confirmation tick and is stored
  as `host_attested`, with an audit log entry.
- A reply of STOP, UNSUBSCRIBE, OPT OUT or CANCEL opts that number out
  everywhere (`whatsapp_contacts.opted_out_at`) and marks every consent for
  that phone opted out. START clears the global opt-out, but per-event
  consent must be given again.
- Marketing consent is a separate column and is never set by these flows.
  Only categories marked `marketing: true` (today only the future
  corporate festival greeting) require it.

### Retention

The cron deletes `whatsapp_webhook_events` older than 90 days (they include
inbound message text). It replaces `whatsapp_messages.payload` (the
message body) with `{ "redacted": true }` after 180 days. Status and
timestamps are kept for statistics.

---

## 2. Meta Developer App configuration

1. Go to <https://developers.facebook.com/apps> → **Create app** → type
   **Business**. Link it to your Meta Business portfolio (Krushna Web Works
   / EveryMoment).
2. **Add product → WhatsApp → Set up.** Meta creates a test WhatsApp
   Business Account (WABA) with a test sender number.
3. **App settings → Basic**: copy the **App Secret** → `WHATSAPP_APP_SECRET`.
4. **WhatsApp → API Setup**: copy the **Phone number ID** →
   `WHATSAPP_PHONE_NUMBER_ID` and the **WhatsApp Business Account ID** →
   `WHATSAPP_BUSINESS_ACCOUNT_ID`. While you're on the test number, add up
   to 5 recipient numbers here and verify each with the code Meta sends.
5. **Permanent access token** (the token on the API Setup page expires in 24h):
   Business Settings → **Users → System users** → Add (Admin) → **Assign
   assets**: the app (full control) and the WABA (full control) → **Generate
   token** with the `whatsapp_business_messaging` and
   `whatsapp_business_management` permissions, expiry "Never" →
   `WHATSAPP_ACCESS_TOKEN`.

## 3. WhatsApp Business Account configuration

1. **Business verification** (Business Settings → Security Center). Needed
   to raise messaging limits beyond the starter tier and to get a display
   name approved.
2. **Add a real number** (WhatsApp Manager → Phone numbers → Add). Use a
   number that isn't registered on the WhatsApp or WhatsApp Business app,
   or delete that account first. Set the display name ("EveryMoment") and
   wait for approval.
3. Register the number for Cloud API (two-step PIN) when prompted. Then
   update `WHATSAPP_PHONE_NUMBER_ID` to the new number's id.
4. Add a payment method in WhatsApp Manager → Settings → Payment methods.

## 4. Environment variables

Set these in **Netlify → Site configuration → Environment variables**
(scope: Functions/Runtime). Locally, use the uncommitted `.env.local` (it's
git-ignored). Never prefix them with `NEXT_PUBLIC_`.

| Variable | Value |
| --- | --- |
| `WHATSAPP_ENABLED` | `false` until you're ready, then `true` |
| `WHATSAPP_TEST_MODE` | `true` (only test recipients receive). Set `false` to go live |
| `WHATSAPP_GRAPH_API_VERSION` | `v26.0` (current as of 2026-11; code falls back to it if unset) |
| `WHATSAPP_PHONE_NUMBER_ID` | From API Setup (digits; not the phone number itself) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | From API Setup |
| `WHATSAPP_ACCESS_TOKEN` | System User permanent token. Mark it **secret** in Netlify |
| `WHATSAPP_APP_SECRET` | App → Basic → App Secret. Mark it **secret** |
| `WHATSAPP_VERIFY_TOKEN` | Any long random string you invent (e.g. `openssl rand -hex 24`) |
| `WHATSAPP_DEFAULT_COUNTRY_CODE` | `91` |
| `CRON_SECRET` | Already used by the admin-notifications cron; reused here |

`/admin/whatsapp` lists any missing or invalid variable by name and never
shows values.

## 5. Webhook callback URL

```
https://everymoment.in/api/whatsapp/webhook
```

## 6. Webhook verification token configuration

Meta App → **WhatsApp → Configuration → Webhook → Edit**:

- Callback URL: the URL above
- Verify token: exactly the value of `WHATSAPP_VERIFY_TOKEN`

Click **Verify and save**. Meta calls `GET …?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`.
The route echoes the challenge (200) only if the token matches, and returns
403 otherwise. **Deploy with the env vars set before clicking Verify.**

Manual check:

```bash
curl -i "https://everymoment.in/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=$WHATSAPP_VERIFY_TOKEN&hub.challenge=12345"
```

You should get `200` with body `12345`. A wrong token gives `403`.

## 7. Meta webhook subscriptions

Same page → **Webhook fields → `messages` → Subscribe.** That one field
carries inbound messages and every `sent`, `delivered`, `read` and `failed`
status. Make sure the app is subscribed to the WABA:

```bash
curl -X POST "https://graph.facebook.com/v26.0/$WHATSAPP_BUSINESS_ACCOUNT_ID/subscribed_apps" -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
```

Every POST is checked against `X-Hub-Signature-256` (HMAC-SHA256 of the raw
body with the App Secret). Anything unsigned or wrongly signed gets 401.

## 8. Template creation and approval

Business-initiated messages (everything EveryMoment sends first) must use
an **approved template**. Create them in **WhatsApp Manager → Message
templates → Create**, language English. The variables must be in this
exact order (the same table is on `/admin/whatsapp`):

| Notification | Default name | Meta category | Body variables |
| --- | --- | --- | --- |
| Invitation | `em_event_invitation` | Marketing\* | 1 guest name, 2 host, 3 event name, 4 date & time, 5 venue, 6 invite link |
| RSVP confirmation | `em_rsvp_confirmation` | Utility | 1 guest, 2 event, 3 attendance, 4 date & time, 5 venue, 6 link |
| Reminders (24h and 2h) | `em_event_reminder` | Utility | 1 guest, 2 event, 3 date & time, 4 venue, 5 link |
| Thank you + photos | `em_event_thank_you` | Utility | 1 guest, 2 event, 3 host, 4 upload link |
| Photo/video reminder | `em_memory_reminder` | Utility | 1 guest, 2 event, 3 upload link |
| Feedback request | `em_event_feedback` | Utility | 1 guest, 2 event, 3 link |
| Test | `hello_world` (pre-approved) | Utility | none |

The suggested body text for each is `sampleBody` in
`lib/whatsapp-cloud/types.ts`. Meta's rules: a variable can't start or end
the body, there must be enough plain text between variables, and you must
provide sample values when submitting. \*Meta decides the final category.
An unsolicited invitation is likely to be classed as Marketing.

If you name a template differently, or it's approved in another language
(`en_US`, `hi`…), map it on `/admin/whatsapp → Approved templates`. **Do
not switch an event on until its templates show "Active – Quality pending"
or better.** Until then sends fail with 132001, visible in the log.

## 9. Testing

**Automated** (mocked Meta, never sends):

```bash
node --test tests/whatsapp-cloud.cjs
```

These cover the webhook GET handshake (valid, wrong token, missing
parameters), signatures (valid, tampered, wrong secret), parsing (inbound,
sent/delivered/read/failed, duplicates, malformed), the Graph client (valid
send, invalid token, template errors, timeout, rate limits, backoff),
payloads and template parameter validation, phone normalisation,
idempotency keys, invitation/RSVP/reminder/photo-reminder values, reminder
windows, consent including marketing, opt-out and STOP keywords, and the
24-hour window.

**Manual, on Meta's test number:**

1. Set the env vars with `WHATSAPP_ENABLED=true` and `WHATSAPP_TEST_MODE=true`, then deploy.
2. `/admin/whatsapp` → **Check connection**. It should show the number's name and quality.
3. Add your verified number as a test recipient → Save → switch the owner toggle on → Save.
4. **Send a test** (leave the text blank to use `hello_world`) → tick confirm → Send. The log should go Accepted → Sent → Delivered → Read within seconds. If it stays at Accepted, the webhook isn't reaching you (see step 7 above).
5. Reply "hi" from your phone. Then a free-text test works for 24 hours.
6. On your own event: `/admin/event-whatsapp` → turn on → RSVP from your own invite link with the checkbox ticked → you get the RSVP confirmation.
7. Reply STOP → the guest shows "Opted out", and further sends are blocked.

## 10. Production deployment

1. Apply the migration: `supabase/migrations/20261124120000_whatsapp_cloud_api.sql`. Replace `<SITE_URL>` and `<CRON_SECRET>` in its last block first.
2. Set the Netlify env vars and keep `WHATSAPP_TEST_MODE=true`.
3. Deploy (push to `main`). The route handlers run on Netlify's Next.js runtime (`@netlify/plugin-nextjs`), so no config change is needed.
4. Verify the webhook (section 6) and subscribe to `messages` (section 7).
5. Run the manual test (section 9).
6. Once templates are approved and the real number is live, set `WHATSAPP_TEST_MODE=false` and redeploy. Events still need their own switch, and guests need consent.

## 11. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Meta "Verify and save" fails | Env var not deployed yet, the token differs (watch for whitespace), or the URL isn't https |
| Webhook POSTs get 401 | `WHATSAPP_APP_SECRET` is wrong (it's the App Secret, not the access token) |
| Stuck at "Accepted", never "Sent" | Not subscribed to `messages`, or the app isn't in the WABA's `subscribed_apps` |
| 190 | Access token expired or invalid. Use a System User token |
| 131030 | Recipient isn't on the test number's allowed list |
| 132001 / 132000 | Template not approved, wrong name or language, or wrong variable count |
| 131047 | Free text outside the 24h window. Use a template |
| 131026 | Number isn't on WhatsApp, or the user blocked or opted out |
| 130429 / 131056 | Throughput or pair rate limit. Retried automatically |
| 131063 / 131050 | Marketing messages disabled for the WABA, or the user stopped marketing messages |
| "blocked: Test mode" | `WHATSAPP_TEST_MODE` is on and the number isn't a test recipient |
| "No WhatsApp consent on record" | The guest didn't tick the box and no host consent was recorded |
| Reminders never go out | Cron not scheduled (`select * from cron.job where jobname = 'whatsapp-dispatch'`), `CRON_SECRET` mismatch, or event settings off |

`/admin/whatsapp` shows the last API error, the last webhook received, and
the last successful send.

## 12. Message pricing considerations

Meta charges per delivered template message by **category** and the
recipient's country. Rates change, so check Meta's current rate card
(developers.facebook.com → WhatsApp → Pricing) before going live. Rough
2026 India figures: **utility ≈ ₹0.115**, **marketing ≈ ₹0.86** per
message, plus 18% GST.

- An invitation is probably Marketing, so it's the most expensive message. Reminders and confirmations are Utility.
- Free-form replies inside the 24-hour window are free. Meta's rules on utility templates inside the window have changed more than once, so check the current terms.
- A 200-guest event with invitation, confirmation, 24h reminder and thank-you costs about 200 × (0.86 + 3 × 0.115) ≈ ₹241 + GST.
- Per-event toggles keep the optional extras (2h reminder, feedback, photo reminder) off by default.

## 13. Adding a new notification type

1. Add an entry to `WHATSAPP_CATEGORIES` in `lib/whatsapp-cloud/types.ts`: label, scope, default template, ordered `params`, `metaCategory`, `marketing`, `sampleBody`.
2. If it's an event message, make sure `eventTemplateValues` (or your own values) supplies every param.
3. Trigger it through `sendWhatsAppNotification` (event guests) or `sendWhatsAppMessage` (anything else), with an idempotency key that's unique per intended message.
4. If it's scheduled, add a window to `dueAutomations` and an audience to `automationAudience` in `policy.ts`, a toggle column to `event_whatsapp_settings`, and tests in `tests/whatsapp-cloud.cjs`.
5. Create the template in WhatsApp Manager and wait for approval.

**Corporate (Phase 7):** `corporate_*` categories are already in the
registry with `scope: "corporate"`, and `consentDecision` enforces the
separate marketing consent for `corporate_festival`. What's still missing
is a company and employee model (there's no company table today). Build it
as its own workflow — a `companies` table, employees with their own consent
rows, a separate service — that calls the same `sendWhatsAppMessage`. Keep
it apart from guest and event flows.

---

## Deployment checklist

- [ ] Meta Business portfolio verified
- [ ] Meta app created (Business type) with the WhatsApp product added
- [ ] System User permanent token generated (`whatsapp_business_messaging`, `whatsapp_business_management`)
- [ ] Production number added, display name approved, payment method set
- [ ] Templates submitted and **approved** (invitation, RSVP confirmation, reminder, thank-you, plus any optional ones)
- [ ] Template names and languages mapped on `/admin/whatsapp` if they differ from the defaults
- [ ] Migration `20261124120000_whatsapp_cloud_api.sql` applied (cron placeholders filled in)
- [ ] Netlify env vars set: `WHATSAPP_*`, `CRON_SECRET`; token and secret marked secret
- [ ] Deployed and Netlify build green
- [ ] `curl` verification returns the challenge; Meta "Verify and save" succeeds
- [ ] Subscribed to the `messages` webhook field; app in the WABA's `subscribed_apps`
- [ ] Check connection OK on `/admin/whatsapp`
- [ ] Test message reaches Read in the log
- [ ] STOP reply opts the test number out
- [ ] `whatsapp-dispatch` cron job present and returning 200
- [ ] `WHATSAPP_TEST_MODE=false` set and redeployed (go-live)
