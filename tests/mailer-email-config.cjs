/* eslint-disable @typescript-eslint/no-require-imports */
// Mailer → Email Configuration (Phase 1) — run with: node --test tests/mailer-email-config.cjs
// Supabase and the SMTP transport are replaced with in-memory fakes, so this runs offline.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const cache = new Map();
const stubs = new Map();

function resolveFile(rel) {
  for (const candidate of [rel, `${rel}.ts`, `${rel}.tsx`]) {
    const file = path.join(root, candidate);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  throw new Error(`Cannot resolve ${rel}`);
}

// Loads a .ts file (and its "@/..." imports) as CommonJS; "@/..." paths in `stubs` get the fake instead.
function load(rel) {
  if (stubs.has(rel)) return stubs.get(rel);
  const file = resolveFile(rel);
  if (cache.has(file)) return cache.get(file).exports;
  const m = new Module(file);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  cache.set(file, m);
  const req = m.require.bind(m);
  m.require = (name) => {
    if (name === 'server-only') return {};
    return name.startsWith('@/') ? load(name.slice(2)) : req(name);
  };
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  m._compile(out, file);
  return m.exports;
}

// ---------------------------------------------------------------------------
// Fakes

/** A tiny in-memory stand-in for the supabase-js query builder (only what the store uses). */
function fakeSupabase() {
  const tables = {};
  let tick = 0;
  // Real clock (the hourly limits compare against "now"), nudged forward so ordering is stable.
  const stamp = () => new Date(Date.now() + (tick += 1)).toISOString();
  class Query {
    constructor(table) {
      this.table = table;
      this.op = 'select';
      this.filters = [];
      this.orders = [];
      this.cols = '*';
      this.opts = {};
    }
    select(cols = '*', opts = {}) { if (this.op === 'select') { this.cols = cols; this.opts = opts; } return this; }
    insert(payload) { this.op = 'insert'; this.payload = payload; return this; }
    update(payload) { this.op = 'update'; this.payload = payload; return this; }
    upsert(payload) { this.op = 'upsert'; this.payload = payload; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
    neq(c, v) { this.filters.push((r) => r[c] !== v); return this; }
    in(c, vs) { this.filters.push((r) => vs.includes(r[c])); return this; }
    gte(c, v) { this.filters.push((r) => r[c] >= v); return this; }
    order(c, o = {}) { this.orders.push([c, o.ascending !== false]); return this; }
    limit(n) { this.max = n; return this; }
    maybeSingle() { this.single = true; return this; }
    then(resolve, reject) { return Promise.resolve().then(() => this.run()).then(resolve, reject); }
    run() {
      const rows = (tables[this.table] ||= []);
      const match = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === 'insert') { rows.push({ id: rows.length + 1, created_at: stamp(), ...structuredClone(this.payload) }); return { data: null, error: null }; }
      if (this.op === 'update') { for (const r of match) Object.assign(r, structuredClone(this.payload)); return { data: null, error: null }; }
      if (this.op === 'delete') {
        tables[this.table] = rows.filter((r) => !match.includes(r));
        if (this.table === 'mailer_email_configs') { // ON DELETE CASCADE
          const gone = new Set(match.map((r) => r.id));
          tables.mailer_email_config_secrets = (tables.mailer_email_config_secrets || []).filter((s) => !gone.has(s.config_id));
        }
        return { data: null, error: null };
      }
      if (this.op === 'upsert') {
        const existing = rows.find((r) => r.config_id === this.payload.config_id);
        if (existing) Object.assign(existing, structuredClone(this.payload)); else rows.push(structuredClone(this.payload));
        return { data: null, error: null };
      }
      if (this.opts.head) return { data: null, count: match.length, error: null };
      let out = [...match];
      for (const [c, asc] of [...this.orders].reverse()) out.sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1));
      if (this.max !== undefined) out = out.slice(0, this.max);
      const cols = this.cols.split(',').map((c) => c.trim());
      out = out.map((r) => (this.cols === '*' ? structuredClone(r) : Object.fromEntries(cols.map((c) => [c, structuredClone(r[c] ?? null)]))));
      return { data: this.single ? out[0] ?? null : out, error: null };
    }
  }
  return { tables, client: { from: (t) => new Query(t) }, stamp };
}

const db = fakeSupabase();
// created_at / updated_at defaults the real tables would fill in.
const realFrom = db.client.from;
db.client.from = (t) => {
  const q = realFrom(t);
  const insert = q.insert.bind(q);
  q.insert = (p) => insert({ created_at: db.stamp(), ...p });
  return q;
};

class FakeDeliveryError extends Error {
  constructor(safe) { super(safe.message); this.safe = safe; }
}
const smtpCalls = [];
let sendFailure = null;
stubs.set('lib/supabase/admin', { supabaseAdmin: () => db.client });
stubs.set('services/mailer-email-config/transport', {
  EmailDeliveryError: FakeDeliveryError,
  async createSmtpTransport(settings) {
    return {
      async verify() {
        smtpCalls.push({ type: 'verify', settings });
        if (settings.auth && settings.auth.pass.startsWith('wrong')) {
          // Like a real server reply: echoes details we must never pass on.
          const { sanitizeSmtpError } = load('lib/mailer/email-config/smtp-errors');
          throw new FakeDeliveryError(sanitizeSmtpError({ code: 'EAUTH', responseCode: 535, message: `535 auth failed for ${settings.auth.user} pass=${settings.auth.pass}` }, settings));
        }
      },
      async send(email) {
        smtpCalls.push({ type: 'send', settings, email });
        if (sendFailure) throw new FakeDeliveryError(sendFailure);
        return { messageId: `<test-${smtpCalls.length}@fake>` };
      },
      close() {},
    };
  },
});
stubs.set('services/mailer-email-config/dns-check', {
  async checkDomain(domain) {
    const ok = { status: 'verified', detail: 'ok', record: 'v=x' };
    return { domain, spf: ok, dkim: ok, dmarc: ok, overall: 'verified', checkedAt: new Date().toISOString() };
  },
});
let currentAdmin = null;
stubs.set('services/admin-auth', { getCurrentAdmin: async () => currentAdmin });

process.env.MAILER_CREDENTIAL_ENCRYPTION_KEY = 'test-key-0123456789-abcdefghijklmnopqrstuvwxyz';
delete process.env.MAILER_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS;

const { validateEmailConfig } = load('lib/mailer/email-config/validation');
const { emailConfigState, canSendWith, changeResetsVerification } = load('lib/mailer/email-config/status');
const { evaluateSpf, evaluateDmarc, evaluateDkim, overallDomainStatus } = load('lib/mailer/email-config/dns-evaluate');
const { sanitizeSmtpError } = load('lib/mailer/email-config/smtp-errors');
const { credentialKeysFromEnv, encryptCredential, decryptCredential, needsReencryption } = load('services/mailer-email-config/secret-box');
const { isPublicAddress } = load('services/mailer-email-config/network');
const store = load('services/mailer-email-config/store');
const actions = load('features/mailer/email-config/actions');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

function input(overrides = {}) {
  return {
    label: 'HR greetings', provider: 'google', senderName: 'ABC Technologies HR Team', fromEmail: 'greetings@abc.example',
    replyToEmail: 'hr@abc.example', replyToName: 'HR Team', smtpHost: 'smtp.gmail.com', smtpPort: 465, encryption: 'ssl',
    smtpUsername: 'greetings@abc.example', authEnabled: true, newPassword: 'a-secret-pass', dkimSelector: 'google',
    isDefault: false, sendingEnabled: true, ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure rules

test('validation accepts a good configuration and normalises it', () => {
  const r = validateEmailConfig(input({ fromEmail: ' Greetings@ABC.example ', smtpHost: 'SMTP.Gmail.com.' }), { hasStoredPassword: false });
  assert.equal(r.ok, true);
  assert.equal(r.value.fromEmail, 'greetings@abc.example');
  assert.equal(r.value.smtpHost, 'smtp.gmail.com');
  assert.equal(r.value.newPassword, 'a-secret-pass');
});

test('validation rejects header injection, IPs/URLs, bad ports and port/encryption mismatches', () => {
  const bad = (o, field, opts = { hasStoredPassword: false }) => {
    const r = validateEmailConfig(input(o), opts);
    assert.equal(r.ok, false, JSON.stringify(o));
    assert.equal(r.field, field);
  };
  bad({ senderName: 'HR\r\nBcc: everyone@x.example' }, 'senderName');
  bad({ replyToName: 'x\ny' }, 'replyToName');
  bad({ smtpHost: '169.254.169.254' }, 'smtpHost');
  bad({ smtpHost: 'https://smtp.gmail.com' }, 'smtpHost');
  bad({ smtpHost: 'localhost' }, 'smtpHost');
  bad({ smtpPort: 22 }, 'smtpPort');
  bad({ smtpPort: 587, encryption: 'ssl' }, 'encryption');
  bad({ fromEmail: 'not-an-email' }, 'fromEmail');
  bad({ newPassword: '' }, 'newPassword');
  bad({ authEnabled: false }, 'authEnabled'); // Google needs a login
  bad({ smtpUsername: '' }, 'smtpUsername');
  // An empty password keeps the stored one.
  const keep = validateEmailConfig(input({ newPassword: '   ' }), { hasStoredPassword: true });
  assert.equal(keep.ok, true);
  assert.equal(keep.value.newPassword, null);
  // Only a custom server may skip authentication.
  const relay = validateEmailConfig(input({ provider: 'custom', smtpHost: 'relay.abc.example', smtpPort: 587, encryption: 'starttls', authEnabled: false, newPassword: '', smtpUsername: '' }), { hasStoredPassword: false });
  assert.equal(relay.ok, true);
  assert.equal(relay.value.smtpUsername, null);
});

test('verified is earned step by step, and campaigns are blocked until a test email passed', () => {
  const base = { authEnabled: true, smtpUsername: 'u', hasPassword: true, connectionStatus: 'untested', verifiedAt: null, domainCheck: null, sendingEnabled: true };
  assert.equal(emailConfigState({ ...base, hasPassword: false }), 'incomplete');
  assert.equal(emailConfigState(base), 'untested');
  assert.equal(emailConfigState({ ...base, connectionStatus: 'failed' }), 'connection_failed');
  assert.equal(emailConfigState({ ...base, connectionStatus: 'ok' }), 'connection_ok');
  assert.equal(emailConfigState({ ...base, connectionStatus: 'ok', verifiedAt: 'x' }), 'domain_pending');
  assert.equal(emailConfigState({ ...base, connectionStatus: 'ok', verifiedAt: 'x', domainCheck: { overall: 'verified' } }), 'verified');
  assert.equal(canSendWith(base).ok, false);
  assert.equal(canSendWith({ ...base, connectionStatus: 'ok' }).ok, false);
  assert.equal(canSendWith({ ...base, connectionStatus: 'ok', verifiedAt: 'x' }).ok, true);
  assert.equal(canSendWith({ ...base, connectionStatus: 'ok', verifiedAt: 'x', sendingEnabled: false }).ok, false);
  const clean = validateEmailConfig(input(), { hasStoredPassword: false }).value;
  assert.equal(changeResetsVerification(clean, { ...clean, senderName: 'Other' }, false), false);
  assert.equal(changeResetsVerification(clean, { ...clean, smtpHost: 'smtp.other.example' }, false), true);
  assert.equal(changeResetsVerification(clean, clean, true), true);
});

test('SPF, DKIM and DMARC are judged from DNS, honestly', () => {
  assert.equal(evaluateSpf([], '_spf.google.com').status, 'not_configured');
  assert.equal(evaluateSpf(['v=spf1 include:_spf.google.com ~all'], '_spf.google.com').status, 'verified');
  assert.equal(evaluateSpf(['v=spf1 include:other.example ~all'], '_spf.google.com').status, 'issue');
  assert.equal(evaluateSpf(['v=spf1 -all', 'v=spf1 include:_spf.google.com ~all'], '_spf.google.com').status, 'issue');
  assert.equal(evaluateSpf(['v=spf1 +all'], null).status, 'issue');
  assert.equal(evaluateSpf(['google-site-verification=x', 'v=spf1 ip4:1.2.3.4 -all'], null).status, 'pending');
  assert.equal(evaluateDmarc([]).status, 'not_configured');
  assert.equal(evaluateDmarc(['v=DMARC1; p=reject; rua=mailto:x@y.example']).status, 'verified');
  assert.equal(evaluateDmarc(['v=DMARC1; rua=mailto:x@y.example']).status, 'issue');
  assert.equal(evaluateDkim(null, null).status, 'pending');
  assert.equal(evaluateDkim([], 'google').status, 'not_configured');
  assert.equal(evaluateDkim(['v=DKIM1; k=rsa; p=MIIBIjANBgkq'], 'google').status, 'verified');
  assert.equal(evaluateDkim(['v=DKIM1; k=rsa; p='], 'google').status, 'issue');
  const v = { status: 'verified' };
  assert.equal(overallDomainStatus(v, v, v), 'verified');
  assert.equal(overallDomainStatus(v, { status: 'pending' }, v), 'pending');
  assert.equal(overallDomainStatus({ status: 'not_configured' }, { status: 'issue' }, v), 'issue');
});

test('SMTP errors become our own wording — never the server text, which can echo credentials', () => {
  const ctx = { host: 'smtp.abc.example', port: 587 };
  const auth = sanitizeSmtpError({ code: 'EAUTH', responseCode: 535, message: '535 5.7.8 bad login user=hr@abc.example pass=hunter2' }, ctx);
  assert.equal(auth.kind, 'auth');
  assert.equal(auth.retryable, false);
  assert.ok(!auth.message.includes('hunter2') && !auth.message.includes('hr@abc.example'));
  assert.match(auth.message, /SMTP 535/);
  assert.equal(sanitizeSmtpError({ code: 'ESOCKET', message: 'connect ECONNREFUSED 1.2.3.4:587' }, ctx).kind, 'connect');
  assert.equal(sanitizeSmtpError({ code: 'ETIMEDOUT', message: 'Greeting never received' }, ctx).retryable, true);
  assert.equal(sanitizeSmtpError({ code: 'ESOCKET', message: 'ssl3_get_record:wrong version number' }, ctx).kind, 'tls');
  assert.equal(sanitizeSmtpError({ code: 'EENVELOPE', responseCode: 553, command: 'MAIL FROM' }, ctx).kind, 'sender_rejected');
  assert.equal(sanitizeSmtpError({ responseCode: 451, message: 'try later' }, ctx).retryable, true);
  assert.ok(!sanitizeSmtpError(new Error('totally unknown pass=hunter2'), ctx).message.includes('hunter2'));
});

test('credentials are encrypted, bound to their company + config, and support key rotation', () => {
  const keys = credentialKeysFromEnv();
  assert.ok(keys);
  assert.equal(credentialKeysFromEnv({ MAILER_CREDENTIAL_ENCRYPTION_KEY: 'too-short' }), null);
  const bindA = { tenantId: A, configId: 'c1' };
  const { ciphertext } = encryptCredential('a-secret-pass', bindA, keys);
  assert.ok(!ciphertext.includes('a-secret-pass'));
  assert.notEqual(encryptCredential('a-secret-pass', bindA, keys).ciphertext, ciphertext); // random IV
  assert.equal(decryptCredential(ciphertext, bindA, keys), 'a-secret-pass');
  assert.throws(() => decryptCredential(ciphertext, { tenantId: B, configId: 'c1' }, keys), /can't be read/);
  assert.throws(() => decryptCredential(ciphertext, { tenantId: A, configId: 'c2' }, keys), /can't be read/);
  // Rotation: the old key keeps working as "previous", and is flagged for re-encryption.
  const rotated = credentialKeysFromEnv({
    MAILER_CREDENTIAL_ENCRYPTION_KEY: 'brand-new-key-0123456789-abcdefghijklmnopqrstuv',
    MAILER_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS: process.env.MAILER_CREDENTIAL_ENCRYPTION_KEY,
  });
  assert.equal(decryptCredential(ciphertext, bindA, rotated), 'a-secret-pass');
  assert.equal(needsReencryption(ciphertext, rotated), true);
  assert.equal(needsReencryption(ciphertext, keys), false);
  const withoutOld = credentialKeysFromEnv({ MAILER_CREDENTIAL_ENCRYPTION_KEY: 'brand-new-key-0123456789-abcdefghijklmnopqrstuv' });
  assert.throws(() => decryptCredential(ciphertext, bindA, withoutOld), /can't be read/);
});

test('the SMTP host can never point at private, loopback or metadata addresses', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  for (const ip of ['142.250.4.108', '52.97.1.1', '2607:f8b0:4004:c1b::6c', '::ffff:8.8.8.8']) assert.equal(isPublicAddress(ip), true, ip);
  assert.equal(isPublicAddress('not-an-ip'), false);
});

// ---------------------------------------------------------------------------
// Store: tenant isolation, secrets, verification flow (acceptance criteria 1–11)

test('two companies keep separate configurations, and neither can see or use the other\'s', async () => {
  const a = await store.saveEmailConfig(A, A, input());
  const b = await store.saveEmailConfig(B, B, input({ label: 'B sales', fromEmail: 'hello@b.example', smtpUsername: 'hello@b.example', newPassword: 'b-secret-pass' }));

  // 1–2: each company configured, first config becomes the default.
  assert.equal(a.isDefault, true);
  assert.equal(b.isDefault, true);
  assert.equal(a.hasPassword, true);

  // 3 + 10: lists are per company and never contain a password or ciphertext.
  const listA = await store.listEmailConfigs(A);
  assert.deepEqual(listA.map((c) => c.id), [a.id]);
  const shown = JSON.stringify([listA, await store.listEmailConfigs(B)]);
  assert.ok(!shown.includes('a-secret-pass') && !shown.includes('b-secret-pass') && !shown.includes('v1:'));
  // Stored ciphertext isn't the password.
  assert.ok(!JSON.stringify(db.tables.mailer_email_config_secrets).includes('secret-pass'));

  // Company A can't test, email from, change or delete B's config by id.
  await assert.rejects(store.testEmailConfigConnection(A, A, b.id), /doesn't exist/);
  await assert.rejects(store.sendEmailConfigTestEmail(A, A, b.id, 'x@a.example'), /doesn't exist/);
  await assert.rejects(store.saveEmailConfig(A, A, input({ label: 'hijack' }), b.id), /doesn't exist/);
  await assert.rejects(store.deleteEmailConfig(A, A, b.id), /doesn't exist/);
  assert.equal((await store.listEmailConfigs(B))[0].label, 'B sales');

  // A copied ciphertext doesn't open under another company's row.
  const secrets = db.tables.mailer_email_config_secrets;
  const secretA = secrets.find((s) => s.config_id === a.id);
  const secretB = secrets.find((s) => s.config_id === b.id);
  const original = secretA.password_ciphertext;
  secretA.password_ciphertext = secretB.password_ciphertext;
  const swapped = await store.testEmailConfigConnection(A, A, a.id);
  assert.equal(swapped.ok, false);
  assert.match(swapped.message, /can't be read/);
  assert.ok(!smtpCalls.some((c) => c.settings.auth && c.settings.auth.pass === 'b-secret-pass'));
  secretA.password_ciphertext = original;
});

test('saving never verifies; a connection test and an accepted test email do, with the right company identity', async () => {
  const [a] = await store.listEmailConfigs(A);
  // Re-save so the earlier failed swap test is cleared.
  const fresh = await store.saveEmailConfig(A, A, input({ smtpHost: 'smtp.googlemail.com', newPassword: '' }), a.id);
  assert.equal(fresh.connectionStatus, 'untested');
  assert.equal(fresh.verifiedAt, null);
  assert.equal(canSendWith(fresh).ok, false); // 11: blocked until verified

  const test1 = await store.testEmailConfigConnection(A, A, a.id);
  assert.equal(test1.ok, true);
  assert.equal(test1.config.connectionStatus, 'ok');
  assert.equal(test1.config.verifiedAt, null); // a login alone isn't "verified"
  const verify = smtpCalls.filter((c) => c.type === 'verify').at(-1);
  assert.deepEqual(verify.settings.auth, { user: 'greetings@abc.example', pass: 'a-secret-pass' });

  const sent = await store.sendEmailConfigTestEmail(A, A, a.id, 'Boss@ABC.example');
  assert.equal(sent.ok, true);
  assert.ok(sent.messageId);
  assert.ok(sent.config.verifiedAt);
  assert.equal(canSendWith(sent.config).ok, true);
  const mail = smtpCalls.filter((c) => c.type === 'send').at(-1).email;
  assert.deepEqual(mail.from, { name: 'ABC Technologies HR Team', address: 'greetings@abc.example' }); // 6: company identity
  assert.deepEqual(mail.replyTo, { name: 'HR Team', address: 'hr@abc.example' });
  assert.equal(mail.to, 'boss@abc.example');

  // Changing a sender detail that doesn't affect delivery keeps verification; changing the server resets it.
  const renamed = await store.saveEmailConfig(A, A, input({ smtpHost: 'smtp.googlemail.com', senderName: 'ABC HR', newPassword: '' }), a.id);
  assert.ok(renamed.verifiedAt);
  const moved = await store.saveEmailConfig(A, A, input({ smtpHost: 'smtp.gmail.com', senderName: 'ABC HR', newPassword: '' }), a.id);
  assert.equal(moved.verifiedAt, null);
  assert.equal(moved.connectionStatus, 'untested');

  // Domain status only comes from the DNS check.
  assert.equal(moved.domainCheck, null);
  const checked = await store.checkEmailConfigDomain(A, A, a.id);
  assert.equal(checked.domainCheck.overall, 'verified');
});

test('bad credentials give a meaningful error that never contains the password; failures are recorded', async () => {
  const [a] = await store.listEmailConfigs(A);
  await store.saveEmailConfig(A, A, input({ newPassword: 'wrong-pass-123' }), a.id);
  const result = await store.testEmailConfigConnection(A, A, a.id);
  assert.equal(result.ok, false);
  assert.match(result.message, /rejected the username or password/);
  assert.ok(!result.message.includes('wrong-pass-123'));
  assert.equal(result.config.connectionStatus, 'failed');
  assert.equal(result.config.connectionError, result.message);

  sendFailure = sanitizeSmtpError({ code: 'EENVELOPE', responseCode: 553, command: 'MAIL FROM' }, { host: 'h', port: 587 });
  await store.saveEmailConfig(A, A, input({ newPassword: 'a-secret-pass' }), a.id);
  const failedSend = await store.sendEmailConfigTestEmail(A, A, a.id, 'boss@abc.example');
  sendFailure = null;
  assert.equal(failedSend.ok, false);
  assert.equal(failedSend.config.verifiedAt, null);
  assert.match(failedSend.message, /refused the From address/);

  // Nothing secret in the audit trail either.
  const audit = JSON.stringify(db.tables.mailer_email_audit_logs);
  assert.ok(!audit.includes('secret-pass') && !audit.includes('wrong-pass'));
  assert.ok(db.tables.mailer_email_audit_logs.some((l) => l.tenant_user_id === A && l.action === 'config.updated' && l.details.password_replaced === true));
});

test('test emails are rate-limited per company', async () => {
  const [b] = await store.listEmailConfigs(B);
  const already = db.tables.mailer_email_audit_logs.filter((l) => l.tenant_user_id === B && l.action === 'test_email.sent').length;
  for (let i = already; i < store.TEST_EMAILS_PER_HOUR; i += 1) await store.sendEmailConfigTestEmail(B, B, b.id, 'me@b.example');
  await assert.rejects(store.sendEmailConfigTestEmail(B, B, b.id, 'me@b.example'), /limit of 10 test emails/);
  // Company A's allowance is separate.
  const [a] = await store.listEmailConfigs(A);
  assert.equal((await store.sendEmailConfigTestEmail(A, A, a.id, 'boss@abc.example')).ok, true);
});

test('only one default per company, and deleting the default hands it on', async () => {
  const second = await store.saveEmailConfig(A, A, input({ label: 'Events', fromEmail: 'events@abc.example', isDefault: true }));
  let list = await store.listEmailConfigs(A);
  assert.equal(list.filter((c) => c.isDefault).length, 1);
  assert.equal(list.find((c) => c.isDefault).id, second.id);
  await store.deleteEmailConfig(A, A, second.id);
  list = await store.listEmailConfigs(A);
  assert.equal(list.length, 1);
  assert.equal(list[0].isDefault, true);
  assert.ok(!db.tables.mailer_email_config_secrets.some((s) => s.config_id === second.id)); // secret removed with it
});

test('only the company admin account (client) or the owner can use the actions', async () => {
  currentAdmin = null;
  assert.equal((await actions.listEmailConfigsAction()).success, false);
  for (const role of ['organizer', 'session_organizer', 'reviewer']) {
    currentAdmin = { id: A, email: 'x@abc.example', role };
    const r = await actions.saveEmailConfigAction(input());
    assert.equal(r.success, false, role);
    assert.match(r.error, /Only the company's admin account/);
  }
  currentAdmin = { id: B, email: 'b@b.example', role: 'client' };
  const own = await actions.listEmailConfigsAction();
  assert.equal(own.success, true);
  assert.ok(own.data.every((c) => c.fromEmail.endsWith('@b.example')));
  // The id from the browser is checked against the signed-in company.
  const [a] = await store.listEmailConfigs(A);
  const cross = await actions.testEmailConfigConnectionAction(a.id);
  assert.equal(cross.success, false);
  assert.equal((await actions.testEmailConfigConnectionAction('not-a-uuid')).success, false);
  currentAdmin = null;
});
