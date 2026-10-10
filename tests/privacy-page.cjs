const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function page(admin, access) {
  const exports = {};
  let historyReads = 0;
  let permissionReads = 0;
  const mocks = {
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/navigation': { redirect: (url) => { throw new Error(`redirect:${url}`); }, notFound: () => { throw new Error('404'); } },
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/services/admin-auth': { getCurrentAdmin: async () => admin },
    '@/services/event-access': { eventPermissions: async () => { permissionReads++; return access; } },
    '@/services/support-access': { supportHistory: async () => { historyReads++; return {}; } },
    '@/features/privacy/privacy-panel': { PrivacyPanel: () => React.createElement('p', null, 'Owner privacy controls') },
  };
  const code = ts.transpileModule(fs.readFileSync('app/admin/(dashboard)/privacy/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => { if (!(name in mocks)) throw new Error(name); return mocks[name]; } });
  return { render: async () => renderToStaticMarkup(await exports.default({ searchParams: Promise.resolve({}) })), reads: () => ({ historyReads, permissionReads }) };
}
test('platform admin gets privacy tools without reading customer data', async () => {
  const p = page({ role: 'owner', eventId: 'legacy-event' });
  const html = await p.render();
  assert.match(html, /href="\/admin\/public-event-links"/);
  assert.match(html, /href="\/admin\/support-access"/);
  assert.doesNotMatch(html, /Owner privacy controls/);
  assert.deepEqual(p.reads(), { historyReads: 0, permissionReads: 0 });
});
test('event owner retains privacy controls', async () => {
  const p = page({ role: 'client', eventId: 'event' }, { owner: true, manage: true, event: { viewing_access: 'public', public_access_pinned: false } });
  assert.match(await p.render(), /Owner privacy controls/);
  assert.equal(p.reads().historyReads, 1);
});
test('team member gets explanation without owner controls or support history', async () => {
  const p = page({ role: 'client', eventId: 'event' }, { owner: false, manage: true });
  assert.match(await p.render(), /Only this event/);
  assert.equal(p.reads().historyReads, 0);
});
test('unrelated event stays inaccessible and signed-out visitor goes to login', async () => {
  await assert.rejects(page({ role: 'client', eventId: 'other' }, { owner: false, manage: false }).render(), /404/);
  await assert.rejects(page(null).render(), /redirect:\/login/);
});
