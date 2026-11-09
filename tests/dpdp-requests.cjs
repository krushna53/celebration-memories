/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, Error, require: (name) => {
      if (name === 'server-only') return {};
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}
const schema = load('types/privacy-request.ts', { zod: require('zod') });

test('request schema bounds inputs and constrains kinds and transitions', () => {
  const valid = { email: 'guest@example.com', event: 'Birthday', kind: 'withdrawal', details: 'Withdraw my RSVP consent' };
  assert.equal(schema.privacyRequestSchema.safeParse(valid).success, true);
  assert.equal(schema.privacyRequestSchema.safeParse({ ...valid, kind: 'delete-everything' }).success, false);
  assert.equal(schema.privacyRequestSchema.safeParse({ ...valid, details: 'a'.repeat(2001) }).success, false);
  assert.equal(schema.validRequestTransition('received', 'completed'), false);
  assert.equal(schema.validRequestTransition('completed', 'in_progress'), false);
});

test('non-platform users cannot list or review requests, even with a valid request UUID', async () => {
  let dbCalls = 0;
  for (const role of [null, 'client', 'organizer', 'session_organizer']) {
    const service = load('services/privacy-requests.ts', {
      '@/services/admin-auth': { getCurrentAdmin: async () => role ? { role, id: 'u' } : null },
      '@/lib/supabase/admin': { supabaseAdmin: () => { dbCalls++; throw new Error('Must not read database'); } },
      '@/types/privacy-request': schema,
    });
    await assert.rejects(service.listPrivacyRequests(), /administrator required/);
    await assert.rejects(service.reviewPrivacyRequest({}), /administrator required/);
  }
  assert.equal(dbCalls, 0);
});

test('public request action returns reference only, never emails or other requests', async () => {
  let calls = 0;
  const actions = load('features/privacy-requests/actions.ts', {
    'next/headers': { headers: async () => ({}) }, 'next/cache': {},
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ rpc: async () => { calls++; return { data: '10000000-0000-4000-8000-000000000001', error: null }; } }) },
    '@/lib/ip-hash': { getClientIp: () => '127.0.0.1', hashIp: () => 'a'.repeat(64) },
    '@/types/privacy-request': schema, '@/services/privacy-requests': {},
  });
  const data = { email: 'guest@example.com', event: 'Birthday', kind: 'access', details: 'A copy of my RSVP information', website: '' };
  assert.equal((await actions.submitPrivacyRequestAction({ ...data, website: 'spam' })).success, false);
  assert.equal((await actions.submitPrivacyRequestAction({ ...data, email: 'bad' })).success, false);
  assert.equal(calls, 0);
  const result = await actions.submitPrivacyRequestAction(data);
  assert.equal(result.success, true);
  assert.deepEqual(Object.keys(result).sort(), ['reference', 'success']);
  assert.equal(calls, 1);
});
