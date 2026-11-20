/* eslint-disable @typescript-eslint/no-require-imports */
// Corporate Event Mailer (mock mode) — run with: node --test tests/mailer.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const cache = new Map();
// Loads a .ts file (and its "@/..." imports) as CommonJS, so the real modules are tested together.
function load(rel) {
  const file = path.join(root, rel.endsWith('.ts') ? rel : `${rel}.ts`);
  if (cache.has(file)) return cache.get(file).exports;
  const m = new Module(file);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  cache.set(file, m);
  const req = m.require.bind(m);
  m.require = (name) => (name.startsWith('@/') ? load(name.slice(2)) : req(name));
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  m._compile(out, file);
  return m.exports;
}

const { isValidEmail, normalizeEmail } = load('lib/mailer/email');
const { analyzeContactCsv } = load('lib/mailer/csv-import');
const { renderTokens, tokenValuesFor, unknownTokens, formatMailerDate } = load('lib/mailer/tokens');
const { renderEmail, safeHttpUrl } = load('lib/mailer/email-html');
const { simulateSend } = load('lib/mailer/simulate');
const { campaignStats } = load('lib/mailer/stats');
const { resolveAudience } = load('lib/mailer/audience');
const { seededRandom, createDemoData } = load('lib/mailer/seed');
const { LocalStorageMailerRepository, memoryStore, MAILER_STORAGE_KEY } = load('features/mailer/repository/local-storage-repository');

test('email validation accepts normal addresses and rejects broken ones', () => {
  for (const ok of ['a@b.co', 'priya.sharma@acme.example', 'x+tag@mail.co.in', ' Mixed@Case.COM ']) assert.equal(isValidEmail(ok), true, ok);
  for (const bad of ['', 'plain', 'a@b', 'a@@b.com', 'a b@c.com', '.a@b.com', 'a..b@c.com', 'a@-b.com', 'a@b.c']) assert.equal(isValidEmail(bad), false, bad);
  assert.equal(normalizeEmail('  Priya@ACME.example '), 'priya@acme.example');
});

test('CSV import maps loose headers, splits names and reports every problem row', () => {
  const csv = '﻿Full Name,E-mail,Organisation,Mobile\n' +
    'Asha Patel,asha@new.example,New Co,123\n' +
    'Bad Row,not-an-email,,\n' +
    'No Email,,,\n' +
    'Asha Again,ASHA@new.example,,\n' +
    'Existing,priya@acme.example,,\n';
  const r = analyzeContactCsv(csv, ['Priya@acme.example'], { eventIds: ['ev1'] });
  assert.equal(r.fatalError, null);
  assert.equal(r.totalRows, 5);
  assert.deepEqual(r.counts, { imported: 1, invalid_email: 1, missing_email: 1, duplicate_in_file: 1, duplicate_existing: 1 });
  assert.deepEqual(r.toImport, [{ firstName: 'Asha', lastName: 'Patel', email: 'asha@new.example', company: 'New Co', phone: '123', eventIds: ['ev1'], roles: [], dateOfBirth: '', joiningDate: '', subscribed: true }]);
  assert.deepEqual(r.rows.map((x) => x.line), [2, 3, 4, 5, 6]);
  assert.match(analyzeContactCsv('Name,Phone\nA,1\n', [], { eventIds: [] }).fatalError, /No email column/);
  // Roles: several per cell, any case, unknown ones dropped, kept in display order.
  const withRoles = analyzeContactCsv('Email,Roles\nr@x.example,"subscriber; EMPLOYEE, Wizard | employee"\n', [], { eventIds: [] });
  assert.deepEqual(withRoles.toImport[0].roles, ['employee', 'subscriber']);
});

test('tokens personalise text, fall back politely and flag unknown tokens', () => {
  const event = { id: 'e', name: 'Annual Day', date: '2026-12-12', venue: 'Mumbai' };
  const values = tokenValuesFor({ firstName: 'Priya', lastName: 'Sharma', email: 'p@x.example', company: 'Acme' }, event, 'Team Acme');
  assert.equal(renderTokens('Hi {{first_name}} of {{ company }} — {{event_name}} on {{event_date}} {{oops}}', values),
    'Hi Priya of Acme — Annual Day on 12 December 2026 {{oops}}');
  assert.equal(tokenValuesFor({ firstName: '', lastName: '', email: 'x@y.example', company: '' }, null, '').first_name, 'friend');
  assert.deepEqual(unknownTokens('{{first_name}} {{firstname}} {{Oops}}'), ['firstname', 'oops']);
  assert.equal(formatMailerDate('2027-01-01'), '1 January 2027');
});

test('rendered email escapes names and body, and only links http(s) buttons', () => {
  const values = tokenValuesFor({ firstName: '<script>x</script>', lastName: '', email: 'a@b.example', company: '' }, null, 'Team');
  const content = { subject: 'Hi {{first_name}}', preheader: '', body: 'Line 1\nLine 2\n\nPara <b>2</b>', ctaLabel: 'Go', ctaUrl: 'javascript:alert(1)' };
  const { html, subject } = renderEmail('diwali', content, values);
  assert.equal(subject, 'Hi <script>x</script>');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('Line 1<br>Line 2'));
  assert.ok(html.includes('Para &lt;b&gt;2&lt;/b&gt;'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(renderEmail('invitation', { ...content, ctaUrl: 'https://everymoment.in/rsvp' }, values).html.includes('href="https://everymoment.in/rsvp"'));
  assert.equal(safeHttpUrl('ftp://x'), null);
  assert.ok(html.includes('name="viewport"') && html.includes('@media (max-width: 620px)'));
});

test('send simulation forces demo outcomes, gives ids to accepted mail and is reproducible', () => {
  const people = [
    { contactId: '1', email: 'bounce.me@x.example', name: 'B' },
    { contactId: '2', email: 'will.fail@x.example', name: 'F' },
    { contactId: '3', email: 'old@company.invalid', name: 'I' },
    ...Array.from({ length: 200 }, (_, i) => ({ contactId: `p${i}`, email: `p${i}@x.example`, name: `P${i}` })),
  ];
  const a = simulateSend(people, { random: seededRandom(7), now: 0 });
  const b = simulateSend(people, { random: seededRandom(7), now: 0 });
  assert.deepEqual(a, b);
  assert.equal(a[0].status, 'bounced');
  assert.equal(a[1].status, 'failed');
  assert.equal(a[1].providerMessageId, null);
  assert.equal(a[2].status, 'bounced');
  for (const r of a) {
    if (r.status !== 'failed') assert.match(r.providerMessageId, /^<sim-[0-9a-z]+-[0-9a-z]+@mock\.everymoment\.local>$/);
    assert.equal(r.events.at(-1).type, r.status);
  }
  assert.equal(new Set(a.filter((r) => r.providerMessageId).map((r) => r.providerMessageId)).size, a.filter((r) => r.providerMessageId).length);
  const s = campaignStats(a);
  assert.equal(s.recipients, 203);
  assert.equal(s.sent + s.failed, 203);
  assert.equal(s.delivered + s.bounced, s.sent);
  assert.ok(s.clicked > 30 && s.clicked < s.delivered);
  assert.ok(s.deliveryRate > 0.85 && s.deliveryRate < 1);
});

test('audience resolution merges lists, skips unsubscribed and duplicate emails', () => {
  const c = (id, email, subscribed = true) => ({ id, email, subscribed, firstName: '', lastName: '', company: '', phone: '', eventIds: [] });
  const contacts = [c('a', 'a@x.example'), c('b', 'b@x.example', false), c('c', 'a@x.example'), c('d', 'd@x.example')];
  const lists = [{ id: 'L', contactIds: ['a', 'b', 'c'] }];
  const r = resolveAudience({ contactIds: ['d', 'a', 'gone'], listIds: ['L'] }, contacts, lists);
  assert.deepEqual(r.recipients.map((x) => x.id), ['d', 'a']);
  assert.deepEqual(r.unsubscribed.map((x) => x.id), ['b']);
  assert.equal(r.duplicates, 1);
});

test('demo data is consistent and its sent campaign has simulated results', () => {
  const d = createDemoData({ now: Date.UTC(2026, 10, 16) });
  const emails = d.contacts.map((x) => x.email);
  assert.equal(new Set(emails).size, emails.length);
  assert.ok(emails.every(isValidEmail));
  assert.ok(emails.every((e) => /\.(example|invalid)$/.test(e)));
  const ids = new Set(d.contacts.map((x) => x.id));
  assert.ok(d.lists.every((l) => l.contactIds.every((id) => ids.has(id))));
  const sent = d.campaigns.find((x) => x.status === 'sent');
  assert.equal(sent.simulated, true);
  assert.ok(sent.recipients.length > 0);
  assert.equal(d.templates.filter((t) => t.builtIn).length, 4);
});

test('LocalStorage repository: seeds, validates, de-duplicates, sends and resets', async () => {
  const store = memoryStore();
  const repo = new LocalStorageMailerRepository(store, () => Date.UTC(2026, 10, 16));
  const data = await repo.load();
  assert.ok(store.getItem(MAILER_STORAGE_KEY));
  const n = data.contacts.length;

  assert.ok(data.contacts.every((c) => Array.isArray(c.roles)));
  const base = { firstName: 'New', lastName: 'Person', company: '', phone: '', eventIds: ['demo-event-annual-day', 'not-real'], roles: ['subscriber', 'bogus', 'manager', 'manager'], subscribed: true };
  const created = await repo.saveContact({ ...base, email: ' New@Person.example ' });
  assert.equal(created.email, 'new@person.example');
  assert.deepEqual(created.eventIds, ['demo-event-annual-day']);
  assert.deepEqual(created.roles, ['manager', 'subscriber']);
  await assert.rejects(repo.saveContact({ ...base, email: 'NEW@person.example' }), /already a contact/);
  await assert.rejects(repo.saveContact({ ...base, email: 'nope' }), /isn't a valid email/);
  await repo.saveContact({ ...base, firstName: 'Renamed', email: 'new@person.example' }, created.id);

  const list = await repo.saveList({ name: 'Imported', description: '', contactIds: [] });
  const imported = await repo.importContacts([
    { ...base, email: 'imp1@x.example' },
    { ...base, email: 'new@person.example' }, // became a duplicate meanwhile — skipped
  ], list.id);
  assert.equal(imported.length, 1);
  assert.equal((await repo.load()).lists.find((l) => l.id === list.id).contactIds.length, 1);

  const campaign = await repo.saveCampaign({
    name: 'Invite', kind: 'invitation', templateId: null, senderName: 'Team', eventId: null,
    audience: { contactIds: [created.id], listIds: [list.id] },
    subject: 'Hi', preheader: '', body: 'Come!', ctaLabel: '', ctaUrl: '',
  });
  await assert.rejects(repo.sendCampaign(campaign.id), /Pick the event/);
  await repo.saveCampaign({ ...campaign, eventId: 'demo-event-annual-day' }, campaign.id);
  const sent = await repo.sendCampaign(campaign.id);
  assert.equal(sent.status, 'sent');
  assert.equal(sent.simulated, true);
  assert.equal(sent.recipients.length, 2);
  await assert.rejects(repo.sendCampaign(campaign.id), /already been sent/);
  await assert.rejects(repo.saveCampaign({ ...campaign, name: 'x' }, campaign.id), /can't be edited/);

  // Deleting a contact keeps the sent campaign's recipient snapshot.
  await repo.deleteContact(created.id);
  const after = await repo.load();
  assert.equal(after.contacts.length, n + 1);
  assert.equal(after.campaigns.find((c) => c.id === campaign.id).recipients.length, 2);

  await assert.rejects(repo.deleteTemplate(after.templates.find((t) => t.builtIn).id), /can't be deleted/);

  store.setItem(MAILER_STORAGE_KEY, '{broken');
  const origWarn = console.warn; console.warn = () => {};
  assert.equal((await repo.load()).contacts.length, n);
  console.warn = origWarn;

  await repo.resetDemoData();
  assert.equal((await repo.load()).contacts.length, n);
});

test('contacts saved before roles existed load with an empty roles list', async () => {
  const store = memoryStore();
  const old = createDemoData({ now: Date.UTC(2026, 10, 16) });
  for (const c of old.contacts) delete c.roles;
  store.setItem(MAILER_STORAGE_KEY, JSON.stringify(old));
  const loaded = await new LocalStorageMailerRepository(store).load();
  assert.equal(loaded.contacts.length, old.contacts.length);
  assert.ok(loaded.contacts.every((c) => Array.isArray(c.roles) && c.roles.length === 0));
});
