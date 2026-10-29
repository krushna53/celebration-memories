/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated Postgres tests: DPDP_PGLITE_PATH=/absolute/path/to/pglite node --test tests/dpdp-database.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('consent receipts and private request lifecycle', { skip: !process.env.DPDP_PGLITE_PATH }, async () => {
  const { PGlite } = require(process.env.DPDP_PGLITE_PATH);
  const db = new PGlite();
  const actor = '10000000-0000-4000-8000-000000000001';
  const guest = '10000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public to service_role;
      create table admins(id uuid primary key, role text);
      insert into admins values ('${actor}','owner');
      create table rsvps(id uuid primary key default gen_random_uuid(), invitee_id uuid, consent_at timestamptz);
      create table guestbook(id uuid primary key default gen_random_uuid(), invitee_id uuid, consent_at timestamptz);
      grant select on admins to service_role;
      grant select,insert,update on rsvps,guestbook to service_role;`);
    await db.exec(fs.readFileSync('supabase/migrations/20261029212512_dpdp_consent_and_requests.sql', 'utf8'));
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from privacy_requests'), /permission denied/);
      await assert.rejects(db.query('select * from consent_receipts'), /permission denied/);
      await assert.rejects(db.query("select submit_privacy_request('a@b.in','Event','erasure','Please erase my data',repeat('a',64))"), /permission denied/);
      await assert.rejects(db.query("select review_privacy_request(gen_random_uuid(),'received','verifying','Check identity','',gen_random_uuid())"), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    await db.query(`insert into rsvps(invitee_id, consent_at) values ('${guest}',now())`);
    assert.equal((await db.query('select * from consent_receipts')).rows.length, 0, 'legacy consent is not relabelled');
    await db.query(`insert into guestbook(invitee_id,consent_at,consent_version) values ('${guest}',now(),'2026-10-30.1')`);
    assert.equal((await db.query('select * from consent_receipts')).rows.length, 1);
    await db.query("update guestbook set consent_at=clock_timestamp()");
    assert.equal((await db.query('select * from consent_receipts')).rows.length, 2, 'renewed consent appends evidence');
    await db.query("update guestbook set invitee_id=invitee_id");
    assert.equal((await db.query('select * from consent_receipts')).rows.length, 2, 'moderation does not fabricate consent');
    await assert.rejects(db.query(`insert into rsvps(invitee_id,consent_at,consent_version) values ('${guest}',now(),'unknown')`), /foreign key/);
    assert.equal((await db.query('select * from rsvps')).rows.length, 1, 'failed receipt rolls back submission');
    await assert.rejects(db.query('delete from consent_receipts'), /permission denied/);
    await assert.rejects(db.query("update consent_notices set notice='changed'"), /permission denied/);
    const q = "select submit_privacy_request('guest@example.com','Example event','erasure','Please erase my RSVP',repeat('a',64)) as id";
    const id = (await db.query(q)).rows[0].id;
    for (let i = 0; i < 4; i++) await db.query(q);
    await assert.rejects(db.query(q), /Request limit reached/);
    await assert.rejects(db.query("select submit_privacy_request('a@b.in','Event','erasure','Please erase data',null)"), /identity required/);
    await assert.rejects(db.query(`select review_privacy_request('${id}','received','completed','Data removed','verified owner','${actor}')`), /Invalid status transition/);
    await assert.rejects(db.query(`select review_privacy_request('${id}','received','verifying','Identity review','','${guest}')`), /administrator required/);
    await db.query(`select review_privacy_request('${id}','received','verifying','Identity review started','','${actor}')`);
    await assert.rejects(db.query(`select review_privacy_request('${id}','received','rejected','Stale admin submission','','${actor}')`), /refresh before reviewing/);
    await assert.rejects(db.query(`select review_privacy_request('${id}','verifying','in_progress','Working on deletion','','${actor}')`), /verification record required/);
    await db.query(`select review_privacy_request('${id}','verifying','in_progress','Deletion scope confirmed','Verified through authenticated account','${actor}')`);
    await db.query(`select review_privacy_request('${id}','in_progress','completed','Removed records; processor deletion confirmed; requester notified','Verified through authenticated account','${actor}')`);
    assert.equal((await db.query(`select * from privacy_request_history where request_id='${id}'`)).rows.length, 3);
    await assert.rejects(db.query('delete from privacy_request_history'), /permission denied/);
  } finally { await db.close(); }
});
