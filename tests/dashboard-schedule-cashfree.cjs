const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, Error, Buffer, URL, AbortSignal, console, require: (name) => {
    if (name === 'server-only') return {};
    if (name.startsWith('node:')) return require(name);
    if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
    return mocks[name];
  }, ...globals });
  return exports;
}
const { tourPosition } = load('lib/tour-position.ts');
test('tour remains within narrow and short screens with missing or offscreen targets', () => {
  for (const [width, height] of [[320, 568], [375, 240], [1440, 900]]) {
    for (const rect of [null, { left: 1400, top: 800, width: 100, height: 40 }, { left: -150, top: -60, width: 100, height: 40 }]) {
      const p = tourPosition(rect, width, height, 350);
      assert.ok(p.left >= 16 && p.top >= 16);
      assert.ok(p.left + p.width <= width - 16);
      assert.ok(p.top + Math.min(350, p.maxHeight) <= height - 16);
    }
  }
});
const roles = load('lib/admin-roles.ts');
const { dashboardLinksForRole } = load('lib/dashboard-links.ts', { '@/lib/admin-roles': roles });
test('platform and event owners get the requested shortcuts', () => {
  for (const role of ['owner', 'client']) {
    const links = dashboardLinksForRole(role);
    assert.equal(links.length, 14);
    assert.ok(links.some((link) => link.href === '/admin/reels'));
    assert.ok(links.some((link) => link.href === '/admin/event-day'));
  }
});
test('restricted organizers never receive owner-only shortcuts', () => {
  assert.equal(dashboardLinksForRole('session_organizer').length, 0);
  const links = dashboardLinksForRole('organizer');
  assert.ok(links.every((link) => ['/admin/invitees', '/admin/gallery', '/admin/timeline'].includes(link.href)));
});
const schedule = load('lib/schedule-fields.ts');
test('schedule details can change day, times and title without changing registration or pricing', async () => {
  let saved;
  const service = load('services/event-day.ts', {
    '@/lib/schedule-fields': schedule,
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ from: () => ({ update: (patch) => ({ eq: async (key, id) => { saved = { patch, key, id }; return { error: null }; } }) }) }) },
    '@/services/event-access': { canViewEvent: async () => true }, '@/services/abuse-guard': {}, '@/lib/tokens': {}, '@/services/admin-invitees': {},
  });
  await service.updateScheduleItem('session-1', { dayLabel: ' Saturday ', startLabel: ' 2 PM ', endLabel: '', title: ' Check in ', description: '' });
  assert.equal(saved.id, 'session-1');
  assert.equal(saved.patch.day_label, 'Saturday');
  assert.equal(saved.patch.start_label, '2 PM');
  assert.equal(saved.patch.end_label, null);
  assert.equal(saved.patch.title, 'Check in');
  assert.ok(!('regular_price' in saved.patch));
  assert.ok(!('requires_registration' in saved.patch));
});
test('schedule validation rejects empty titles and permits clearing the optional day', () => {
  assert.throws(() => schedule.normalizeScheduleDetails({ title: '   ' }));
  assert.throws(() => schedule.normalizeScheduleDetails({ startLabel: '' }));
  assert.throws(() => schedule.normalizeScheduleDetails({ dayLabel: 'x'.repeat(121) }));
  assert.equal(schedule.normalizeScheduleDetails({ dayLabel: '' }).dayLabel, null);
});
const env = { CASHFREE_APP_ID: 'test-app', CASHFREE_SECRET_KEY: 'test-secret', CASHFREE_ENVIRONMENT: 'sandbox' };
function cashfree(fetch = async () => { throw new Error('Unexpected network'); }, overrides = {}) {
  return load('lib/cashfree.ts', { '@/services/cashfree-settings': { cashfreeSettings: async () => ({ appId: env.CASHFREE_APP_ID, secretKey: env.CASHFREE_SECRET_KEY, environment: overrides.CASHFREE_ENVIRONMENT || env.CASHFREE_ENVIRONMENT }) } }, { process: { env: { ...env, ...overrides } }, fetch });
}
const rawBody = '{"amount":10.00,"status":"SUCCESS"}';
const timestamp = '1791496800000';
test('Cashfree signatures authenticate the original payload, not reserialized JSON', () => {
  const { verifyCashfreeWebhook } = cashfree();
  const signature = crypto.createHmac('sha256', env.CASHFREE_SECRET_KEY).update(timestamp + rawBody).digest('base64');
  assert.equal(verifyCashfreeWebhook(rawBody, timestamp, signature), true);
  assert.equal(verifyCashfreeWebhook(JSON.stringify(JSON.parse(rawBody)), timestamp, signature), false);
  assert.equal(verifyCashfreeWebhook(rawBody, timestamp, 'forged'), false);
  assert.equal(verifyCashfreeWebhook(rawBody, null, signature), false);
});
test('Cashfree requires matching order, amount, currency and paid status', () => {
  const { isCashfreeOrderPaid } = cashfree();
  const order = { order_id: 'em_order', order_status: 'PAID', order_currency: 'INR', order_amount: 10 };
  const expected = { orderId: 'em_order', amount: 10, currency: 'INR' };
  assert.equal(isCashfreeOrderPaid(order, expected), true);
  for (const bad of [{ order_status: 'ACTIVE' }, { order_amount: 9 }, { order_currency: 'USD' }, { order_id: 'other' }]) {
    assert.equal(isCashfreeOrderPaid({ ...order, ...bad }, expected), false);
  }
});
const input = { orderId: 'em_order', idempotencyKey: 'bfb263f3-d728-49eb-b7d4-7cdd4479ac6d', amount: 10, currency: 'INR', customerId: 'guest-1', customerPhone: '9999999999', returnUrl: 'https://everymoment.in/return' };
test('Cashfree defaults to sandbox and reuses the supplied idempotency key', async () => {
  let request;
  const client = cashfree(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ order_id: 'em_order', order_status: 'ACTIVE', order_currency: 'INR', order_amount: 10, payment_session_id: 'session' }) };
  }, { CASHFREE_ENVIRONMENT: undefined });
  await client.createCashfreeOrder(input);
  assert.match(request.url, /^https:\/\/sandbox.cashfree.com\/pg\/orders$/);
  assert.equal(request.options.headers['x-idempotency-key'], input.idempotencyKey);
  assert.equal(JSON.parse(request.options.body).order_amount, 10);
});
test('Cashfree rejects unsafe amounts, return URLs and invalid environments before requesting payment', async () => {
  const client = cashfree();
  await assert.rejects(client.createCashfreeOrder({ ...input, amount: -1 }));
  await assert.rejects(client.createCashfreeOrder({ ...input, returnUrl: 'https://other.example/pay' }));
  await assert.rejects(cashfree(undefined, { CASHFREE_ENVIRONMENT: 'prod' }).createCashfreeOrder(input), /environment/);
});
