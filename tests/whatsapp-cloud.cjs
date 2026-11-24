/* eslint-disable @typescript-eslint/no-require-imports */
// WhatsApp Cloud API: webhook verification/signatures/parsing, sending
// (payloads, Graph errors, retries) and the consent/scheduling rules.
// Pure modules only, Meta is always a mocked fetch — nothing is sent.
// Run: node --test tests/whatsapp-cloud.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const cache = new Map();
function resolveFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Cannot resolve ${base}`);
}
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const localRequire = (spec) => {
    if (spec === 'server-only') return {};
    if (spec.startsWith('@/')) return load(resolveFile(path.join(ROOT, spec.slice(2))));
    if (spec.startsWith('.')) return load(resolveFile(path.resolve(path.dirname(file), spec)));
    return require(spec);
  };
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  });
  vm.runInNewContext(outputText, {
    exports: mod.exports, module: mod, require: localRequire, process, Buffer, URL, URLSearchParams, Intl, Date, Math,
    AbortController, setTimeout, clearTimeout, Response, console,
  });
  return mod.exports;
}
// Values from the vm context are cross-realm, so compare structurally via JSON.
const deq = (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
const lib = (name) => load(path.join(ROOT, 'lib/whatsapp-cloud', `${name}.ts`));

const verification = lib('webhook-verification');
const webhook = lib('webhook-handler');
const phone = lib('phone');
const payloads = lib('payloads');
const client = lib('client');
const policy = lib('policy');
const eventMessages = lib('event-messages');

const SECRET = 'test-app-secret';
const sign = (body) => `sha256=${crypto.createHmac('sha256', SECRET).update(body).digest('hex')}`;
const params = (o) => new URLSearchParams(o);

// ─── Webhook verification (GET) ──────────────────────────────────────────────

test('valid Meta verification request returns the challenge', () => {
  const got = verification.verifyWebhookSubscription(params({ 'hub.mode': 'subscribe', 'hub.verify_token': 'tok', 'hub.challenge': '1158201444' }), 'tok');
  assert.equal(got, '1158201444');
});

test('invalid verification token is rejected', () => {
  assert.equal(verification.verifyWebhookSubscription(params({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '1' }), 'tok'), null);
  assert.equal(verification.verifyWebhookSubscription(params({ 'hub.mode': 'subscribe', 'hub.verify_token': 'tok', 'hub.challenge': '1' }), undefined), null);
});

test('missing verification parameters / wrong mode are rejected', () => {
  assert.equal(verification.verifyWebhookSubscription(params({ 'hub.verify_token': 'tok', 'hub.challenge': '1' }), 'tok'), null);
  assert.equal(verification.verifyWebhookSubscription(params({ 'hub.mode': 'subscribe', 'hub.verify_token': 'tok' }), 'tok'), null);
  assert.equal(verification.verifyWebhookSubscription(params({ 'hub.mode': 'unsubscribe', 'hub.verify_token': 'tok', 'hub.challenge': '1' }), 'tok'), null);
});

// ─── Webhook signature + parsing (POST) ──────────────────────────────────────

const statusBody = (status, extra = {}) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: 'WABA', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp', metadata: { phone_number_id: '123' },
    statuses: [{ id: 'wamid.ABC', status, timestamp: '1764000000', recipient_id: '919876543210', ...extra }],
  } }] }],
});

test('valid signed webhook passes; tampered body, wrong secret or bad header fail', () => {
  const raw = JSON.stringify(statusBody('delivered'));
  assert.equal(verification.verifyWebhookSignature(raw, sign(raw), SECRET), true);
  assert.equal(verification.verifyWebhookSignature(`${raw} `, sign(raw), SECRET), false);
  assert.equal(verification.verifyWebhookSignature(raw, sign(raw), 'other-secret'), false);
  assert.equal(verification.verifyWebhookSignature(raw, 'sha256=abc', SECRET), false);
  assert.equal(verification.verifyWebhookSignature(raw, null, SECRET), false);
  assert.equal(verification.verifyWebhookSignature(raw, sign(raw), undefined), false);
});

test('incoming message event is parsed with sender, text and timestamp', () => {
  const events = webhook.parseWebhookPayload({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      contacts: [{ wa_id: '919876543210' }],
      messages: [{ from: '919876543210', id: 'wamid.IN1', timestamp: '1764000000', type: 'text', text: { body: 'STOP' } }],
    } }] }],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'message');
  assert.equal(events[0].fromPhone, '919876543210');
  assert.equal(events[0].text, 'STOP');
  assert.equal(events[0].timestamp, new Date(1764000000 * 1000).toISOString());
  assert.equal(events[0].dedupeKey, 'message:wamid.IN1');
});

test('delivered and read statuses are parsed', () => {
  for (const s of ['sent', 'delivered', 'read']) {
    const [ev] = webhook.parseWebhookPayload(statusBody(s));
    assert.equal(ev.kind, 'status');
    assert.equal(ev.status, s);
    assert.equal(ev.wamid, 'wamid.ABC');
    assert.equal(ev.dedupeKey, `status:wamid.ABC:${s}`);
  }
});

test('failed status carries the Meta error code and details', () => {
  const [ev] = webhook.parseWebhookPayload(statusBody('failed', {
    errors: [{ code: 131026, title: 'Message undeliverable', error_data: { details: 'Receiver is incapable of receiving this message' } }],
  }));
  assert.equal(ev.status, 'failed');
  assert.equal(ev.errors[0].code, 131026);
  assert.match(ev.errors[0].title, /incapable/);
});

test('duplicate webhook deliveries produce identical dedupe keys', () => {
  const a = webhook.parseWebhookPayload(statusBody('read'));
  const b = webhook.parseWebhookPayload(JSON.parse(JSON.stringify(statusBody('read'))));
  assert.equal(a[0].dedupeKey, b[0].dedupeKey);
});

test('non-WhatsApp payloads are rejected; malformed entries skipped', () => {
  assert.equal(webhook.parseWebhookPayload({ object: 'page', entry: [] }), null);
  assert.equal(webhook.parseWebhookPayload('nope'), null);
  const events = webhook.parseWebhookPayload({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { statuses: [{ status: 'read' }, { id: 'w', status: 'weird' }] } }] }] });
  assert.equal(events.length, 0);
});

test('shouldApplyStatus only moves forward, failed never overrides delivered/read', () => {
  assert.equal(policy.shouldApplyStatus('accepted', 'sent'), true);
  assert.equal(policy.shouldApplyStatus('read', 'delivered'), false);
  assert.equal(policy.shouldApplyStatus('sent', 'failed'), true);
  assert.equal(policy.shouldApplyStatus('delivered', 'failed'), false);
  assert.equal(policy.shouldApplyStatus('failed', 'read'), false);
});

// ─── Sending ─────────────────────────────────────────────────────────────────

test('phone numbers normalise to international digits', () => {
  deq(phone.normalizeWhatsAppPhone('98765 43210'), { ok: true, phone: '919876543210' });
  deq(phone.normalizeWhatsAppPhone('+91 98765-43210'), { ok: true, phone: '919876543210' });
  deq(phone.normalizeWhatsAppPhone('09876543210'), { ok: true, phone: '919876543210' });
  deq(phone.normalizeWhatsAppPhone('0044 7700 900123'), { ok: true, phone: '447700900123' });
  deq(phone.normalizeWhatsAppPhone('+1 (415) 555-0100'), { ok: true, phone: '14155550100' });
});

test('invalid phone numbers are rejected', () => {
  for (const bad of ['', null, '12345', 'call me', '+91 12345 67890', '1234567890123456']) {
    assert.equal(phone.normalizeWhatsAppPhone(bad).ok, false, String(bad));
  }
  assert.equal(phone.maskPhone('919876543210'), '+91 •••••3210');
});

test('template parameters are named, ordered and validated', () => {
  const ok = payloads.buildTemplatePayload('memory_reminder', { guest_name: 'Asha', event_name: "Mahesh's 75th", link: 'https://x/invite/T#share' });
  assert.equal(ok.ok, true);
  assert.equal(ok.payload.template.name, 'em_memory_reminder');
  deq(ok.payload.template.components[0].parameters.map((p) => p.text), ['Asha', "Mahesh's 75th", 'https://x/invite/T#share']);

  const missing = payloads.buildTemplatePayload('memory_reminder', { guest_name: 'Asha', event_name: '' });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /event_name/);

  const mapped = payloads.buildTemplatePayload('test', {}, { test: { name: 'my_hello', language: 'en_GB' } });
  assert.equal(mapped.payload.template.name, 'my_hello');
  assert.equal(mapped.payload.template.language.code, 'en_GB');
  assert.equal(mapped.payload.template.components, undefined);
});

test('template params are sanitised to Meta limits (no newlines/tabs, no long space runs)', () => {
  assert.equal(payloads.sanitizeTemplateParam(' Line 1\n\tLine     2 '), 'Line 1 Line 2');
});

test('text/image/document payloads validate input', () => {
  assert.equal(payloads.buildTextPayload('  ').ok, false);
  assert.equal(payloads.buildTextPayload('x'.repeat(4097)).ok, false);
  assert.equal(payloads.buildTextPayload('see https://everymoment.in').payload.text.preview_url, true);
  assert.equal(payloads.buildImagePayload('http://insecure/x.jpg').ok, false);
  assert.equal(payloads.buildDocumentPayload('https://everymoment.in/a.pdf', 'menu.pdf').payload.document.filename, 'menu.pdf');
  deq(payloads.toGraphBody('919876543210', { type: 'text', text: { body: 'hi', preview_url: false } }), {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: '919876543210', type: 'text', text: { body: 'hi', preview_url: false },
  });
});

const CONFIG = { apiVersion: 'v26.0', phoneNumberId: '1234567890', accessToken: 'EAAG-secret' };
const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('valid recipient: Graph call is well-formed and returns the wamid', async () => {
  let seen;
  const result = await client.sendGraphMessage(CONFIG, { to: '919876543210' }, async (url, init) => {
    seen = { url, init };
    return jsonResponse(200, { messaging_product: 'whatsapp', contacts: [{ wa_id: '919876543210' }], messages: [{ id: 'wamid.OUT1' }] });
  });
  deq(result, { ok: true, wamid: 'wamid.OUT1' });
  assert.equal(seen.url, 'https://graph.facebook.com/v26.0/1234567890/messages');
  assert.equal(seen.init.headers.Authorization, 'Bearer EAAG-secret');
  assert.equal(seen.init.method, 'POST');
});

test('invalid access token is a permanent error and the token never appears in the result', async () => {
  const result = await client.sendGraphMessage(CONFIG, {}, async () => jsonResponse(401, { error: { code: 190, message: 'Invalid OAuth access token.' } }));
  assert.equal(result.ok, false);
  assert.equal(result.retryable, false);
  assert.equal(result.code, 190);
  assert.doesNotMatch(JSON.stringify(result), /EAAG-secret/);
});

test('template problems (not approved / param mismatch) are permanent', async () => {
  for (const code of [132001, 132000, 131026, 131047, 131030]) {
    const r = await client.sendGraphMessage(CONFIG, {}, async () => jsonResponse(400, { error: { code, message: 'x' } }));
    assert.equal(r.retryable, false, String(code));
  }
});

test('API timeout and network errors are retryable', async () => {
  const timeout = await client.sendGraphMessage(CONFIG, {}, async () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    throw err;
  });
  assert.equal(timeout.ok, false);
  assert.equal(timeout.retryable, true);
  assert.match(timeout.title, /Timed out/);
  const offline = await client.sendGraphMessage(CONFIG, {}, async () => { throw new TypeError('fetch failed'); });
  assert.equal(offline.retryable, true);
});

test('rate limits and Meta 5xx are retryable', async () => {
  for (const [status, body] of [[429, { error: { code: 130429, message: 'Rate limit hit' } }], [400, { error: { code: 131056, message: 'pair rate' } }], [503, {}]]) {
    const r = await client.sendGraphMessage(CONFIG, {}, async () => jsonResponse(status, body));
    assert.equal(r.retryable, true, `${status}`);
  }
});

test('retry backoff grows exponentially, is capped, and attempts are bounded', () => {
  const half = () => 0.5;
  assert.equal(client.retryDelayMs(1, half), 60_000);
  assert.equal(client.retryDelayMs(3, half), 240_000);
  assert.equal(client.retryDelayMs(20, half), 3_600_000);
  assert.equal(client.MAX_SEND_ATTEMPTS, 5);
});

test('duplicate send prevention: the idempotency keys used for automations are stable per guest', () => {
  // services/whatsapp.ts keys every scheduled send as `${category}:${inviteeId}` and every
  // RSVP confirmation as `rsvp_confirmation:${inviteeId}:${answer}`; the DB's unique index does the rest.
  const src = fs.readFileSync(path.join(ROOT, 'services/whatsapp.ts'), 'utf8');
  assert.match(src, /idempotencyKey: `\$\{category\}:\$\{invitee\.id\}`/);
  assert.match(src, /idempotencyKey: `invitation:\$\{guest\.inviteeId\}`/);
  assert.match(src, /`rsvp_confirmation:\$\{inviteeId\}:\$\{coming\}`/);
  assert.match(fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261124120000_whatsapp_cloud_api.sql'), 'utf8'), /idempotency_key text not null unique/);
});

// ─── EveryMoment integration rules ───────────────────────────────────────────

const EVENT = {
  honoreeName: 'Mahesh J. Shah', occasion: '75th Birthday Celebration', category: 'birthday', hostedBy: 'Jagruti Shah',
  startAt: '2026-08-23T05:30:00.000Z', timezone: 'Asia/Kolkata', venueName: 'The Grand Hall', venueAddress: 'Mumbai',
};

test('event invitation values use the event timezone and the guest\'s own link', () => {
  const v = eventMessages.eventTemplateValues(EVENT, { name: 'Asha Mehta', token: '7FQ2KD91', rsvp_status: 'pending' });
  assert.equal(v.guest_name, 'Asha');
  assert.equal(v.event_name, "Mahesh J. Shah's 75th Birthday Celebration");
  assert.equal(v.event_when, 'Sunday, August 23, 2026, 11:00 AM IST');
  assert.equal(v.venue, 'The Grand Hall, Mumbai');
  assert.match(v.link, /\/invite\/7FQ2KD91$/);
  const built = payloads.buildTemplatePayload('invitation', v);
  assert.equal(built.ok, true);
  assert.equal(built.payload.template.components[0].parameters.length, 6);
});

test('RSVP confirmation states the attendance answer', () => {
  const v = eventMessages.eventTemplateValues(EVENT, { name: 'Asha', token: 'T', rsvp_status: 'coming' });
  assert.equal(v.attendance, 'Attending');
  assert.equal(payloads.buildTemplatePayload('rsvp_confirmation', v).ok, true);
});

test('corporate events are named by the event itself', () => {
  assert.equal(eventMessages.eventDisplayName({ honoreeName: 'Acme Annual Day 2026', occasion: 'Annual Day', category: 'corporate' }), 'Acme Annual Day 2026');
});

test('photo submission reminder links to that guest\'s own upload section on that event', () => {
  const v = eventMessages.valuesFor('memory_reminder', eventMessages.eventTemplateValues(EVENT, { name: 'Asha', token: 'GUEST1', rsvp_status: 'coming' }));
  assert.match(v.link, /\/invite\/GUEST1#share$/);
  assert.match(eventMessages.valuesFor('reminder_24h', v).link, /#share$/); // pass-through for non post-event categories
  const reminder = eventMessages.valuesFor('reminder_24h', eventMessages.eventTemplateValues(EVENT, { name: 'Asha', token: 'GUEST1', rsvp_status: 'coming' }));
  assert.match(reminder.link, /\/invite\/GUEST1$/);
});

const settings = (o = {}) => ({ eventId: 'e', enabled: true, rsvpConfirmation: true, reminder24h: true, reminder2h: true, thankYou: true, memoryReminder: true, feedbackRequest: true, ...o });
const HOUR = 3600_000;
const start = '2026-08-23T05:30:00.000Z';
const end = '2026-08-23T09:30:00.000Z';
const at = (base, h) => new Date(new Date(base).getTime() + h * HOUR);

test('event reminders: 24h window, 2h window, never both stale, nothing when disabled', () => {
  deq(policy.dueAutomations(settings(), start, end, at(start, -30)), []);
  deq(policy.dueAutomations(settings(), start, end, at(start, -23.9)), ['reminder_24h']);
  deq(policy.dueAutomations(settings(), start, end, at(start, -2.5)), []);
  deq(policy.dueAutomations(settings(), start, end, at(start, -1)), ['reminder_2h']);
  deq(policy.dueAutomations(settings({ enabled: false }), start, end, at(start, -1)), []);
  deq(policy.dueAutomations(settings({ reminder2h: false }), start, end, at(start, -1)), []);
});

test('post-event: thank-you, feedback, then photo reminder', () => {
  deq(policy.dueAutomations(settings(), start, end, at(end, 1)), []);
  deq(policy.dueAutomations(settings(), start, end, at(end, 3)), ['thank_you']);
  deq(policy.dueAutomations(settings(), start, end, at(end, 30)), ['thank_you', 'feedback_request']);
  deq(policy.dueAutomations(settings(), start, end, at(end, 24 * 5)), ['memory_reminder']);
  deq(policy.dueAutomations(settings(), start, end, at(end, 24 * 8)), []);
});

test('reminder audience is attending/maybe; post-event audience is attendees', () => {
  assert.equal(policy.automationAudience('reminder_24h', 'maybe', false), true);
  assert.equal(policy.automationAudience('reminder_24h', 'not_coming', false), false);
  assert.equal(policy.automationAudience('thank_you', 'pending', true), true);
  assert.equal(policy.automationAudience('thank_you', 'maybe', false), false);
});

test('consent: required for event messages; marketing needs its own opt-in', () => {
  const yes = { optedIn: true, optedOutAt: null, marketingOptedIn: false };
  assert.equal(policy.consentDecision('invitation', null, null).ok, false);
  assert.equal(policy.consentDecision('invitation', { ...yes, optedIn: false }, null).ok, false);
  assert.equal(policy.consentDecision('invitation', yes, null).ok, true);
  assert.equal(policy.consentDecision('corporate_festival', yes, null).ok, false);
  assert.equal(policy.consentDecision('corporate_festival', { ...yes, marketingOptedIn: true }, null).ok, true);
  assert.equal(policy.consentDecision('test', null, null).ok, true);
});

test('opt-out handling: STOP beats every consent, per-event opt-out too', () => {
  const yes = { optedIn: true, optedOutAt: null, marketingOptedIn: true };
  const stopped = { optedOutAt: '2026-11-01T00:00:00Z', lastInboundAt: null };
  assert.equal(policy.consentDecision('rsvp_confirmation', yes, stopped).ok, false);
  assert.equal(policy.consentDecision('test', null, stopped).ok, false);
  assert.equal(policy.consentDecision('reminder_24h', { ...yes, optedOutAt: '2026-11-01T00:00:00Z' }, null).ok, false);
  assert.equal(policy.parseOptKeyword(' Stop. '), 'stop');
  assert.equal(policy.parseOptKeyword('UNSUBSCRIBE'), 'stop');
  assert.equal(policy.parseOptKeyword('start'), 'start');
  assert.equal(policy.parseOptKeyword('please stop by at 5'), null);
});

test('free-form text only inside the 24-hour customer service window', () => {
  const now = new Date('2026-11-24T12:00:00Z');
  assert.equal(policy.withinServiceWindow(null, now), false);
  assert.equal(policy.withinServiceWindow('2026-11-24T00:00:00Z', now), true);
  assert.equal(policy.withinServiceWindow('2026-11-23T11:59:00Z', now), false);
});
