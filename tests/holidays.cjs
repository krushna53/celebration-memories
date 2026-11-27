/* eslint-disable @typescript-eslint/no-require-imports */
// Company Holiday Calendar rules (lib/holidays.ts) — run with: node --test tests/holidays.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const file = path.join(__dirname, '..', 'lib', 'holidays.ts');
const m = new Module(file);
m.filename = file;
m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { HOLIDAY_GROUPS, isIsoDate, holidayKey, formatHolidayDate, customHolidayError, cleanSaveInput } = m.exports;

const ID = '0b6f4d2e-8a51-4c8e-9a3e-5f2d1c0b9a87';

test('the four holiday groups, in page order', () => {
  assert.deepEqual(HOLIDAY_GROUPS.map((g) => g.label), ['National Holidays', 'Religious & Festival Holidays', 'Regional Holidays', 'Optional Holidays']);
});

test('dates are real calendar dates and show without a timezone shift', () => {
  assert.equal(isIsoDate('2026-02-28'), true);
  assert.equal(isIsoDate('2026-02-29'), false);
  assert.equal(isIsoDate('2028-02-29'), true);
  assert.equal(isIsoDate('26-01-2026'), false);
  assert.equal(formatHolidayDate('2026-01-26'), 'Mon, 26 Jan 2026');
});

test('the same holiday = same date and same name, ignoring case and spaces', () => {
  assert.equal(holidayKey(' Republic  Day ', '2026-01-26'), holidayKey('republic day', '2026-01-26'));
  assert.notEqual(holidayKey('Republic Day', '2026-01-26'), holidayKey('Republic Day', '2027-01-26'));
});

test('custom holidays need a name, a category and a date in the chosen year, and no duplicates', () => {
  const ok = { name: 'Foundation Day', date: '2026-07-01', type: 'regional' };
  assert.equal(customHolidayError(ok, 2026, new Set()), null);
  assert.match(customHolidayError({ ...ok, name: '  ' }, 2026, new Set()), /name/);
  assert.match(customHolidayError({ ...ok, date: '2027-07-01' }, 2026, new Set()), /in 2026/);
  assert.match(customHolidayError({ ...ok, date: '2026-13-01' }, 2026, new Set()), /valid date/);
  assert.match(customHolidayError({ ...ok, type: 'fun' }, 2026, new Set()), /category/);
  assert.match(customHolidayError(ok, 2026, new Set([holidayKey('foundation day', '2026-07-01')])), /already in the calendar/);
});

test('save input from the browser is checked and cleaned', () => {
  const good = cleanSaveInput({ year: 2026, masterIds: [ID, ID], custom: [{ id: ID, name: ' Day   Off ', date: '2026-03-03', type: 'optional' }, { id: 'bad/../id', name: 'New', date: '2026-04-04', type: 'regional' }] });
  assert.equal(good.ok, true);
  assert.deepEqual(good.masterIds, [ID]);
  assert.deepEqual(good.custom, [{ id: ID, name: 'Day Off', date: '2026-03-03', type: 'optional' }, { name: 'New', date: '2026-04-04', type: 'regional' }]);
  assert.match(cleanSaveInput({ year: 1999, masterIds: [], custom: [] }).error, /year/);
  assert.match(cleanSaveInput({ year: 2026, masterIds: ["1' or 1=1"], custom: [] }).error, /couldn't be read/);
  assert.match(cleanSaveInput({ year: 2026, masterIds: [], custom: [{ name: 'A', date: '2026-01-01', type: 'regional' }, { name: 'a', date: '2026-01-01', type: 'national' }] }).error, /already in the calendar/);
  assert.equal(cleanSaveInput(null).ok, false);
});
