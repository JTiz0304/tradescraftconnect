import { after, afterEach, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// Real PostgreSQL policies/triggers/functions; only Supabase-owned auth/storage
// scaffolding and JWT claims are simulated. No network or live database is used.
const migrations = new URL('../supabase/migrations/', import.meta.url)
const id = {
  admin: '10000000-0000-0000-0000-000000000001',
  reporter: '10000000-0000-0000-0000-000000000002',
  target: '10000000-0000-0000-0000-000000000003',
  other: '10000000-0000-0000-0000-000000000004',
  admin2: '10000000-0000-0000-0000-000000000005',
  job: '20000000-0000-0000-0000-000000000001',
  otherJob: '20000000-0000-0000-0000-000000000002',
  application: '30000000-0000-0000-0000-000000000001',
  report: '40000000-0000-0000-0000-000000000001',
  missing: '90000000-0000-0000-0000-000000000001',
}
let db

async function as(member, sql, params = []) {
  await db.exec(`reset role; set local role ${member === 'anon' ? 'anon' : 'authenticated'}`)
  await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)", [id[member] ?? '', member === 'anon' ? 'anon' : 'authenticated'])
  return db.query(sql, params)
}
async function owner(sql, params = []) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true)")
  return db.query(sql, params)
}
const suspend = (expires = null) => as('admin', 'select public.set_member_suspension($1, true, $2, $3)', [id.target, 'Isolated safety test', expires])
const report = (member = 'reporter', target = id.target, entity = id.target, type = 'profile', details = 'Isolated test concern') => as(member,
  'insert into public.member_reports(reporter_id, reported_user_id, entity_type, entity_id, category, details) values ($1,$2,$3,$4,$5,$6)',
  [id[member] ?? id.reporter, target, type, entity, 'other', details])

describe('Safety database regression', { concurrency: false }, () => {
  before(async () => {
    db = new PGlite()
    await db.exec(`
      create role authenticated nologin nosuperuser;
      create role anon nologin nosuperuser;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.role() returns text language sql stable as $$
        select current_setting('request.jwt.claim.role', true) $$;
      grant usage on schema public, auth, storage to authenticated, anon;
      grant execute on all functions in schema auth to authenticated, anon;
      -- Supabase's default public-schema table grants must not hide ACL bugs.
      alter default privileges in schema public grant all on tables to authenticated, anon;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant all on storage.objects to authenticated, anon;
      create function storage.foldername(text) returns text[] language sql immutable as $$
        select string_to_array($1, '/') $$;
    `)
    for (const name of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
      if (name === '011_safety_moderation_hardening.sql') {
        await db.exec(await readFile(new URL('./fixtures/legacy-access.sql', import.meta.url), 'utf8'))
      }
      // gen_random_uuid is built into PostgreSQL/PGlite; these migrations do not
      // use any other pgcrypto API. Everything else is executed unchanged.
      const sql = (await readFile(new URL(name, migrations), 'utf8')).replace('create extension if not exists pgcrypto;', '')
      await db.exec(sql)
    }
    // The follow-up also works when reapplied to an already-migrated project.
    await db.exec(await readFile(new URL('011_safety_moderation_hardening.sql', migrations), 'utf8'))
    await db.exec(await readFile(new URL('20261109141000_reconcile_legacy_permissions.sql', migrations), 'utf8'))
    for (const member of ['admin', 'reporter', 'target', 'other', 'admin2']) {
      await db.query('insert into auth.users(id,email) values ($1,$2)', [id[member], `${member}@example.invalid`])
    }
    await db.query("update public.profiles set user_type = case when id in ($1,$2) then 'gc_builder' else 'professional' end", [id.target, id.other])
    await db.query('insert into public.admin_users(user_id) values ($1),($2)', [id.admin, id.admin2])
    await db.query("insert into public.job_postings(id,poster_id,title,trade_type,location) values ($1,$2,'Target job','electrical','Test'),($3,$4,'Other job','electrical','Test')", [id.job, id.target, id.otherJob, id.other])
    await db.query('insert into public.job_applications(id,job_id,applicant_id) values ($1,$2,$3)', [id.application, id.job, id.reporter])
    await db.query("insert into public.member_reports(id,reporter_id,reported_user_id,entity_type,entity_id,category,details) values ($1,$2,$3,'profile',$3,'unsafe','Isolated initial report')", [id.report, id.reporter, id.target])
    await db.query("insert into storage.objects(bucket_id,name) values ('certifications',$1)", [`${id.target}/credential.pdf`])
  })
  after(async () => { await db?.close() })
  beforeEach(async () => { await db.exec('begin') })
  afterEach(async () => { await db.exec('rollback') })

  test('valid profile and job reports submit without returning private rows', async () => {
    await report()
    await report('reporter', id.target, id.job, 'job')
    const { rows } = await owner('select * from public.member_reports')
    assert.equal(rows.length, 3)
    assert.ok(rows.every(row => row.status === 'open' && row.resolution_notes === null && row.resolved_by === null && row.reported_user_id === id.target))
  })
  test('anonymous profile reads and inserts are denied despite legacy public policies', async () => {
    for (const sql of [
      'select email from public.profiles',
      "insert into public.profiles(id,email) values (gen_random_uuid(),'spoof@example.invalid')",
    ]) {
      await owner('savepoint negative')
      await assert.rejects(as('anon', sql), /permission denied/)
      await db.exec('rollback to savepoint negative')
    }
  })
  test('members cannot create a profile with self-approved verification', async () => {
    await assert.rejects(as('reporter', "insert into public.profiles(id,license_verification_status) values ($1,'verified')", [id.missing]), /permission denied/)
  })
  test('Auth trigger still creates profiles after direct trigger-function grants are revoked', async () => {
    await owner('insert into auth.users(id,email) values ($1,$2)', [id.missing, 'new@example.invalid'])
    assert.equal((await owner('select email from public.profiles where id=$1', [id.missing])).rows[0].email, 'new@example.invalid')
  })
  test('anonymous callers cannot execute any public application function', async () => {
    const { rows } = await owner("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon',p.oid,'EXECUTE')")
    assert.deepEqual(rows, [])
  })
  test('members cannot directly execute trigger-only functions', async () => {
    const { rows } = await owner("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prorettype='trigger'::regtype and has_function_privilege('authenticated',p.oid,'EXECUTE')")
    assert.deepEqual(rows, [])
  })
  test('only hiring roles can post jobs', async () => {
    await assert.rejects(as('reporter', "insert into public.job_postings(poster_id,title,trade_type,location) values ($1,'Unauthorized job','electrical','Test')", [id.reporter]), /row-level security/)
  })
  test('applicants cannot mark themselves hired during submission', async () => {
    await assert.rejects(as('reporter', "insert into public.job_applications(job_id,applicant_id,status) values ($1,$2,'hired')", [id.otherJob, id.reporter]), /row-level security/)
  })
  test('closed jobs cannot receive new applications', async () => {
    await as('other', "update public.job_postings set status='closed' where id=$1", [id.otherJob])
    await assert.rejects(as('reporter', 'insert into public.job_applications(job_id,applicant_id) values ($1,$2)', [id.otherJob, id.reporter]), /row-level security/)
  })
  test('employers can change status but cannot rewrite application ownership', async () => {
    await as('target', "update public.job_applications set status='reviewing' where id=$1", [id.application])
    assert.equal((await as('reporter', 'select status from public.job_applications where id=$1', [id.application])).rows[0].status, 'reviewing')
    await assert.rejects(as('target', 'update public.job_applications set applicant_id=$1 where id=$2', [id.other, id.application]), /permission denied/)
  })
  test('recipients can mark messages read without rewriting the sender or body', async () => {
    const sent = await as('target', "insert into public.application_messages(application_id,sender_id,recipient_id,body) values ($1,$2,$3,'Original body') returning id", [id.application, id.target, id.reporter])
    await as('reporter', 'update public.application_messages set read_at=now() where id=$1', [sent.rows[0].id])
    assert.ok((await as('reporter', 'select read_at from public.application_messages where id=$1', [sent.rows[0].id])).rows[0].read_at)
    await assert.rejects(as('reporter', "update public.application_messages set body='Rewritten' where id=$1", [sent.rows[0].id]), /permission denied/)
  })
  test('legacy delete policies cannot remove a verified certification', async () => {
    const cert = await owner("insert into public.certifications(user_id,file_url,file_name,cert_name,verification_status) values ($1,'private/path','cert.pdf','Test certificate','verified') returning id", [id.reporter])
    assert.equal((await as('reporter', 'delete from public.certifications where id=$1 returning id', [cert.rows[0].id])).rows.length, 0)
  })
  test('owners can delete their jobs and applicants can withdraw their applications', async () => {
    assert.equal((await as('reporter', 'delete from public.job_applications where id=$1 returning id', [id.application])).rows.length, 1)
    assert.equal((await as('other', 'delete from public.job_postings where id=$1 returning id', [id.otherJob])).rows.length, 1)
  })
  test('target owner is derived when omitted', async () => {
    await as('reporter', "insert into public.member_reports(reporter_id,entity_type,entity_id,category,details) values ($1,'job',$2,'other','Owner derivation test')", [id.reporter, id.job])
    const { rows } = await owner("select reported_user_id from public.member_reports where entity_type='job'")
    assert.equal(rows[0].reported_user_id, id.target)
  })
  test('mismatched profile/job owner, nonexistent target and self-report fail', async () => {
    // A failed SQL statement aborts its transaction; savepoints isolate negative cases.
    for (const args of [
      ['reporter', id.other, id.target], ['reporter', id.other, id.job, 'job'],
      ['reporter', id.target, id.missing], ['reporter', null, id.reporter],
      ['target', null, id.job, 'job'],
    ]) {
      await owner('savepoint negative')
      await assert.rejects(report(...args), /match|not found|themselves/)
      await db.exec('rollback to savepoint negative')
    }
  })
  test('reporter identity cannot be forged', async () => {
    await assert.rejects(as('other', "insert into public.member_reports(reporter_id,reported_user_id,entity_type,entity_id,category,details) values ($1,$2,'profile',$2,'other','Spoofed reporter test')", [id.reporter, id.target]), /signed-in member/)
  })
  for (const [column, value] of [
    ['status', "'resolved'"], ['resolution_notes', "'Forged note'"],
    ['resolved_by', `'${id.admin}'`], ['resolved_at', 'now()'], ['created_at', 'now()'],
  ]) test(`submission cannot supply ${column}`, async () => {
    await assert.rejects(as('reporter', `insert into public.member_reports(reporter_id,entity_type,entity_id,category,details,${column}) values ($1,'profile',$2,'other','Forged review test',${value})`, [id.reporter, id.target]), /permission denied/)
  })
  for (const details of ['short', 'x'.repeat(2001)]) test(`details length ${details.length} is rejected by the database`, async () => {
    await assert.rejects(report('reporter', id.target, id.target, 'profile', details), /check constraint/)
  })
  test('invalid report categories fail', async () => {
    await assert.rejects(as('reporter', "insert into public.member_reports(reporter_id,entity_type,entity_id,category,details) values ($1,'profile',$2,'bogus','Invalid category test')", [id.reporter, id.target]), /check constraint/)
  })
  test('reporter, reported member and unrelated member cannot read reports or notes', async () => {
    await as('admin', "select public.review_member_report($1,'reviewing','Private administrator note')", [id.report])
    for (const member of ['reporter', 'target', 'other']) {
      assert.equal((await as(member, 'select * from public.member_reports')).rows.length, 0)
    }
  })
  test('anonymous report reads, submissions and status lookups are denied', async () => {
    for (const sql of [
      'select * from public.member_reports',
      `insert into public.member_reports(reporter_id,entity_type,entity_id,category,details) values ('${id.reporter}','profile','${id.target}','other','Anonymous test concern')`,
      `select public.is_user_suspended('${id.target}')`,
    ]) {
      await owner('savepoint negative')
      await assert.rejects(as('anon', sql), /permission denied/)
      await db.exec('rollback to savepoint negative')
    }
  })
  test('only admins can query the queue with member details', async () => {
    const { rows } = await as('admin', 'select r.id,p.email from public.member_reports r left join public.profiles p on p.id=r.reported_user_id')
    assert.deepEqual(rows, [{ id: id.report, email: 'target@example.invalid' }])
  })
  test('admin review/resolve/dismiss save notes and audit metadata', async () => {
    for (const decision of ['reviewing', 'resolved', 'dismissed']) {
      await as('admin', 'select public.review_member_report($1,$2,$3)', [id.report, decision, 'Private note'])
      const row = (await as('admin', 'select * from public.member_reports where id=$1', [id.report])).rows[0]
      assert.equal(row.status, decision)
      assert.equal(row.resolution_notes, 'Private note')
      assert.equal(row.resolved_by, decision === 'reviewing' ? null : id.admin)
      assert.equal(row.resolved_at !== null, decision !== 'reviewing')
    }
  })
  for (const member of ['reporter', 'anon']) test(`${member} cannot review, suspend, or restore`, async () => {
    for (const [sql, params] of [
      ["select public.review_member_report($1,'resolved',null)", [id.report]],
      ["select public.set_member_suspension($1,true,'Test',null)", [id.target]],
      ['select public.set_member_suspension($1,false,null,null)', [id.target]],
    ]) {
      await owner('savepoint negative')
      await assert.rejects(as(member, sql, params), /Administrator access required|permission denied/)
      await db.exec('rollback to savepoint negative')
    }
  })
  test('even admins use the review RPC rather than unrestricted table updates', async () => {
    await assert.rejects(as('admin', "update public.member_reports set status='resolved' where id=$1", [id.report]), /permission denied/)
  })
  test('invalid decisions and missing reports fail', async () => {
    for (const [reportId, decision] of [[id.report, 'bogus'], [id.missing, 'resolved']]) {
      await owner('savepoint negative')
      await assert.rejects(as('admin', 'select public.review_member_report($1,$2,null)', [reportId, decision]), /Invalid review decision|Report not found/)
      await db.exec('rollback to savepoint negative')
    }
  })
  test('admin cannot suspend self, another admin, or omit a reason', async () => {
    for (const [member, reason] of [[id.admin, 'Test'], [id.admin2, 'Test'], [id.target, ' ']]) {
      await owner('savepoint negative')
      await assert.rejects(as('admin', 'select public.set_member_suspension($1,true,$2,null)', [member, reason]), /cannot suspend|cannot be suspended|reason is required/)
      await db.exec('rollback to savepoint negative')
    }
  })
  test('30-day suspension is active; member can read their reason and expiry', async () => {
    await as('admin', "select public.set_member_suspension($1,true,'Safety test',now()+interval '30 days')", [id.target])
    assert.equal((await as('target', 'select public.is_user_suspended() as active')).rows[0].active, true)
    const { rows } = await as('target', 'select reason,expires_at,suspended_by from public.member_suspensions')
    assert.equal(rows[0].reason, 'Safety test')
    assert.equal(rows[0].suspended_by, id.admin)
    assert.ok(rows[0].expires_at)
  })
  test('unrelated members cannot read suspension records or query another status', async () => {
    await suspend()
    assert.equal((await as('other', 'select * from public.member_suspensions')).rows.length, 0)
    await assert.rejects(as('other', 'select public.is_user_suspended($1)', [id.target]), /Administrator access required/)
  })
  test('admin can query suspension status', async () => {
    await suspend()
    assert.equal((await as('admin', 'select public.is_user_suspended($1) as active', [id.target])).rows[0].active, true)
  })
  test('suspended members cannot read member profiles/jobs or edit their profile', async () => {
    await suspend()
    assert.equal((await as('target', 'select * from public.profiles')).rows.length, 0)
    assert.equal((await as('target', 'select * from public.job_postings')).rows.length, 0)
    assert.equal((await as('target', "update public.profiles set full_name='Blocked edit' where id=$1 returning id", [id.target])).rows.length, 0)
  })
  test('suspended members cannot update/delete existing jobs', async () => {
    await suspend()
    assert.equal((await as('target', "update public.job_postings set title='Blocked edit' where id=$1 returning id", [id.job])).rows.length, 0)
    assert.equal((await as('target', 'delete from public.job_postings where id=$1 returning id', [id.job])).rows.length, 0)
  })
  for (const [operation, sql, params] of [
    ['post jobs', "insert into public.job_postings(poster_id,title,trade_type,location) values ($1,'Blocked job','electrical','Test')", [id.target]],
    ['apply', 'insert into public.job_applications(job_id,applicant_id) values ($1,$2)', [id.otherJob, id.target]],
    ['message', "insert into public.application_messages(application_id,sender_id,recipient_id,body) values ($1,$2,$3,'Blocked message')", [id.application, id.target, id.reporter]],
    ['save jobs', 'insert into public.saved_jobs(user_id,job_id) values ($1,$2)', [id.target, id.otherJob]],
    ['upload private files', "insert into storage.objects(bucket_id,name) values ('certifications',$1)", [`${id.target}/blocked.pdf`]],
  ]) test(`suspended member cannot ${operation}`, async () => {
    await suspend()
    await assert.rejects(as('target', sql, params), /row-level security/)
  })
  test('suspended members cannot create reports', async () => {
    await suspend()
    await assert.rejects(report('target', id.other, id.other), /Account access is paused|row-level security/)
  })
  test('suspension hides existing messages, saved items and private storage metadata', async () => {
    await as('target', "insert into public.application_messages(application_id,sender_id,recipient_id,body) values ($1,$2,$3,'Allowed before suspension')", [id.application, id.target, id.reporter])
    await as('target', 'insert into public.saved_jobs(user_id,job_id) values ($1,$2)', [id.target, id.otherJob])
    await suspend()
    for (const table of ['public.application_messages', 'public.saved_jobs', 'storage.objects']) {
      assert.equal((await as('target', `select * from ${table}`)).rows.length, 0)
    }
  })
  test('restore re-enables access with the same member identity and records the admin', async () => {
    await suspend()
    assert.equal((await as('target', 'select * from public.profiles')).rows.length, 0)
    await as('admin', 'select public.set_member_suspension($1,false,null,null)', [id.target])
    assert.equal((await as('target', 'select public.is_user_suspended() as active')).rows[0].active, false)
    assert.equal((await as('target', 'select * from public.profiles')).rows.length, 5)
    assert.equal((await as('target', 'select lifted_by from public.member_suspensions')).rows[0].lifted_by, id.admin)
    await as('target', "insert into public.job_postings(poster_id,title,trade_type,location) values ($1,'Restored job','electrical','Test')", [id.target])
    await as('target', "insert into public.application_messages(application_id,sender_id,recipient_id,body) values ($1,$2,$3,'Restored message')", [id.application, id.target, id.reporter])
  })
  test('expired suspension permits reads and writes', async () => {
    await as('admin', "select public.set_member_suspension($1,true,'Expired test',now()-interval '1 second')", [id.target])
    assert.equal((await as('target', 'select public.is_user_suspended() as active')).rows[0].active, false)
    assert.equal((await as('target', "update public.profiles set full_name='Allowed edit' where id=$1 returning id", [id.target])).rows.length, 1)
  })
  test('re-suspension clears prior lift metadata', async () => {
    await suspend()
    await as('admin', 'select public.set_member_suspension($1,false,null,null)', [id.target])
    await suspend()
    const row = (await as('target', 'select lifted_at,lifted_by from public.member_suspensions')).rows[0]
    assert.deepEqual(row, { lifted_at: null, lifted_by: null })
    assert.equal((await as('target', 'select public.is_user_suspended() as active')).rows[0].active, true)
  })
})
