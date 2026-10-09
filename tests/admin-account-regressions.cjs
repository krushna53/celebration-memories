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

test('platform selection never grants customer management', async () => {
  assert.equal(await events('veda').resolveAdminEvent({ role: 'owner', eventId: 'mgm' }), null);
});
test('clients cannot use the owner event override', async () => {
  assert.equal((await events('veda').resolveAdminEvent({ role: 'client', eventId: 'mgm' })).id, 'mgm');
  assert.equal(await events('veda').resolveAdminEvent({ role: 'client', eventId: null }), null);
});
test('platform has no implicit default event and deleted selection stays denied', async () => {
  assert.equal(await events(null).resolveAdminEvent({ role: 'owner', eventId: 'mgm' }), null);
  assert.equal(await events('deleted').resolveAdminEvent({ role: 'owner', eventId: 'mgm' }), null);
});

/**
 * Minimal table-aware Supabase mock for services/admin-team.ts: every
 * query builder is chainable and resolves per table — `admins` lookups
 * by email return `existingAdmin`, membership lookups return
 * `membership`, head counts return `memberCount`, and every write is
 * recorded in `calls` (with its table) for assertions.
 */
function team({ existingAdmin = null, duplicate = true, insertError = null, authCode = 'email_exists', membership = null, memberCount = 1, remaining = [] } = {}) {
  const calls = { inserts: [], deletes: [], resets: [], pages: [], updates: [], rowDeletes: [] };
  const authResult = async () => duplicate
    ? { data: { user: null }, error: { code: authCode, message: authCode } }
    : { data: { user: { id: 'new' } }, error: null };
  const builder = (table) => {
    const state = { table, head: false, op: 'select', row: null, filters: [] };
    const result = () => {
      if (state.op === 'insert') { calls.inserts.push({ table, ...state.row }); return { error: insertError }; }
      if (state.op === 'update') { calls.updates.push({ table, row: state.row, filters: state.filters }); return { error: null }; }
      if (state.op === 'delete') { calls.rowDeletes.push({ table, filters: state.filters }); return { error: null }; }
      if (state.head) return { count: memberCount, error: null };
      if (table === 'admin_event_memberships') return { data: remaining, error: null };
      return { data: [], error: null };
    };
    const b = {
      select: (_cols, options) => { state.head = Boolean(options?.head); return b; },
      insert: (row) => { state.op = 'insert'; state.row = row; return b; },
      update: (row) => { state.op = 'update'; state.row = row; return b; },
      delete: () => { state.op = 'delete'; return b; },
      eq: (col, val) => { state.filters.push(['eq', col, val]); return b; },
      neq: (col, val) => { state.filters.push(['neq', col, val]); return b; },
      is: (col, val) => { state.filters.push(['is', col, val]); return b; },
      ilike: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: async () => ({ data: table === 'admins' ? existingAdmin : membership, error: null }),
      then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
    };
    return b;
  };
  const client = {
    from: (table) => builder(table),
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
test('the owner can add someone already hosting another event, keeping their login and other events', async () => {
  for (const add of ['inviteTeamMemberByEmail', 'addTeamMemberWithPassword']) {
    const { service, calls } = team({ existingAdmin: { id: 'existing', role: 'client' } });
    await service[add]({ ...input, canAddExistingAccounts: true });
    assert.deepEqual(calls.inserts, [{ table: 'admin_event_memberships', admin_id: 'existing', event_id: 'veda', role: 'client' }]);
    assert.deepEqual(calls.resets, [], 'no password email for an existing dashboard login');
    assert.deepEqual(calls.deletes, []);
    // Only a missing primary event is ever filled in — an existing one is never overwritten.
    for (const update of calls.updates) assert.ok(update.filters.some(([op, col, val]) => op === 'is' && col === 'event_id' && val === null));
  }
});
test('a host cannot add someone who already manages another event — only the owner can', async () => {
  for (const add of ['inviteTeamMemberByEmail', 'addTeamMemberWithPassword']) {
    const { service, calls } = team({ existingAdmin: { id: 'existing', role: 'client' } });
    await assert.rejects(service[add](input), /Only the EveryMoment team can add them/);
    assert.equal(calls.inserts.length, 0);
    assert.deepEqual(calls.resets, []);
  }
});
test('the same person cannot be added to one event twice, and the owner account is never added', async () => {
  const twice = team({ existingAdmin: { id: 'existing', role: 'client' }, membership: { admin_id: 'existing' } });
  await assert.rejects(twice.service.inviteTeamMemberByEmail(input), /already on this event/);
  assert.equal(twice.calls.inserts.length, 0);
  const owner = team({ existingAdmin: { id: 'boss', role: 'owner' } });
  await assert.rejects(owner.service.inviteTeamMemberByEmail(input), /site owner/);
  assert.equal(owner.calls.inserts.length, 0);
});
test('a full team refuses new members', async () => {
  const { service, calls } = team({ memberCount: 4 });
  await assert.rejects(service.inviteTeamMemberByEmail(input), /already has 4 team members/);
  assert.equal(calls.inserts.length, 0);
});
test('removing someone from one event keeps their login when they still manage others', async () => {
  const { service, calls } = team({ membership: { admin_id: 'existing' }, memberCount: 2, remaining: [{ event_id: 'mgm' }] });
  await service.removeTeamMember('veda', 'existing');
  assert.deepEqual(calls.rowDeletes.map((d) => d.table), ['admin_event_memberships']);
  assert.equal(calls.updates[0].row.event_id, 'mgm');
  assert.equal(calls.updates.length, 1, 'their account row is only re-pointed, never deleted');
});
test('removing someone from their last event removes their dashboard account', async () => {
  const { service, calls } = team({ membership: { admin_id: 'existing' }, memberCount: 2, remaining: [] });
  await service.removeTeamMember('veda', 'existing');
  assert.deepEqual(calls.rowDeletes.map((d) => d.table), ['admin_event_memberships', 'admins']);
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

function auth() {
  return load('services/admin-auth.ts', {
    '@/services/event-access': { requireEventMember: async () => {} },
    '@/lib/supabase/server': { supabaseServer: async () => ({}) },
    '@/lib/supabase/admin': { supabaseAdmin: () => ({}) },
    '@/services/session-organizers': { getAssignedSessionIds: async () => [] },
    '@/lib/admin-active-event': { getActiveEventOverrideId: async () => null },
  });
}
test('multi-event access is checked per event, with that event\'s own role', () => {
  const { adminForEvent } = auth();
  const person = {
    id: 'p', role: 'client', eventId: 'veda',
    memberships: [{ eventId: 'veda', role: 'client' }, { eventId: 'mgm', role: 'organizer' }],
  };
  assert.equal(adminForEvent(person, 'veda').role, 'client');
  const onMgm = adminForEvent(person, 'mgm');
  assert.equal(onMgm.role, 'organizer');
  assert.equal(onMgm.eventId, 'mgm');
  assert.equal(adminForEvent(person, 'someone-else'), null, 'no access to events they are not a member of');
  const owner = { id: 'o', role: 'owner', eventId: 'flagship', memberships: [] };
  assert.equal(adminForEvent(owner, 'anything'), null);
});
