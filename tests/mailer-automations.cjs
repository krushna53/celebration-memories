/* eslint-disable @typescript-eslint/no-require-imports */
// Event Mailer — birthday / HR reminder / work-anniversary automations.
// Run with: node --test tests/mailer-automations.cjs
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

const A = () => load('lib/mailer/automations');

function contact(id, extra = {}) {
  return {
    id, firstName: id[0].toUpperCase() + id.slice(1), lastName: 'Test', email: `${id}@x.example`, company: '', phone: '',
    eventIds: [], roles: ['employee'], dateOfBirth: '', joiningDate: '', subscribed: true, createdAt: '', updatedAt: '', ...extra,
  };
}

function dataWith(contacts, enabled = { birthday: true, hr_birthday_reminder: true, work_anniversary: true }, log = []) {
  const settings = A().defaultAutomationSettings();
  for (const [k, v] of Object.entries(enabled)) settings.rules[k].enabled = v;
  return { version: 1, events: [], contacts, lists: [], templates: [], campaigns: [], automations: settings, automationLog: log };
}

test('"today" is the India calendar day, not the server (UTC) day', () => {
  const { todayIn, hourIn } = A();
  // 20:00 UTC on 18 Nov = 01:30 on 19 Nov in India.
  const ms = Date.UTC(2026, 10, 18, 20, 0);
  assert.equal(todayIn(ms), '2026-11-19');
  assert.equal(todayIn(ms, 'UTC'), '2026-11-18');
  assert.equal(hourIn(ms), 1);
});

test('yearly dates: matching, 29 February, future dates and next occurrence', () => {
  const { occursOn, nextOccurrence, yearsSince, addDays } = A();
  assert.equal(occursOn('1992-11-19', '2026-11-19'), true);
  assert.equal(occursOn('1992-11-19', '2026-11-20'), false);
  assert.equal(occursOn('2000-02-29', '2027-02-28'), true, 'leap-day birthday on 28 Feb in a non-leap year');
  assert.equal(occursOn('2000-02-29', '2028-02-28'), false, 'leap year: wait for the 29th');
  assert.equal(occursOn('2000-02-29', '2028-02-29'), true);
  assert.equal(occursOn('2030-11-19', '2026-11-19'), false, 'a future date is never celebrated');
  assert.equal(nextOccurrence('1990-01-05', '2026-11-19'), '2027-01-05');
  assert.equal(nextOccurrence('1990-11-19', '2026-11-19'), '2026-11-19');
  assert.equal(yearsSince('2023-11-19', '2026-11-19'), 3);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('typed and CSV dates are read day-first and validated', () => {
  const { normalizeDateInput } = A();
  assert.equal(normalizeDateInput('2026-11-19'), '2026-11-19');
  assert.equal(normalizeDateInput('19-11-2026'), '2026-11-19');
  assert.equal(normalizeDateInput('5/2/1990'), '1990-02-05');
  assert.equal(normalizeDateInput('19.11.2026'), '2026-11-19');
  assert.equal(normalizeDateInput(''), '');
  assert.equal(normalizeDateInput('31/02/2026'), null);
  assert.equal(normalizeDateInput('next week'), null);

  const { analyzeContactCsv } = load('lib/mailer/csv-import');
  const csv = 'Name,Email,DOB,Date of Joining,Roles\nPooja Nair,pooja@x.example,15/02/1990,01-06-2019,HR; Employee\nBad Date,bad@x.example,99/99/1990,,\n';
  const result = analyzeContactCsv(csv, [], { eventIds: [] });
  assert.equal(result.toImport.length, 2);
  assert.equal(result.toImport[0].dateOfBirth, '1990-02-15');
  assert.equal(result.toImport[0].joiningDate, '2019-06-01');
  assert.deepEqual(result.toImport[0].roles, ['hr', 'employee']);
  assert.equal(result.toImport[1].dateOfBirth, '', 'an unreadable date is left empty, the contact still imports');
});

test('planning: birthday today, HR reminder for tomorrow, anniversaries from year 1', () => {
  const { planAutomations } = A();
  const today = '2026-11-19';
  const contacts = [
    contact('priya', { dateOfBirth: '1992-11-19' }), // birthday today
    contact('arjun', { dateOfBirth: '1990-11-20', subscribed: false }), // birthday tomorrow, opted out of emails himself
    contact('ritu', { roles: ['hr'], dateOfBirth: '1991-11-20' }), // HR, also has a birthday tomorrow
    contact('dev', { roles: ['hr'] }), // HR
    contact('meera', { joiningDate: '2023-11-19' }), // 3rd anniversary
    contact('new', { joiningDate: '2026-11-19' }), // joined today: no anniversary yet
    contact('gone', { dateOfBirth: '1980-11-19', subscribed: false }), // unsubscribed: no birthday email
  ];
  const jobs = planAutomations(dataWith(contacts), today);
  const keys = jobs.map((j) => j.key).sort();
  assert.deepEqual(keys, [
    'birthday:priya:2026',
    'hr_birthday_reminder:arjun:dev:2026',
    'hr_birthday_reminder:arjun:ritu:2026',
    'hr_birthday_reminder:ritu:dev:2026', // Ritu isn't reminded about her own birthday
    'work_anniversary:meera:2026',
  ]);
  const anniversary = jobs.find((j) => j.kind === 'work_anniversary');
  assert.equal(anniversary.tokens.years_label, '3 years');
  const reminder = jobs.find((j) => j.key === 'hr_birthday_reminder:arjun:dev:2026');
  assert.equal(reminder.recipient.email, 'dev@x.example');
  assert.equal(reminder.tokens.celebrant_name, 'Arjun Test');
  assert.equal(reminder.occasionDate, '2026-11-20');
});

test('switched-off rules send nothing, and anything already sent is never planned again', () => {
  const { planAutomations, logEntryFor } = A();
  const contacts = [contact('priya', { dateOfBirth: '1992-11-19' })];
  assert.equal(planAutomations(dataWith(contacts, { birthday: false }), '2026-11-19').length, 0);

  const [job] = planAutomations(dataWith(contacts), '2026-11-19');
  const at = '2026-11-19T04:00:00Z';
  assert.equal(planAutomations(dataWith(contacts, undefined, [logEntryFor(job, 'sent', null, at)]), '2026-11-19').length, 0);
  assert.equal(planAutomations(dataWith(contacts, undefined, [logEntryFor(job, 'sending', null, at)]), '2026-11-19').length, 0);
  assert.equal(planAutomations(dataWith(contacts, undefined, [logEntryFor(job, 'failed', 'x', at)]), '2026-11-19').length, 1, 'failed ones are retried');
  // Next year it goes again.
  assert.equal(planAutomations(dataWith(contacts, undefined, [logEntryFor(job, 'sent', null, at)]), '2027-11-19').length, 1);
});

test('automation tokens fill in, and the rest is left for the normal renderer', () => {
  const { applyAutomationTokens } = A();
  const out = applyAutomationTokens(
    { subject: '{{celebrant_name}} turns a year older', preheader: '', body: 'Hi {{first_name}}, {{years_label}}!', ctaLabel: '', ctaUrl: '' },
    { celebrant_name: 'Arjun Nair', celebrant_first_name: 'Arjun', birthday_date: '20 November 2026', years: '3', years_label: '3 years' },
  );
  assert.equal(out.subject, 'Arjun Nair turns a year older');
  assert.equal(out.body, 'Hi {{first_name}}, 3 years!');
});

test('contacts: dates are validated, older contacts read back with empty dates, mock run is simulated once', async () => {
  const { LocalStorageMailerRepository, memoryStore, MAILER_STORAGE_KEY } = load('features/mailer/repository/local-storage-repository');
  const now = Date.UTC(2026, 10, 19, 6, 0); // 19 Nov 2026, 11:30 India time
  const store = memoryStore();
  const repo = new LocalStorageMailerRepository(store, () => now);
  const base = { firstName: 'Priya', lastName: 'S', email: 'priya@x.example', company: '', phone: '', eventIds: [], roles: ['employee'], subscribed: true };

  await assert.rejects(repo.saveContact({ ...base, dateOfBirth: '2030-01-01' }), /can't be in the future/);
  await assert.rejects(repo.saveContact({ ...base, dateOfBirth: '2026-02-30' }), /isn't a valid date/);
  const saved = await repo.saveContact({ ...base, email: 'p2@x.example', dateOfBirth: '1992-11-19', joiningDate: '2025-11-19' });
  assert.equal(saved.dateOfBirth, '1992-11-19');

  // Simulate data saved before the date fields existed.
  const raw = JSON.parse(store.getItem(MAILER_STORAGE_KEY));
  for (const c of raw.contacts) { delete c.dateOfBirth; delete c.joiningDate; }
  raw.contacts.push({ ...raw.contacts[0], id: 'old', email: 'old@x.example' });
  store.setItem(MAILER_STORAGE_KEY, JSON.stringify(raw));
  const loaded = await repo.load();
  assert.equal(loaded.contacts.find((c) => c.id === 'old').dateOfBirth, '');

  await repo.saveContact({ ...base, email: 'p3@x.example', dateOfBirth: '1992-11-19', joiningDate: '2025-11-19' });
  const settings = (await repo.load()).automations ?? load('lib/mailer/automations').defaultAutomationSettings();
  settings.rules.birthday.enabled = true;
  settings.rules.work_anniversary.enabled = true;
  await repo.saveAutomationSettings(settings);

  const first = await repo.runAutomations();
  assert.equal(first.date, '2026-11-19');
  const mine = first.entries.filter((e) => e.recipientEmail === 'p3@x.example').map((e) => `${e.kind}:${e.status}`).sort();
  assert.deepEqual(mine, ['birthday:simulated', 'work_anniversary:simulated']);
  const second = await repo.runAutomations();
  assert.equal(second.entries.length, 0, 'running again the same day sends nothing new');

  const blank = { ...settings, rules: { ...settings.rules, birthday: { enabled: true, content: { ...settings.rules.birthday.content, subject: '' } } } };
  await assert.rejects(repo.saveAutomationSettings(blank), /add a subject/);
});
