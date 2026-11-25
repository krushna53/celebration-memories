/* eslint-disable @typescript-eslint/no-require-imports */
// Sign-up "Role" rules (lib/signup-role.ts) — run with: node --test tests/signup-role.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const file = path.join(__dirname, '..', 'lib', 'signup-role.ts');
const m = new Module(file);
m.filename = file;
m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { isSignupRole, signupRoleOf, homePathForRole, validateNewPassword, SIGNUP_ROLES } = m.exports;

test('Business Owner opens the Event Mailer; Event Owner the event wizard', () => {
  assert.equal(homePathForRole('business_owner'), '/admin/mailer');
  assert.equal(homePathForRole('event_owner'), '/start');
  assert.deepEqual(SIGNUP_ROLES.map((r) => r.label), ['Event Owner', 'Business Owner']);
});

test('only the two known roles are accepted, from the form or the saved account', () => {
  assert.equal(isSignupRole('business_owner'), true);
  for (const bad of ['owner', 'client', '', null, undefined, 'BUSINESS_OWNER']) assert.equal(isSignupRole(bad), false, String(bad));
  assert.equal(signupRoleOf({ signup_role: 'event_owner' }), 'event_owner');
  assert.equal(signupRoleOf({ signup_role: 'owner' }), null);
  assert.equal(signupRoleOf(null), null);
  assert.equal(signupRoleOf({ full_name: 'Google user' }), null);
});

test('new passwords: length, a letter and a number, and both fields match', () => {
  assert.match(validateNewPassword('short1', 'short1'), /8 characters/);
  assert.match(validateNewPassword('allletters', 'allletters'), /letter and one number/);
  assert.match(validateNewPassword('goodpass1', 'goodpass2'), /don't match/);
  assert.equal(validateNewPassword('goodpass1', 'goodpass1'), null);
});
