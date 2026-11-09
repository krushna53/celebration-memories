const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => {
    if (name === 'server-only') return {};
    if (name === '@/lib/privacy-consent') return { CONSENT_VERSION: '2026-10-30.1' };
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}

test('public phone match cannot return or overwrite an existing invitee', async () => {
  let created = 0;
  const service = load('services/public-rsvp.ts', {
    '@/services/events': {},
    '@/services/admin-invitees': {
      listInvitees: async () => [{ id: 'victim', phone: '+91 99879 82969', name: 'Original' }],
      createInvitee: async () => { created++; },
      updateInvitee: () => { throw new Error('Must never update an unverified guest'); },
    },
  });
  await assert.rejects(service.findOrCreateSelfInvitee('event', { name: 'Attacker', phone: '919987982969' }), /personal invitation/);
  assert.equal(created, 0);
});

test('new public guest can still register without accessing another guest', async () => {
  let input;
  const service = load('services/public-rsvp.ts', {
    '@/services/events': {},
    '@/services/admin-invitees': {
      listInvitees: async () => [],
      createInvitee: async (eventId, values) => { input = { eventId, values }; return { id: 'new' }; },
    },
  });
  assert.equal((await service.findOrCreateSelfInvitee('event', { name: 'Guest', phone: '9876543210' })).id, 'new');
  assert.equal(input.eventId, 'event');
  assert.equal(input.values.name, 'Guest');
});

test('RSVP and guestbook services reject absent, false and truthy non-boolean consent before database access', async () => {
  let reads = 0;
  const mocks = {
    '@/lib/supabase/admin': { supabaseAdmin: () => { reads++; throw new Error('Database should not be touched'); } },
    '@/services/tracking': {},
  };
  const rsvp = load('services/rsvps.ts', mocks);
  const guestbook = load('services/guestbook.ts', mocks);
  for (const consent of [undefined, false, 'true', 1]) {
    await assert.rejects(rsvp.submitRsvp('guest', { consent }), /consent is required/);
    await assert.rejects(guestbook.submitGuestbookEntry({ values: { consent } }), /consent is required/);
  }
  for (const consentVersion of [undefined, 'old']) {
    await assert.rejects(rsvp.submitRsvp('guest', { consent: true, consentVersion }), /refresh/);
    await assert.rejects(guestbook.submitGuestbookEntry({ values: { consent: true, consentVersion } }), /refresh/);
  }
  assert.equal(reads, 0);
});

test('quick RSVP server actions reject fabricated or missing consent before any event or identity access', async () => {
  const action = load('features/rsvp/quick-rsvp-actions.ts', {
    'next/cache': {}, 'next/headers': {}, zod: require('zod'),
    '@/services/public-rsvp': { getEventForPublicRsvp: () => { throw new Error('Must not resolve event'); } },
    '@/services/rsvps': {}, '@/services/rsvp-config': {}, '@/lib/rsvp-config': {},
    '@/services/admin-notifications': {}, '@/services/abuse-guard': {}, '@/services/quick-rsvp': {},
    '@/types/rsvp': { ATTENDANCE_OPTIONS: ['coming', 'maybe', 'not_coming'] },
  });
  for (const consent of [undefined, false, 'true', 1]) {
    const signedIn = await action.quickRsvpSignedInAction('event', 'coming', consent);
    const anonymous = await action.quickRsvpNameOnlyAction('event', 'Guest', 'maybe', '', consent);
    assert.equal(signedIn.success, false);
    assert.equal(anonymous.success, false);
    assert.match(signedIn.error, /privacy notice/);
  }
});

test('verified session email is required and unverified session phone is ignored', async () => {
  let user;
  const service = load('services/quick-rsvp.ts', {
    '@/lib/supabase/admin': {},
    '@/lib/supabase/server': { supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    '@/services/admin-invitees': {}, '@/services/event-extras': {}, '@/services/tracking': {},
  });
  user = { id: 'u', email: 'guest@example.com', phone: '+919876543210' };
  assert.equal(await service.getSignedInGuest(), null);
  user.email_confirmed_at = '2026-10-29T00:00:00Z';
  assert.equal((await service.getSignedInGuest()).phone, null);
  user.phone_confirmed_at = '2026-10-29T00:00:00Z';
  assert.equal((await service.getSignedInGuest()).phone, '+919876543210');
});
