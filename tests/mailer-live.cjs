/* eslint-disable @typescript-eslint/no-require-imports */
// Event Mailer live mode (pure parts) — run with: node --test tests/mailer-live.cjs
// The Firestore + sending flow needs a real Firebase project and is checked separately.
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

const env = { MAILER_CREDENTIAL_ENCRYPTION_KEY: 'test-key-that-is-at-least-32-characters-long' };

test('unsubscribe tokens round-trip and refuse tampering, other keys and short keys', () => {
  const { createUnsubscribeToken, verifyUnsubscribeToken } = load('services/mailer/unsubscribe-token');
  const token = createUnsubscribeToken('tenant-a', 'contact-1', env);
  assert.deepEqual(verifyUnsubscribeToken(token, env), { tenantId: 'tenant-a', contactId: 'contact-1' });

  // Swap the payload for another contact but keep the signature.
  const forged = `${Buffer.from('tenant-a:contact-2').toString('base64url')}.${token.split('.')[1]}`;
  assert.equal(verifyUnsubscribeToken(forged, env), null);
  assert.equal(verifyUnsubscribeToken(`${token}x`, env), null);
  assert.equal(verifyUnsubscribeToken(`${token}.extra`, env), null);
  assert.equal(verifyUnsubscribeToken(token, { MAILER_CREDENTIAL_ENCRYPTION_KEY: 'a-completely-different-key-32-chars-or-more' }), null);
  assert.equal(verifyUnsubscribeToken(42, env), null);
  assert.equal(createUnsubscribeToken('t', 'c', { MAILER_CREDENTIAL_ENCRYPTION_KEY: 'short' }), null);
});

test('rendered emails carry the unsubscribe link in HTML and plain text; previews keep a placeholder', () => {
  const { renderEmail } = load('lib/mailer/email-html');
  const { tokenValuesFor } = load('lib/mailer/tokens');
  const content = { subject: 'Hi {{first_name}}', preheader: '', body: 'Hello {{first_name}},\n\nSee you there.', ctaLabel: 'RSVP', ctaUrl: 'https://example.com/rsvp' };
  const values = tokenValuesFor({ firstName: 'Priya', lastName: 'S', email: 'p@x.example', company: '' }, null, 'ABC HR');
  const url = 'http://localhost:3000/mailer/unsubscribe?t=abc.def';

  const live = renderEmail('announcement', content, values, { unsubscribeUrl: url });
  assert.equal(live.subject, 'Hi Priya');
  assert.ok(live.html.includes('href="http://localhost:3000/mailer/unsubscribe?t=abc.def"'));
  assert.ok(live.text.includes('Hello Priya,'));
  assert.ok(live.text.includes('RSVP: https://example.com/rsvp'));
  assert.ok(live.text.includes(`Unsubscribe: ${url}`));

  const preview = renderEmail('announcement', content, values);
  assert.ok(preview.html.includes('href="#"'));
  assert.ok(!preview.text.includes('Unsubscribe:'));

  const unsafe = renderEmail('announcement', content, values, { unsubscribeUrl: 'javascript:alert(1)' });
  assert.ok(!unsafe.html.includes('javascript:'));
});

test('the local Mailpit provider is only accepted when allowed, and only for 127.0.0.1:1025 without TLS', () => {
  const { validateEmailConfig } = load('lib/mailer/email-config/validation');
  const { localSmtpAllowed } = load('lib/mailer/email-config/local-smtp');
  const local = { label: 'Mailpit', provider: 'local', senderName: 'Test Mailer', fromEmail: 'test@localhost', replyToEmail: '', replyToName: '',
    smtpHost: '127.0.0.1', smtpPort: 1025, encryption: 'none', smtpUsername: '', authEnabled: false, newPassword: '', dkimSelector: '', isDefault: true, sendingEnabled: true };

  const ok = validateEmailConfig(local, { hasStoredPassword: false, allowLocalSmtp: true });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.fromEmail, 'test@localhost');

  assert.equal(validateEmailConfig(local, { hasStoredPassword: false }).field, 'provider');
  assert.equal(validateEmailConfig({ ...local, smtpHost: '10.0.0.5' }, { hasStoredPassword: false, allowLocalSmtp: true }).field, 'smtpHost');
  assert.equal(validateEmailConfig({ ...local, smtpPort: 587 }, { hasStoredPassword: false, allowLocalSmtp: true }).field, 'smtpPort');
  assert.equal(validateEmailConfig({ ...local, encryption: 'starttls' }, { hasStoredPassword: false, allowLocalSmtp: true }).field, 'encryption');

  // Other providers never get the exception, even when local SMTP is allowed.
  const custom = { ...local, provider: 'custom', fromEmail: 'a@b.example' };
  assert.equal(validateEmailConfig(custom, { hasStoredPassword: false, allowLocalSmtp: true }).field, 'smtpHost');
  assert.equal(validateEmailConfig({ ...custom, smtpHost: 'smtp.b.example' }, { hasStoredPassword: false, allowLocalSmtp: true }).field, 'smtpPort');
  assert.equal(validateEmailConfig({ ...custom, smtpHost: 'smtp.b.example', smtpPort: 587 }, { hasStoredPassword: false, allowLocalSmtp: true }).field, 'encryption');

  assert.equal(localSmtpAllowed({ NODE_ENV: 'development', MAILER_ALLOW_LOCAL_SMTP: 'true' }), true);
  assert.equal(localSmtpAllowed({ NODE_ENV: 'production', MAILER_ALLOW_LOCAL_SMTP: 'true' }), false);
  assert.equal(localSmtpAllowed({ NODE_ENV: 'development' }), false);
});

test('queued recipients are not counted as sent', () => {
  const { campaignStats } = load('lib/mailer/stats');
  const r = (status) => ({ contactId: status, email: `${status}@x.example`, name: '', status, providerMessageId: null, error: null, events: [] });
  const stats = campaignStats([r('queued'), r('sent'), r('failed'), r('queued')]);
  assert.equal(stats.recipients, 4);
  assert.equal(stats.sent, 1);
  assert.equal(stats.failed, 1);
});
