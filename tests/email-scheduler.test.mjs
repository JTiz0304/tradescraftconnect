import { after, afterEach, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// Execute the actual scheduler wrapper/ACL SQL. Only extension-owned Cron,
// Vault and HTTP boundaries are simulated; no network or secret is involved.
let db
before(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema extensions; create function extensions.hmac(text,text,text) returns bytea language sql as $$ select decode(repeat('ab',32),'hex') $$;
    create schema tcc_email; create schema vault; create schema net; create schema cron;
    create table public.email_notification_deliveries(outbox_payload jsonb,status text,available_at timestamptz default now(),locked_until timestamptz);
    create table vault.decrypted_secrets(name text unique,decrypted_secret text);
    create table net.http_request_queue(id bigint generated always as identity,url text,headers jsonb,body jsonb,timeout_milliseconds int);
    create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds int) returns bigint language sql as $$
      insert into net.http_request_queue(url,body,headers,timeout_milliseconds) values ($1,$2,$3,$4) returning id $$;
    grant usage on schema net,tcc_email to anon,authenticated,service_role;
    grant all on net.http_request_queue to anon,authenticated,service_role;
    create table cron.job(jobname text primary key,schedule text,command text);
    create function cron.schedule(text,text,text) returns bigint language plpgsql as $$ begin
      insert into cron.job values ($1,$2,$3) on conflict(jobname) do update set schedule=$2,command=$3;
      return 1; end $$;
  `)
  const setup = (await readFile(new URL('../supabase/setup/email_worker_scheduler.sql',import.meta.url),'utf8')).replace(/^create extension .*;$/gm,'')
  await db.exec(setup)
  await db.exec(setup)
})
beforeEach(async () => {
  await db.exec(`begin;
    insert into public.email_notification_deliveries(outbox_payload,status) values ('{}','queued');
    insert into vault.decrypted_secrets values
      ('tcc_email_worker_url','https://www.tradescraftconnect.com/api/email-notifications/process'),
      ('tcc_email_worker_secret','isolated-test-placeholder-at-least-32-characters');`)
})
afterEach(() => db.exec('rollback'))
after(() => db.close())
const wake = async () => (await db.query('select tcc_email.wake_worker() as request_id')).rows[0].request_id
const requests = async () => (await db.query('select * from net.http_request_queue')).rows

test('scheduler wakes the production worker with an expiring signature and no business data', async () => {
  assert.ok(await wake())
  const [request] = await requests()
  assert.equal(request.url,'https://www.tradescraftconnect.com/api/email-notifications/process')
  assert.match(request.headers.Authorization,/^TCC-HMAC [0-9]+:[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(request).includes('isolated-test-placeholder'),false)
  assert.deepEqual(request.body,{})
  assert.equal(request.timeout_milliseconds,65000)
})
test('empty, completed, deferred and actively leased queues do not cause a wake', async () => {
  for (const update of ["status='sent'","status='failed',available_at=now()+interval '1 hour'","status='pending',available_at=now(),locked_until=now()+interval '1 minute'","outbox_payload=null,status='queued',available_at=now()"]){
    await db.exec(`update public.email_notification_deliveries set ${update}`)
    assert.equal(await wake(),null)
  }
  assert.equal((await requests()).length,0)
})
test('missing, short or off-origin configuration cannot transmit the worker secret', async () => {
  for (const url of ['https://preview.example.invalid/api/email-notifications/process','https://tradescraftconnect.com/api/email-notifications/process','https://www.tradescraftconnect.com/api/email-notifications/process?redirect=1']) {
    await db.query("update vault.decrypted_secrets set decrypted_secret=$1 where name='tcc_email_worker_url'",[url])
    assert.equal(await wake(),null)
  }
  await db.exec("update vault.decrypted_secrets set decrypted_secret='https://www.tradescraftconnect.com/api/email-notifications/process' where name='tcc_email_worker_url'; update vault.decrypted_secrets set decrypted_secret='short' where name='tcc_email_worker_secret'")
  assert.equal(await wake(),null)
  await db.exec('delete from vault.decrypted_secrets')
  assert.equal(await wake(),null)
  assert.equal((await requests()).length,0)
})
test('ordinary and service roles cannot read bearer headers or invoke the scheduler', async () => {
  for (const role of ['anon','authenticated','service_role']) for (const sql of ['select * from net.http_request_queue','select tcc_email.wake_worker()',"select net.http_post('https://example.invalid','{}','{}',1000)"]) {
    await db.exec(`savepoint acl; set local role ${role}`)
    await assert.rejects(db.query(sql),/permission denied/)
    await db.exec('rollback to savepoint acl')
  }
})
test('setup is repeatable and schedules one worker job every minute without a secret in its command', async () => {
  assert.deepEqual((await db.query('select * from cron.job')).rows,[{jobname:'tcc-email-worker',schedule:'* * * * *',command:'select tcc_email.wake_worker()'}])
})
