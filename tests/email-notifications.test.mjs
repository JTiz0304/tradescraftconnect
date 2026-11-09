import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../app/api/email-notifications/route.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText

// Exercise the real server endpoint with in-memory database/provider boundaries.
// There are no real credentials, live queries, new accounts, or outbound emails.
function harness() {
  const ctx = {
    tables: {
      profiles: [
        { id: 'employer', full_name: 'Employer', email: 'employer@example.invalid', email_notifications_enabled: true },
        { id: 'worker', full_name: 'Worker', email: 'worker@example.invalid', email_notifications_enabled: true },
        { id: 'admin', full_name: 'Admin', email: 'admin@example.invalid', email_notifications_enabled: true },
      ],
      admin_users: [{ user_id: 'admin' }],
      job_postings: [{ id: 'job', poster_id: 'employer', title: 'Electrician opportunity' }],
      job_applications: [{ id: 'application', applicant_id: 'worker', job_id: 'job', status: 'reviewing' }],
      application_messages: [{ id: 'message', application_id: 'application', sender_id: 'worker', recipient_id: 'employer' }],
      certifications: [{ id: 'certificate', user_id: 'worker', cert_name: 'Test licence', verification_status: 'verified' }],
      member_suspensions: [{ user_id: 'worker', reason: 'Safety report: unsafe', suspended_at: '2026-11-01T00:00:00Z', expires_at: '2026-12-01T00:00:00Z', lifted_at: null }],
      email_notification_deliveries: [],
    },
    sendCalls: [], suspended: new Set(), reservationFailure: false, lookupFailure: false,
    logFailure: false, providerThrows: false, malformedProvider: false,
    providerError: null, accessError: null, accessData: undefined, authError: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service', RESEND_API_KEY: 'test-resend', EMAIL_FROM: 'Test <test@example.invalid>',
    },
  }
  let nextId = 0
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.op = 'read' }
    select() { return this }
    eq(key, value) { this.filters.push([key, value]); return this }
    insert(payload) { this.op = 'insert'; this.payload = payload; return this }
    update(payload) { this.op = 'update'; this.payload = payload; return this }
    matches(row) { return this.filters.every(([key, value]) => row[key] === value) }
    run() {
      const rows = ctx.tables[this.table]
      if (!rows) return { data: null, error: { code: '42P01', message: 'Missing table' } }
      if (this.op === 'read') {
        if (this.table === 'email_notification_deliveries' && ctx.lookupFailure) return { data: null, error: { message: 'Lookup failed' } }
        return { data: rows.filter(row => this.matches(row)).map(row => ({ ...row })), error: null }
      }
      if (this.op === 'insert') {
        if (ctx.reservationFailure) return { data: null, error: { code: '42P01', message: 'Reservation failed' } }
        if (rows.some(row => row.event_key === this.payload.event_key && row.recipient_id === this.payload.recipient_id)) {
          return { data: null, error: { code: '23505', message: 'Unique constraint' } }
        }
        const row = { id: `delivery-${++nextId}`, created_at: new Date().toISOString(), ...this.payload }
        rows.push(row)
        return { data: [{ ...row }], error: null }
      }
      if (this.op === 'update') {
        if (this.payload.status === 'sent' && ctx.logFailure) return { data: null, error: { message: 'Logging unavailable' } }
        const matched = rows.filter(row => this.matches(row))
        matched.forEach(row => Object.assign(row, this.payload))
        return { data: matched.map(row => ({ ...row })), error: null }
      }
      throw new Error(`Unsupported operation: ${this.op}`)
    }
    async single() { const r = this.run(); return r.error ? r : { data: r.data[0] ?? null, error: r.data.length === 1 ? null : { message: 'Expected one row' } } }
    async maybeSingle() { const r = this.run(); return r.error ? r : { data: r.data[0] ?? null, error: null } }
    then(resolve, reject) { return Promise.resolve(this.run()).then(resolve, reject) }
  }
  const createClient = (_url, key, options) => {
    if (key === 'test-service') return { from: table => new Query(table) }
    const actor = options.global.headers.Authorization.replace('Bearer test-', '')
    return {
      auth: { getUser: async () => ({ data: { user: actor === 'invalid' ? null : { id: actor } }, error: ctx.authError ? { message: 'Auth failed' } : null }) },
      rpc: async () => ({ data: ctx.accessData === undefined ? ctx.suspended.has(actor) : ctx.accessData, error: ctx.accessError }),
    }
  }
  class Resend {
    emails = { send: async (payload, options) => {
      ctx.sendCalls.push({ payload, options })
      if (ctx.providerThrows) throw new Error('Provider response lost')
      if (ctx.providerError) return { data: null, error: ctx.providerError }
      return { data: ctx.malformedProvider ? null : { id: `provider-${ctx.sendCalls.length}` }, error: null }
    } }
  }
  const exports = {}
  vm.runInNewContext(compiled, {
    exports, process: { env: ctx.env }, URL,
    require: name => {
      if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } }
      if (name === '@supabase/supabase-js') return { createClient }
      if (name === 'resend') return { Resend }
      throw new Error(`Unexpected import: ${name}`)
    },
  })
  ctx.request = (eventType = 'application_message', relatedId = 'message', actor = 'worker', authenticated = true) => exports.POST(new Request('https://preview.example.invalid/api/email-notifications', {
    method: 'POST', headers: { 'content-type': 'application/json', ...(authenticated ? { authorization: `Bearer test-${actor}` } : {}) },
    body: JSON.stringify({ eventType, relatedId }),
  }))
  return ctx
}

test('message email goes to the persisted recipient, not the sender', async () => {
  const ctx = harness()
  assert.equal((await ctx.request()).status, 200)
  assert.equal(ctx.sendCalls[0].payload.to, 'employer@example.invalid')
  assert.equal(ctx.tables.email_notification_deliveries[0].recipient_id, 'employer')
  assert.equal(ctx.tables.email_notification_deliveries[0].status, 'sent')
  assert.ok(ctx.sendCalls[0].options.idempotencyKey.includes('application_message:message'))
  assert.ok(ctx.sendCalls[0].options.idempotencyKey.length <= 256)
})
test('employer-to-applicant messages notify the applicant', async () => {
  const ctx = harness()
  Object.assign(ctx.tables.application_messages[0], { sender_id: 'employer', recipient_id: 'worker' })
  assert.equal((await ctx.request('application_message', 'message', 'employer')).status, 200)
  assert.equal(ctx.sendCalls[0].payload.to, 'worker@example.invalid')
})
test('another member cannot trigger someone else’s message notification', async () => {
  const ctx = harness()
  assert.equal((await ctx.request('application_message', 'message', 'outsider')).status, 403)
  assert.equal(ctx.sendCalls.length, 0)
})
test('application status changes notify the applicant only when requested by the employer', async () => {
  const ctx = harness()
  ctx.tables.job_applications[0].status = 'hired'
  assert.equal((await ctx.request('application_status', 'application', 'employer')).status, 200)
  assert.equal(ctx.sendCalls[0].payload.to, 'worker@example.invalid')
  assert.ok(ctx.sendCalls[0].payload.html.includes('hired'))
  assert.equal((await ctx.request('application_status', 'application', 'worker')).status, 403)
})
test('new applications notify the employer', async () => {
  const ctx = harness()
  assert.equal((await ctx.request('new_application', 'application')).status, 200)
  assert.equal(ctx.sendCalls[0].payload.to, 'employer@example.invalid')
})
test('missing and invalid authentication are rejected', async () => {
  const ctx = harness()
  assert.equal((await ctx.request('application_message', 'message', 'worker', false)).status, 401)
  assert.equal((await ctx.request('application_message', 'message', 'invalid')).status, 401)
  ctx.authError = true
  assert.equal((await ctx.request()).status, 401)
  assert.equal(ctx.sendCalls.length, 0)
})
test('missing email configuration does not send', async () => {
  const ctx = harness()
  delete ctx.env.SUPABASE_SERVICE_ROLE_KEY
  assert.equal((await ctx.request()).status, 503)
  assert.equal(ctx.sendCalls.length, 0)
})
test('suspended callers cannot use the service-role email endpoint', async () => {
  const ctx = harness()
  ctx.suspended.add('worker')
  assert.equal((await ctx.request()).status, 403)
  assert.equal(ctx.sendCalls.length, 0)
})
test('missing suspension RPC or an unknown result blocks sending', async () => {
  const ctx = harness()
  ctx.accessError = { message: 'Function missing' }
  assert.equal((await ctx.request()).status, 503)
  ctx.accessError = null
  ctx.accessData = null
  assert.equal((await ctx.request()).status, 503)
  assert.equal(ctx.sendCalls.length, 0)
})
test('nonessential email respects recipient opt-out', async () => {
  const ctx = harness()
  ctx.tables.profiles[0].email_notifications_enabled = false
  const response = await ctx.request()
  assert.equal((await response.json()).skipped, true)
  assert.equal(ctx.sendCalls.length, 0)
  assert.equal(ctx.tables.email_notification_deliveries.length, 0)
})
test('mandatory account-access notice is delivered despite opt-out', async () => {
  const ctx = harness()
  ctx.tables.profiles[1].email_notifications_enabled = false
  assert.equal((await ctx.request('account_suspension', 'worker', 'admin')).status, 200)
  assert.equal(ctx.sendCalls[0].payload.to, 'worker@example.invalid')
  assert.equal((await ctx.request('account_suspension', 'worker')).status, 403)
})
test('credential decisions require administrator access', async () => {
  const ctx = harness()
  assert.equal((await ctx.request('certification_review', 'certificate')).status, 403)
  assert.equal((await ctx.request('certification_review', 'certificate', 'admin')).status, 200)
  assert.equal(ctx.sendCalls[0].payload.to, 'worker@example.invalid')
})
test('separate restorations each notify once', async () => {
  const ctx = harness()
  const suspension = ctx.tables.member_suspensions[0]
  suspension.lifted_at = '2026-11-02T00:00:00Z'
  assert.equal((await ctx.request('account_suspension', 'worker', 'admin')).status, 200)
  suspension.lifted_at = '2026-11-03T00:00:00Z'
  assert.equal((await ctx.request('account_suspension', 'worker', 'admin')).status, 200)
  assert.equal((await ctx.request('account_suspension', 'worker', 'admin')).status, 200)
  assert.equal(ctx.sendCalls.length, 2)
  assert.notEqual(ctx.sendCalls[0].options.idempotencyKey, ctx.sendCalls[1].options.idempotencyKey)
})
test('a repeated successful event does not send twice', async () => {
  const ctx = harness()
  await ctx.request()
  const repeated = await ctx.request()
  assert.equal((await repeated.json()).duplicate, true)
  assert.equal(ctx.sendCalls.length, 1)
})
test('simultaneous duplicate requests reserve only one sender', async () => {
  const ctx = harness()
  const responses = await Promise.all([ctx.request(), ctx.request(), ctx.request()])
  assert.ok(responses.every(response => [200, 202].includes(response.status)))
  assert.equal(ctx.sendCalls.length, 1)
  assert.equal(ctx.tables.email_notification_deliveries.length, 1)
})
test('recent failed sends retry with the same provider idempotency key', async () => {
  const ctx = harness()
  ctx.providerError = { message: 'Temporary rejection' }
  assert.equal((await ctx.request()).status, 502)
  assert.equal(ctx.tables.email_notification_deliveries[0].status, 'failed')
  ctx.providerError = null
  assert.equal((await ctx.request()).status, 200)
  assert.equal(ctx.sendCalls.length, 2)
  assert.equal(ctx.sendCalls[0].options.idempotencyKey, ctx.sendCalls[1].options.idempotencyKey)
})
test('simultaneous retries claim a failed delivery once', async () => {
  const ctx = harness()
  ctx.providerError = { message: 'Temporary rejection' }
  await ctx.request()
  ctx.providerError = null
  await Promise.all([ctx.request(), ctx.request()])
  assert.equal(ctx.sendCalls.length, 2)
  assert.equal(ctx.tables.email_notification_deliveries[0].status, 'sent')
})
test('failed reservations stop before contacting the provider', async () => {
  const ctx = harness()
  ctx.reservationFailure = true
  assert.equal((await ctx.request()).status, 503)
  assert.equal(ctx.sendCalls.length, 0)
})
test('failed duplicate lookups do not send again', async () => {
  const ctx = harness()
  await ctx.request()
  ctx.lookupFailure = true
  assert.equal((await ctx.request()).status, 503)
  assert.equal(ctx.sendCalls.length, 1)
})
test('old failed deliveries require review outside the provider safety window', async () => {
  const ctx = harness()
  ctx.tables.email_notification_deliveries.push({ id: 'old', event_key: 'application_message:message', recipient_id: 'employer', status: 'failed', created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() })
  assert.equal((await ctx.request()).status, 409)
  assert.equal(ctx.sendCalls.length, 0)
})
test('lost provider response leaves a pending reservation and prevents blind resend', async () => {
  const ctx = harness()
  ctx.providerThrows = true
  assert.equal((await ctx.request()).status, 503)
  ctx.providerThrows = false
  assert.equal((await ctx.request()).status, 202)
  assert.equal(ctx.tables.email_notification_deliveries[0].status, 'pending')
  assert.equal(ctx.sendCalls.length, 1)
})
test('failure to record provider success does not report a clean success or resend', async () => {
  const ctx = harness()
  ctx.logFailure = true
  assert.equal((await ctx.request()).status, 503)
  ctx.logFailure = false
  assert.equal((await ctx.request()).status, 202)
  assert.equal(ctx.sendCalls.length, 1)
})
test('missing provider message ID remains an uncertain delivery', async () => {
  const ctx = harness()
  ctx.malformedProvider = true
  assert.equal((await ctx.request()).status, 503)
  assert.equal(ctx.tables.email_notification_deliveries[0].status, 'pending')
})
