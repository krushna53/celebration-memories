/* eslint-disable @typescript-eslint/no-require-imports */
// Company Holiday Calendar on Firestore (services/company-holidays.ts), against
// a small in-memory stand-in for Firestore — run with: node --test tests/company-holidays.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// --- a tiny in-memory Firestore (just what the service uses) ------------------
function fakeFirestore() {
  const docs = new Map(); // path -> data
  let writes = 0;
  const snap = (p, data) => ({ id: p.split('/').pop(), exists: data !== undefined, data: () => (data ? structuredClone(data) : undefined), get: (f) => data?.[f] });
  function docRef(p) {
    return {
      path: p,
      id: p.split('/').pop(),
      get: async () => snap(p, docs.get(p)),
      set: async (d) => { writes++; docs.set(p, structuredClone(d)); },
      collection: (name) => collRef(`${p}/${name}`),
    };
  }
  function query(p, filters, fields) {
    return {
      where: (f, op, v) => query(p, [...filters, [f, v]], fields),
      select: (...f) => query(p, filters, f),
      get: async () => ({
        docs: [...docs.entries()]
          .filter(([k]) => k.startsWith(`${p}/`) && !k.slice(p.length + 1).includes('/'))
          .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
          .map(([k, d]) => snap(k, fields ? Object.fromEntries(fields.map((f) => [f, d[f]])) : d)),
      }),
    };
  }
  function collRef(p) {
    return { ...query(p, [], null), doc: (id) => docRef(`${p}/${id}`) };
  }
  const db = {
    collection: (name) => collRef(name),
    batch() {
      const ops = [];
      return {
        set: (ref, d) => ops.push([ref.path, d]),
        delete: (ref) => ops.push([ref.path, undefined]),
        commit: async () => {
          for (const [p, d] of ops) {
            writes++;
            if (d === undefined) docs.delete(p);
            else docs.set(p, structuredClone(d));
          }
        },
      };
    },
    async runTransaction(fn) {
      const ops = [];
      let wrote = false;
      const tx = {
        getAll: async (...refs) => { assert.equal(wrote, false, 'read after write'); return Promise.all(refs.map((r) => r.get())); },
        get: async (q) => { assert.equal(wrote, false, 'read after write'); return q.get(); },
        set: (ref, d) => { wrote = true; ops.push(['set', ref.path, d]); },
        delete: (ref) => { wrote = true; ops.push(['delete', ref.path]); },
      };
      const result = await fn(tx); // throws = nothing is written
      for (const [op, p, d] of ops) { writes++; if (op === 'set') docs.set(p, structuredClone(d)); else docs.delete(p); }
      return result;
    },
  };
  return { db, docs, writes: () => writes };
}

// --- load the service with Firestore swapped for the fake ---------------------
const root = path.join(__dirname, '..');
function loadService(fake) {
  const cache = new Map();
  function load(rel) {
    if (rel === 'services/mailer-firestore') {
      class MailerFirestoreSetupError extends Error {}
      return {
        MailerFirestoreSetupError,
        mailerFirestore: () => fake.db,
        mailerTenantDoc: (id) => { if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('Invalid tenant id.'); return fake.db.collection('mailerTenants').doc(id); },
      };
    }
    let file = null;
    for (const c of [`${rel}.ts`, rel]) if (fs.existsSync(path.join(root, c)) && fs.statSync(path.join(root, c)).isFile()) file = path.join(root, c);
    if (!file) throw new Error(`Cannot resolve ${rel}`);
    if (cache.has(file)) return cache.get(file).exports;
    const m = new Module(file);
    m.filename = file;
    m.paths = Module._nodeModulePaths(path.dirname(file));
    cache.set(file, m);
    const req = m.require.bind(m);
    m.require = (name) => (name === 'server-only' ? {} : name.startsWith('@/') ? load(name.slice(2)) : req(name));
    m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
    return m.exports;
  }
  return load('services/company-holidays');
}

const A = 'admin-a';
const B = 'admin-b';

async function setup() {
  const fake = fakeFirestore();
  const svc = loadService(fake);
  const cal = await svc.loadHolidayCalendar(A, 2026, 'IN', 'OD');
  const find = (name, state = null) => cal.master.find((h) => h.name === name && h.stateCode === state);
  return { fake, svc, cal, find };
}

test('first open seeds the predefined holidays once; the page gets them by year and state', async () => {
  const { fake, svc, cal } = await setup();
  const master = [...fake.docs.keys()].filter((k) => k.startsWith('holidayMaster/'));
  assert.equal(master.length, 158);
  assert.deepEqual(cal.years, [2026, 2027]);
  assert.deepEqual(cal.countries, ['IN']);
  assert.ok(cal.states.includes('MH') && cal.states.includes('OD'));
  const count = (t) => cal.master.filter((h) => h.type === t).length;
  assert.deepEqual([count('national'), count('religious'), count('optional'), count('regional')], [3, 14, 34, 2]);
  assert.ok(cal.master.every((h) => h.stateCode === null || h.stateCode === 'OD'));
  assert.equal(cal.master[0].date <= cal.master[1].date, true);
  assert.deepEqual(cal.saved, []);
  // Opening again doesn't re-seed.
  const before = fake.writes();
  await svc.loadHolidayCalendar(A, 2027, 'IN', null);
  assert.equal(fake.writes(), before);
  const all27 = await svc.loadHolidayCalendar(A, 2027, 'IN', null);
  assert.equal(all27.master.filter((h) => h.type === 'regional').length, 0);
});

test('saving keeps only ticked holidays, updates customs in place and is preselected on reopen', async () => {
  const { svc, find } = await setup();
  const rd = find('Republic Day').id;
  const holi = find('Holi').id;
  let saved = await svc.saveHolidayCalendar(A, 2026, [rd, holi], [{ name: 'Foundation Day', date: '2026-07-01', type: 'regional' }]);
  assert.deepEqual(saved.map((h) => h.name), ['Republic Day', 'Holi', 'Foundation Day']);
  const custom = saved.find((h) => !h.masterId);
  assert.match(custom.id, /^c_/);

  saved = await svc.saveHolidayCalendar(A, 2026, [rd], [{ id: custom.id, name: 'Founders Day', date: '2026-07-02', type: 'optional' }]);
  assert.deepEqual(saved.map((h) => `${h.name}@${h.date}`), ['Republic Day@2026-01-26', 'Founders Day@2026-07-02']);
  assert.equal(saved.find((h) => !h.masterId).id, custom.id);
  assert.equal(saved.find((h) => !h.masterId).isOptional, true);

  const reopened = await svc.loadHolidayCalendar(A, 2026, 'IN', 'MH');
  assert.deepEqual(reopened.saved.map((h) => h.name), ['Republic Day', 'Founders Day']);
});

test('no duplicates: same holiday twice is skipped, a custom copy is refused and nothing is written', async () => {
  const { fake, svc, find } = await setup();
  const rd = find('Republic Day').id;
  // Rath Yatra is both an optional (all-India) and an Odisha holiday with the same name and date.
  const raths = [find('Rath Yatra').id, find('Rath Yatra', 'OD').id];
  let saved = await svc.saveHolidayCalendar(A, 2026, [rd, ...raths], []);
  assert.deepEqual(saved.map((h) => h.name), ['Republic Day', 'Rath Yatra']);
  // Saving the same thing again changes nothing.
  saved = await svc.saveHolidayCalendar(A, 2026, [rd, ...raths], []);
  assert.equal(saved.length, 2);

  const before = [...fake.docs.keys()].filter((k) => k.includes('/companyHolidays/')).length;
  await assert.rejects(svc.saveHolidayCalendar(A, 2026, [rd], [{ name: 'republic day', date: '2026-01-26', type: 'national' }]), /already in the calendar/);
  assert.equal([...fake.docs.keys()].filter((k) => k.includes('/companyHolidays/')).length, before);
  // A custom can't take over a predefined holiday's id.
  saved = await svc.saveHolidayCalendar(A, 2026, [rd], [{ id: `m_${rd}`, name: 'Other', date: '2026-02-02', type: 'regional' }]);
  assert.ok(saved.find((h) => h.name === 'Other').id.startsWith('c_'));
  assert.equal(saved.find((h) => h.name === 'Republic Day').masterId, rd);
});

test('years and companies are kept apart; wrong-year holidays are refused', async () => {
  const { svc, find } = await setup();
  const rd = find('Republic Day').id;
  await svc.saveHolidayCalendar(A, 2026, [rd], [{ name: 'Annual Day', date: '2026-12-01', type: 'regional' }]);
  const cal27 = await svc.loadHolidayCalendar(A, 2027, 'IN', null);
  const rd27 = cal27.master.find((h) => h.name === 'Republic Day').id;
  await svc.saveHolidayCalendar(A, 2027, [rd27], []);
  assert.equal((await svc.loadHolidayCalendar(A, 2026, 'IN', null)).saved.length, 2);
  assert.equal((await svc.loadHolidayCalendar(A, 2027, 'IN', null)).saved.length, 1);
  await assert.rejects(svc.saveHolidayCalendar(A, 2027, [rd], []), /no longer available/);

  await svc.saveHolidayCalendar(B, 2026, [find('Holi').id], []);
  assert.deepEqual((await svc.loadHolidayCalendar(B, 2026, 'IN', null)).saved.map((h) => h.name), ['Holi']);
  assert.deepEqual((await svc.loadHolidayCalendar(A, 2026, 'IN', null)).saved.map((h) => h.name), ['Republic Day', 'Annual Day']);
  await assert.rejects(svc.loadHolidayCalendar('../evil', 2026, 'IN', null));
});

// --- Fetch with AI -----------------------------------------------------------

function loadAi(response) {
  const file = path.join(root, 'lib', 'holidays-ai.ts');
  const m = new Module(file);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  const req = m.require.bind(m);
  const calls = [];
  class OpenAI {
    constructor() {
      this.responses = { create: async (args) => { calls.push(args); return response; } };
    }
  }
  m.require = (name) => {
    if (name === 'server-only') return {};
    if (name === 'openai') return { __esModule: true, default: OpenAI };
    if (name === '@/lib/holidays') return loadPlain('lib/holidays');
    return req(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
  return { ...m.exports, calls };
}

function loadPlain(rel) {
  const file = path.join(root, `${rel}.ts`);
  const m = new Module(file);
  m.filename = file;
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
  return m.exports;
}

test('AI holidays: only real dates in the year are kept, and "verified" means the search opened that page', async () => {
  const official = 'https://www.staffnews.in/2027/07/holidays-2028.html';
  const response = {
    output: [
      { type: 'web_search_call', action: { type: 'search', sources: [{ type: 'url', url: official }] } },
      { type: 'message', content: [{ type: 'output_text', text: '', annotations: [{ type: 'url_citation', url: 'https://dopt.gov.in/list-2028', title: 'DoPT' }] }] },
    ],
    output_text: JSON.stringify({
      status: 'official',
      note: 'From the DoPT list for 2028.',
      holidays: [
        { name: 'Republic Day', date: '2028-01-26', type: 'national', state_code: null, may_vary: false, source_url: 'https://staffnews.in/2027/07/holidays-2028.html/' },
        { name: 'Id-ul-Fitr', date: '2028-02-27', type: 'religious', state_code: null, may_vary: true, source_url: 'https://made-up.example/eid' },
        { name: 'Holi', date: '2028-02-30', type: 'religious', state_code: null, may_vary: false, source_url: null },
        { name: 'Diwali', date: '2027-10-29', type: 'religious', state_code: null, may_vary: false, source_url: null },
        { name: 'Maharashtra Day', date: '2028-05-01', type: 'regional', state_code: 'MH', may_vary: false, source_url: null },
        { name: 'republic  day', date: '2028-01-26', type: 'national', state_code: null, may_vary: false, source_url: null },
        { name: 'Odd', date: '2028-03-03', type: 'fun', state_code: null, may_vary: false, source_url: null },
      ],
    }),
  };
  process.env.OPENAI_API_KEY = 'test';
  const { fetchHolidaysWithAi, calls } = loadAi(response);
  const result = await fetchHolidaysWithAi(2028, 'IN', null);
  assert.equal(calls[0].tools[0].type, 'web_search');
  assert.match(calls[0].instructions, /NEVER guess/);
  assert.equal(result.status, 'official');
  assert.deepEqual(result.holidays.map((h) => [h.name, h.verified, h.mayVary]), [['Republic Day', true, false], ['Id-ul-Fitr', false, true]]);
  assert.deepEqual(result.sources.map((s) => s.url).sort(), ['https://dopt.gov.in/list-2028', official].sort());

  // With a state, its regional holidays are kept (and only its own).
  const withState = await fetchHolidaysWithAi(2028, 'IN', 'MH');
  assert.ok(withState.holidays.some((h) => h.name === 'Maharashtra Day' && h.stateCode === 'MH'));

  const empty = loadAi({ output: [], output_text: JSON.stringify({ status: 'official', note: '', holidays: [] }) });
  assert.equal((await empty.fetchHolidaysWithAi(2030, 'IN', null)).status, 'not_found');
  delete process.env.OPENAI_API_KEY;
  await assert.rejects(empty.fetchHolidaysWithAi(2030, 'IN', null), /OPENAI_API_KEY/);
});

test('AI searches are cached, limited per company per day, and the owner can add them to the list', async () => {
  const { fake, svc } = await setup();
  for (let i = 0; i < svc.AI_DAILY_LIMIT; i++) assert.equal(await svc.consumeAiSearch(A), true);
  assert.equal(await svc.consumeAiSearch(A), false);
  assert.equal(await svc.consumeAiSearch(B), true);

  assert.equal(await svc.cachedAiHolidays('IN', 2028, null), null);
  const result = { status: 'official', note: '', holidays: [], sources: [] };
  await svc.storeAiHolidays('IN', 2028, null, result);
  assert.deepEqual((await svc.cachedAiHolidays('IN', 2028, null)).result, result);
  assert.equal(await svc.cachedAiHolidays('IN', 2028, 'MH'), null);

  const added = await svc.addMasterHolidays('IN', [
    { name: 'Republic Day', date: '2028-01-26', type: 'national', stateCode: null },
    { name: 'Maharashtra Day', date: '2028-05-01', type: 'regional', stateCode: 'MH' },
  ]);
  assert.equal(added, 2);
  // Adding the same again doesn't duplicate.
  await svc.addMasterHolidays('IN', [{ name: 'Republic Day', date: '2028-01-26', type: 'national', stateCode: null }]);
  const cal = await svc.loadHolidayCalendar(A, 2028, 'IN', 'MH');
  assert.ok(cal.years.includes(2028) && cal.years.includes(2026));
  assert.deepEqual(cal.master.map((h) => h.name), ['Republic Day', 'Maharashtra Day']);
  assert.equal([...fake.docs.keys()].filter((k) => k.startsWith('holidayMaster/')).length, 160);
  const saved = await svc.saveHolidayCalendar(A, 2028, cal.master.map((h) => h.id), []);
  assert.equal(saved.length, 2);
});

test('the owner can remove AI-added holidays (not the official ones); calendars that ticked them still save', async () => {
  const { svc, find } = await setup();
  await svc.addMasterHolidays('IN', [{ name: "Mahatma Gandhi's Birthday", date: '2026-10-02', type: 'national', stateCode: null }]);
  let cal = await svc.loadHolidayCalendar(A, 2026, 'IN', null);
  const aiOne = cal.master.find((h) => h.name === "Mahatma Gandhi's Birthday");
  assert.equal(aiOne.addedByAi, true);
  assert.equal(cal.master.find((h) => h.name === 'Republic Day').addedByAi, false);

  const rd = find('Republic Day').id;
  await svc.saveHolidayCalendar(A, 2026, [rd, aiOne.id], []);
  // Official holidays are never removed; the AI one is.
  assert.equal(await svc.removeMasterHolidays([rd, aiOne.id]), 1);
  cal = await svc.loadHolidayCalendar(A, 2026, 'IN', null);
  assert.ok(cal.master.some((h) => h.id === rd));
  assert.ok(!cal.master.some((h) => h.id === aiOne.id));
  // The company's next save with the stale id simply drops it.
  const saved = await svc.saveHolidayCalendar(A, 2026, [rd, aiOne.id], []);
  assert.deepEqual(saved.map((h) => h.name), ['Republic Day']);
});
