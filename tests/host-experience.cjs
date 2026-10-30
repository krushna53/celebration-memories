/* eslint-disable @typescript-eslint/no-require-imports -- Node regression tests load TypeScript with explicit dependency mocks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(relative, mocks = {}) {
  const cache = new Map();
  function moduleAt(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const requireFrom = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === 'server-only') return {};
      if (id.startsWith('@/')) return moduleAt(path.join(root, id.slice(2) + '.ts'));
      return require(id);
    };
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: file })(requireFrom, mod, mod.exports);
    return mod.exports;
  }
  return moduleAt(path.join(root, relative));
}

test('quick setup reaches review without optional creative steps; full and free builders retain their steps', () => {
  const wizard = load('features/start/wizard-steps.ts');
  const quick = wizard.resolveWizardSteps(['website']).map(s => s.slug);
  assert.deepEqual(quick, ['occasion', 'goals', 'basics', 'template', 'review']);
  assert.equal(wizard.nextWizardStep('basics', ['website']).slug, 'template');
  assert.equal(wizard.prevWizardStep('review', ['website']).slug, 'template');
  for (const goals of [null, ['website', 'slideshow'], ['website', 'invitation_card']]) {
    assert.ok(wizard.resolveWizardSteps(goals).some(s => s.slug === 'card'));
  }
  assert.ok(wizard.resolveWizardSteps(['invitation_card']).some(s => s.slug === 'ai-image'));
  assert.ok(!wizard.resolveWizardSteps(['invitation_card']).some(s => s.slug === 'gallery'));
  assert.ok(wizard.resolveWizardSteps(['slideshow']).some(s => s.slug === 'slideshow'));
});

test('checklist distinguishes privacy choices, draft preview and real event details', () => {
  const { buildLaunchChecks, launchEventSummary } = load('lib/launch-checklist.ts');
  const event = { id: 'event', slug: 'draft-123', honoreeName: 'New Event', hostedBy: '', startAt: 'bad', timezone: 'bad', visibility: 'private', publicRsvpEnabled: false, publicMemoriesEnabled: false, templateSlug: 'royal-gold', viewingAccess: 'invited_only', secret: 'never serialize' };
  const checks = buildLaunchChecks(event, 'draft-token');
  assert.equal(checks[0].complete, false);
  assert.match(checks.find(c => c.id === 'privacy').detail, /verified invited account/);
  assert.equal(checks.find(c => c.id === 'preview').href, '/start/draft-token/preview/royal-gold');
  assert.ok(!Object.hasOwn(launchEventSummary(event), 'secret'));
  event.slug = 'birthday'; event.honoreeName = 'Birthday'; event.hostedBy = 'Family'; event.startAt = '2026-12-01T12:00:00Z'; event.timezone = 'Asia/Kolkata';
  assert.equal(buildLaunchChecks(event)[0].complete, true);
  assert.match(buildLaunchChecks(event).find(c => c.id === 'date').detail, /Asia\/Kolkata/);
});

function uploadService({ missing = false } = {}) {
  const rows = new Map(); let puts = 0; let objectReads = 0;
  const client = {
    from() {
      let filters = {}; let inserting;
      const query = {
        select() { return query; }, eq(key, value) { filters[key] = value; return query; },
        maybeSingle: async () => ({ data: [...rows.values()].find(row => Object.entries(filters).every(([k,v]) => row[k] === v)) ?? null, error: null }),
        single: async () => ({ data: [...rows.values()].find(row => Object.entries(filters).every(([k,v]) => row[k] === v)) ?? null, error: null }),
        upsert(row) { inserting = row; return query; },
        then(resolve) { if (inserting && !rows.has(inserting.id)) { rows.set(inserting.id, inserting); puts++; } return Promise.resolve({ error: null }).then(resolve); },
      }; return query;
    },
    storage: { from: () => ({ info: async () => { objectReads++; return { data: missing ? null : { size: 10 }, error: missing ? new Error('missing') : null }; } }) },
  };
  const service = load('services/uploads.ts', {
    '@/lib/supabase/admin': { supabaseAdmin: () => client },
    '@/lib/curated-media': {}, '@/lib/media-url': {}, '@/services/storage-quota': {},
  });
  return { ...service, rows, counts: () => ({ puts, objectReads }) };
}
const upload = { inviteeId: 'guest', eventId: 'event', kind: 'photo', path: 'event/guest/12345678-1234-4234-8234-123456789abc-image.jpg', caption: 'A memory' };
test('confirmation retries and concurrent confirmations create only one memory', async () => {
  const service = uploadService();
  const results = await Promise.all([service.confirmMediaUpload(upload), service.confirmMediaUpload(upload)]);
  assert.equal(results[0].id, results[1].id);
  await service.confirmMediaUpload(upload);
  assert.equal(service.rows.size, 1);
  assert.equal(service.counts().puts, 1);
  assert.equal(service.counts().objectReads, 2);
});
test('confirmation rejects foreign paths and missing objects without creating records', async () => {
  const service = uploadService();
  await assert.rejects(service.confirmMediaUpload({ ...upload, path: upload.path.replace('/guest/', '/other/') }), /does not belong/);
  await assert.rejects(service.confirmMediaUpload({ ...upload, path: 'event/guest/invalid' }), /Invalid upload path/);
  const missing = uploadService({ missing: true });
  await assert.rejects(missing.confirmMediaUpload(upload), /not finished uploading/);
  assert.equal(missing.rows.size, 0);
});
