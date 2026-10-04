const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => {
    if (name === 'server-only') return {};
    if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
    return mocks[name];
  } });
  return exports;
}

function events(override) {
  return load('lib/admin-event.ts', {
    '@/lib/constants': { EVENT_SLUG: 'flagship' },
    '@/lib/admin-active-event': { getActiveEventOverrideId: async () => override },
    '@/services/events': {
      getEventById: async (id) => id === 'deleted' ? null : { id },
      getEventBySlug: async () => ({ id: 'flagship' }),
      listAllActiveEvents: async () => [],
    },
  });
}

test('owner selection overrides their assigned event', async () => {
  assert.equal((await events('veda').resolveAdminEvent({ role: 'owner', eventId: 'mgm' })).id, 'veda');
});
test('clients cannot use the owner event override', async () => {
  assert.equal((await events('veda').resolveAdminEvent({ role: 'client', eventId: 'mgm' })).id, 'mgm');
  assert.equal(await events('veda').resolveAdminEvent({ role: 'client', eventId: null }), null);
});
test('exit restores owner assigned event; deleted selection cannot edit a different event', async () => {
  assert.equal((await events(null).resolveAdminEvent({ role: 'owner', eventId: 'mgm' })).id, 'mgm');
  assert.equal(await events('deleted').resolveAdminEvent({ role: 'owner', eventId: 'mgm' }), null);
});

function team({ existingAdmin = null, duplicate = true, insertError = null, authCode = 'email_exists' } = {}) {
  const calls = { inserts: [], deletes: [], resets: [], pages: [] };
  const authResult = async () => duplicate
    ? { data: { user: null }, error: { code: authCode, message: authCode } }
    : { data: { user: { id: 'new' } }, error: null };
  const client = {
    from: () => ({
      select: (_, options) => options?.head
        ? { eq: async () => ({ count: 1, error: null }) }
        : { ilike: () => ({ maybeSingle: async () => ({ data: existingAdmin, error: null }) }) },
      insert: async (row) => { calls.inserts.push(row); return { error: insertError }; },
    }),
    auth: {
      resetPasswordForEmail: async (email) => { calls.resets.push(email); return { error: null }; },
      admin: {
        inviteUserByEmail: authResult,
        createUser: authResult,
        listUsers: async ({ page }) => {
          calls.pages.push(page);
          return { data: { users: page === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: `${i}`, email: `${i}@test.com` })) : [{ id: 'existing', email: 'PERSON@example.com' }] }, error: null };
        },
        deleteUser: async (id) => { calls.deletes.push(id); return { error: null }; },
      },
    },
  };
  return { calls, service: load('services/admin-team.ts', {
    '@/lib/supabase/admin': { supabaseAdmin: () => client },
    '@/lib/constants': { SITE_URL: 'https://example.com' },
  }) };
}
const input = { eventId: 'veda', name: 'Person', email: ' Person@example.com ', password: 'new-password' };
test('existing auth user gets event access and a recovery email, including paginated lookup', async () => {
  const { service, calls } = team();
  await service.inviteTeamMemberByEmail(input);
  assert.equal(calls.inserts[0].id, 'existing');
  assert.equal(calls.inserts[0].event_id, 'veda');
  assert.deepEqual(calls.pages, [1, 2]);
  assert.deepEqual(calls.resets, ['person@example.com']);
  assert.deepEqual(calls.deletes, []);
});
test('existing login can be assigned through password mode without changing its credentials', async () => {
  const { service, calls } = team();
  await service.addTeamMemberWithPassword(input);
  assert.equal(calls.inserts[0].id, 'existing');
  assert.deepEqual(calls.deletes, []);
});
test('failed assignment never deletes an existing shared login', async () => {
  const { service, calls } = team({ insertError: { message: 'conflict' } });
  await assert.rejects(service.addTeamMemberWithPassword(input), /conflict/);
  assert.deepEqual(calls.deletes, []);
});
test('new user assignment failure cleans up only the newly created login', async () => {
  const { service, calls } = team({ duplicate: false, insertError: { message: 'conflict' } });
  await assert.rejects(service.addTeamMemberWithPassword(input), /conflict/);
  assert.deepEqual(calls.deletes, ['new']);
});
test('existing event membership is never silently reassigned', async () => {
  const { service, calls } = team({ existingAdmin: { id: 'existing', event_id: 'mgm' } });
  await assert.rejects(service.inviteTeamMemberByEmail(input), /another event/);
  assert.equal(calls.inserts.length, 0);
});
test('unrelated auth errors do not trigger account reuse', async () => {
  const { service, calls } = team({ authCode: 'rate_limit' });
  await assert.rejects(service.inviteTeamMemberByEmail(input), /rate_limit/);
  assert.equal(calls.pages.length, 0);
});

function login(destination, user) {
  return load('app/login/page.tsx', {
    'react': require('react'),
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { default: 'a' },
    'next/navigation': { redirect: (path) => { throw new Error(`redirect:${path}`); } },
    '@/features/auth/actions': {
      resolveLoginDestinationAction: async () => destination,
      getCurrentSupabaseUser: async () => user,
    },
    '@/features/auth/unified-login-form': { UnifiedLoginForm: 'login-form' },
  });
}
test('signed-in admin is redirected before rendering the sign-in form', async () => {
  await assert.rejects(login({ kind: 'admin', path: '/admin?from=login' }, { id: 'owner' }).default(), /redirect:\/admin/);
});
test('signed-in account without a dashboard does not see sign-in controls', async () => {
  const page = await login({ kind: 'none' }, { id: 'existing', email: 'person@example.com' }).default();
  assert.match(JSON.stringify(page), /You’re signed in/);
  assert.doesNotMatch(JSON.stringify(page), /login-form/);
});
