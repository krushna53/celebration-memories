/* eslint-disable @typescript-eslint/no-require-imports */
// Shared Resend email service (lib/resend.ts).
// Run with: node --test tests/resend.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const cache = new Map();

function load(rel) {
  let file = null;
  for (const candidate of [rel, `${rel}.ts`, `${rel}.tsx`]) {
    const f = path.join(root, candidate);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) file = f;
  }
  if (!file) throw new Error(`Cannot resolve ${rel}`);
  if (cache.has(file)) return cache.get(file).exports;
  const m = new Module(file);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  cache.set(file, m);
  const req = m.require.bind(m);
  m.require = (name) => (name === 'server-only' ? {} : name.startsWith('@/') ? load(name.slice(2)) : req(name));
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  m._compile(out, file);
  return m.exports;
}

const R = () => load('lib/resend');
const LIVE = { EMAIL_DELIVERY_MODE: 'live', RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'EveryMoment <hello@mail.example.com>' };

function fakeClient(reply) {
  const calls = [];
  return {
    calls,
    emails: {
      async send(payload, options) {
        calls.push({ payload, options });
        if (typeof reply === 'function') return reply(payload, options);
        return reply;
      },
    },
  };
}

test('sends HTML + text with to, cc, bcc and reply-to, and returns the Resend id', async () => {
  const client = fakeClient({ data: { id: 'email_123' }, error: null });
  const result = await R().sendEmail(
    {
      to: ['Priya <priya@x.example>', 'arjun@x.example', 'PRIYA@x.example'],
      cc: 'hr@x.example',
      bcc: ['audit@x.example'],
      replyTo: 'host@x.example',
      subject: '  Happy birthday  ',
      html: '<p>Hi</p>',
      text: 'Hi',
      tags: [{ name: 'type', value: 'birthday' }],
      idempotencyKey: 'birthday:priya:2026',
    },
    { env: LIVE, client },
  );
  assert.deepEqual(result, { success: true, id: 'email_123', mode: 'live' });
  const { payload, options } = client.calls[0];
  assert.deepEqual(payload.to, ['Priya <priya@x.example>', 'arjun@x.example'], 'duplicates (any case) are dropped');
  assert.deepEqual(payload.cc, ['hr@x.example']);
  assert.deepEqual(payload.bcc, ['audit@x.example']);
  assert.deepEqual(payload.replyTo, ['host@x.example']);
  assert.equal(payload.subject, 'Happy birthday');
  assert.equal(payload.from, 'EveryMoment <hello@mail.example.com>');
  assert.equal(payload.text, 'Hi');
  assert.deepEqual(options, { idempotencyKey: 'birthday:priya:2026' });
});

test('bad input is refused before anything is sent', async () => {
  const client = fakeClient({ data: { id: 'x' }, error: null });
  const send = (input) => R().sendEmail({ to: 'a@x.example', subject: 'Hi', html: '<p>x</p>', ...input }, { env: LIVE, client });
  for (const [input, message] of [
    [{ to: 'not-an-email' }, /isn't a valid email/],
    [{ to: [] }, /at least one/],
    [{ cc: ['ok@x.example', 'bad@'] }, /CC/],
    [{ subject: '   ' }, /subject/],
    [{ subject: 'Hi\r\nBcc: evil@x.example' }, /line breaks/],
    [{ html: '', text: '' }, /body/],
    [{ from: 'nobody' }, /From/],
    [{ headers: { 'X-Bad': 'a\r\nb' } }, /Header/],
    [{ to: Array.from({ length: 51 }, (_, i) => `p${i}@x.example`) }, /at most 50/],
  ]) {
    const result = await send(input);
    assert.equal(result.success, false);
    assert.equal(result.code, 'invalid_input');
    assert.equal(result.retryable, false);
    assert.match(result.error, message);
  }
  assert.equal(client.calls.length, 0);
});

test('Resend errors are mapped, and only temporary ones are retryable', async () => {
  const run = (name) =>
    R().sendEmail({ to: 'a@x.example', subject: 'Hi', text: 'x' }, { env: LIVE, client: fakeClient({ data: null, error: { name, message: `msg ${name}` } }) });
  assert.deepEqual(await run('rate_limit_exceeded'), { success: false, error: 'msg rate_limit_exceeded', code: 'rate_limited', retryable: true });
  assert.equal((await run('internal_server_error')).retryable, true);
  assert.deepEqual(await run('validation_error'), { success: false, error: 'msg validation_error', code: 'rejected', retryable: false });
  assert.equal((await run('invalid_api_Key')).code, 'not_configured');

  const thrown = await R().sendEmail(
    { to: 'a@x.example', subject: 'Hi', text: 'x' },
    { env: LIVE, client: fakeClient(() => { throw new Error('ECONNRESET'); }) },
  );
  assert.equal(thrown.code, 'network_error');
  assert.equal(thrown.retryable, true);

  const noId = await R().sendEmail({ to: 'a@x.example', subject: 'Hi', text: 'x' }, { env: LIVE, client: fakeClient({ data: null, error: null }) });
  assert.equal(noId.success, false, 'never reported as sent without an id from Resend');
});

test('test mode sends nothing; dev defaults to test mode, production to live', async () => {
  const { sendEmail, emailDeliveryMode, testOutbox } = R();
  assert.equal(emailDeliveryMode({ NODE_ENV: 'development' }), 'test');
  assert.equal(emailDeliveryMode({ NODE_ENV: 'production' }), 'live');
  assert.equal(emailDeliveryMode({ NODE_ENV: 'development', EMAIL_DELIVERY_MODE: 'live' }), 'live');
  assert.equal(emailDeliveryMode({ NODE_ENV: 'production', EMAIL_DELIVERY_MODE: 'test' }), 'test');

  const client = fakeClient({ data: { id: 'x' }, error: null });
  const result = await sendEmail({ to: 'a@x.example', subject: 'Hi', text: 'x' }, { env: { EMAIL_DELIVERY_MODE: 'test' }, client });
  assert.equal(result.success, true);
  assert.equal(result.mode, 'test');
  assert.match(result.id, /^test_/);
  assert.equal(client.calls.length, 0);
  assert.equal(testOutbox.at(-1).id, result.id);
});

test('live mode without an API key is "not configured", and logs never show full addresses', async () => {
  const { sendEmail, maskEmail, emailAddressOf } = R();
  const result = await sendEmail({ to: 'a@x.example', subject: 'Hi', text: 'x' }, { env: { EMAIL_DELIVERY_MODE: 'live' } });
  assert.equal(result.code, 'not_configured');
  assert.equal(maskEmail('rahul.sharma@example.com'), 'r***@example.com');
  assert.equal(maskEmail('Rahul <rahul@example.com>'), 'r***@example.com');
  assert.equal(emailAddressOf('"Sharma, Rahul" <rahul@example.com>'), 'rahul@example.com');
  assert.equal(emailAddressOf('rahul@example'), null);
});
