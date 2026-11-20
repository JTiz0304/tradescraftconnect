import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { timingSafeEqual } from 'node:crypto'

const compile = path => ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const compiled = compile('app/lib/emailQueue.ts')
const route = compile('app/api/email-notifications/process/route.ts')
const compatibility = compile('app/api/email-notifications/route.ts')
const config = { apiKey: 'isolated-test-key', from: 'Test <sender@example.invalid>', origin: 'https://app.example.invalid' }
const content = { subject: 'Application update', heading: 'Test <heading>', message: 'Private message <script>alert(1)</script>', link: '/dashboard/my-applications', buttonLabel: 'View & review', essential: false }

// Actual worker and route, simulated database/provider boundaries. No credentials
// or network access. Real queue SQL/roles/transactions are covered separately.
function harness() {
  const row = { id: 'delivery', recipient_id: 'member', event_key: 'application_status:event:reviewing', status: 'queued', attempts: 0, first_attempt_at: null, provider_payload: null, outbox_payload: { ...content }, available_at: new Date(0).toISOString(), claim_token: null, locked_until: null }
  const ctx = { rows: [row], row, calls: [], accepted: new Map(), enabled: true, email: 'confirmed@example.invalid', confirmed: true, userMissing: false, profileMissing: false, identityError: false, preferenceError: false, claimError: false, freezeError: false, logError: false, providerStatus: 200, providerName: 'test_error', providerMalformed: false, loseResponse: false }
  let token = 0
  class Query {
    constructor(table) { this.table = table; this.filters = [] }
    select() { return this }
    eq(key, value) { this.filters.push([key,value]); return this }
    update(values) { this.values = values; return this }
    async maybeSingle() {
      if (this.table === 'profiles') return { data: ctx.profileMissing ? null : { email_notifications_enabled: ctx.enabled, email: 'unverified-editable@example.invalid' }, error: ctx.preferenceError ? { message: 'Offline' } : null }
      const match = ctx.rows.find(r => this.filters.every(([key,value]) => r[key] === value))
      if (!match) return { data: null, error: null }
      if ((this.values.provider_payload && ctx.freezeError) || (this.values.status === 'sent' && ctx.logError)) return { data: null, error: { message: 'Write unavailable' } }
      Object.assign(match, structuredClone(this.values))
      return { data: { id: match.id }, error: null }
    }
  }
  ctx.admin = {
    from: table => new Query(table),
    rpc: async () => {
      if (ctx.claimError) return { data: null, error: { message: 'Queue unavailable' } }
      const candidate = ctx.rows.find(r => Date.parse(r.available_at) <= Date.now() && (['queued','failed'].includes(r.status) || (r.status === 'pending' && Date.parse(r.locked_until) <= Date.now())))
      if (!candidate) return { data: [], error: null }
      candidate.status = 'pending'; candidate.attempts++; candidate.claim_token = `lease-${++token}`; candidate.locked_until = new Date(Date.now()+300000).toISOString()
      return { data: [structuredClone(candidate)], error: null }
    },
    auth: { admin: { getUserById: async () => ({ data: { user: ctx.userMissing ? null : { email: ctx.email, email_confirmed_at: ctx.confirmed ? '2026-01-01T00:00:00Z' : null } }, error: ctx.identityError ? { status: 503 } : ctx.userMissing ? { status: 404 } : null }) } },
  }
  const exports = {}
  vm.runInNewContext(compiled, { exports, URL, AbortSignal, Response, fetch: async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails')
    ctx.calls.push({ ...options, payload: JSON.parse(options.body) })
    if (ctx.providerStatus !== 200) return Response.json({ name: ctx.providerName }, { status: ctx.providerStatus })
    const key = options.headers['Idempotency-Key']
    if (!ctx.accepted.has(key)) ctx.accepted.set(key, { id: `provider-${ctx.accepted.size+1}`, body: options.body })
    else assert.equal(options.body, ctx.accepted.get(key).body, 'Provider retries must be byte-identical')
    if (ctx.loseResponse) throw new Error('Lost provider response')
    return Response.json(ctx.providerMalformed ? {} : { id: ctx.accepted.get(key).id })
  } })
  ctx.process = (overrides = {}) => exports.processEmailQueue(ctx.admin, { ...config, ...overrides })
  ctx.render = exports.renderEmail
  ctx.due = () => { row.available_at = new Date(0).toISOString(); row.locked_until = new Date(0).toISOString() }
  ctx.route = async (env = {}, authorization = 'Bearer ' + 's'.repeat(40)) => {
    const result = {}
    const settings = { EMAIL_WORKER_SECRET: 's'.repeat(40), NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-service', RESEND_API_KEY: 'test-resend', EMAIL_FROM: config.from, EMAIL_APP_URL: config.origin, ...env }
    vm.runInNewContext(route, { exports: result, process: { env: settings }, Buffer, URL, console: { info() {}, error() {} }, require: name => {
      if (name === 'node:crypto') return { timingSafeEqual }
      if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } }
      if (name === '@supabase/supabase-js') return { createClient: () => ctx.admin }
      if (name.endsWith('/emailQueue')) return { processEmailQueue: exports.processEmailQueue }
      throw new Error(`Unexpected import ${name}`)
    } })
    return result.POST(new Request('https://untrusted-host.example.invalid/api/email-notifications/process', { method: 'POST', headers: authorization ? { authorization } : {} }))
  }
  return ctx
}

test('queued event sends without a browser and uses confirmed Auth email instead of editable profile email', async () => {
  const ctx = harness(); const result = await ctx.process()
  assert.equal(result.sent, 1); assert.equal(ctx.row.status, 'sent')
  assert.equal(ctx.calls[0].payload.to, 'confirmed@example.invalid')
  assert.ok(ctx.row.first_attempt_at); assert.ok(ctx.row.provider_payload)
  assert.equal(ctx.row.provider_message_id, 'provider-1')
  assert.ok(ctx.calls[0].headers['Idempotency-Key'].length <= 256)
})
test('completed sends are not claimed or delivered twice', async () => {
  const ctx = harness(); await ctx.process(); await ctx.process()
  assert.equal(ctx.calls.length, 1); assert.equal(ctx.accepted.size, 1)
})
test('overlapping worker invocations do not share an active lease', async () => {
  const ctx = harness(); await Promise.all([ctx.process(),ctx.process()])
  assert.equal(ctx.calls.length, 1)
})
test('recipient opting out after enqueue suppresses the unsent notice', async () => {
  const ctx = harness(); ctx.enabled = false; const result = await ctx.process()
  assert.equal(result.skipped, 1); assert.equal(ctx.calls.length, 0)
})
test('essential account notices still send after optional-email opt-out', async () => {
  const ctx = harness(); ctx.enabled = false; ctx.row.outbox_payload.essential = true
  assert.equal((await ctx.process()).sent, 1)
})
test('unconfirmed, deleted or missing recipients are skipped before provider contact', async () => {
  for (const change of [{ confirmed: false },{ userMissing: true },{ profileMissing: true }]) {
    const ctx = harness(); Object.assign(ctx, change)
    assert.equal((await ctx.process()).skipped, 1); assert.equal(ctx.calls.length, 0)
  }
})
test('identity and preference lookup failures retry without provider contact', async () => {
  for (const key of ['identityError','preferenceError']) {
    const ctx = harness(); ctx[key] = true
    assert.equal((await ctx.process()).failed, 1); assert.equal(ctx.calls.length, 0)
    assert.ok(Date.parse(ctx.row.available_at) > Date.now())
  }
})
test('repeated recipient-verification failures become visible review work', async () => {
  const ctx = harness(); ctx.identityError = true; ctx.row.attempts = 9
  assert.equal((await ctx.process()).needs_review, 1)
})
test('failure to freeze provider payload prevents a send', async () => {
  const ctx = harness(); ctx.freezeError = true
  assert.equal((await ctx.process()).unrecorded, 1); assert.equal(ctx.calls.length, 0)
  assert.equal(ctx.row.status, 'pending')
})
test('lost response retries the exact frozen request even after sender/origin configuration changes', async () => {
  const ctx = harness(); ctx.loseResponse = true
  assert.equal((await ctx.process()).failed, 1); assert.equal(ctx.accepted.size, 1)
  ctx.loseResponse = false; ctx.due()
  assert.equal((await ctx.process({ from: 'Changed <changed@example.invalid>', origin: 'https://changed.example.invalid' })).sent, 1)
  assert.equal(ctx.calls.length, 2); assert.equal(ctx.accepted.size, 1)
  assert.equal(ctx.calls[0].body, ctx.calls[1].body)
})
test('an interrupted success-log write recovers with the original provider idempotency key', async () => {
  const ctx = harness(); ctx.logError = true
  assert.equal((await ctx.process()).unrecorded, 1)
  assert.equal(ctx.row.status, 'pending'); ctx.logError = false; ctx.due()
  assert.equal((await ctx.process()).sent, 1); assert.equal(ctx.accepted.size, 1)
})
test('an interrupted worker recovers a pre-frozen request after its lease expires', async () => {
  const ctx = harness(); ctx.row.status = 'pending'; ctx.row.claim_token = 'abandoned'
  ctx.row.locked_until = new Date(Date.now()+300000).toISOString()
  ctx.row.first_attempt_at = new Date().toISOString()
  ctx.row.provider_payload = { from: config.from, to: ctx.email, subject: 'Original', html: '<p>Frozen original</p>' }
  assert.equal((await ctx.process()).sent, 0); ctx.due()
  assert.equal((await ctx.process()).sent, 1)
  assert.equal(ctx.calls[0].payload.subject, 'Original')
})
test('attempts outside the provider safety window require review without replay', async () => {
  const ctx = harness(); ctx.row.first_attempt_at = new Date(Date.now()-24*60*60*1000).toISOString()
  assert.equal((await ctx.process()).needs_review, 1); assert.equal(ctx.calls.length, 0)
})
test('an old unattempted queue item can still send', async () => {
  const ctx = harness(); ctx.row.created_at = new Date(Date.now()-3*24*60*60*1000).toISOString()
  assert.equal((await ctx.process()).sent, 1)
})
test('changed recipient or opt-out after an uncertain attempt requires reconciliation', async () => {
  for (const change of [{ email: 'changed@example.invalid' },{ enabled: false }]) {
    const ctx = harness(); ctx.loseResponse = true; await ctx.process(); ctx.loseResponse = false; ctx.due(); Object.assign(ctx,change)
    assert.equal((await ctx.process()).needs_review, 1); assert.equal(ctx.calls.length, 1)
  }
})
test('transient provider errors back off and later succeed', async () => {
  for (const status of [408,429,500,503]) {
    const ctx = harness(); ctx.providerStatus = status
    assert.equal((await ctx.process()).failed, 1); assert.ok(Date.parse(ctx.row.available_at) > Date.now())
    ctx.providerStatus = 200; ctx.due(); assert.equal((await ctx.process()).sent, 1)
    assert.equal(ctx.calls[0].headers['Idempotency-Key'], ctx.calls[1].headers['Idempotency-Key'])
  }
})
test('permanent provider rejection and conflicting request keys require review', async () => {
  for (const status of [400,401,403,409,422]) {
    const ctx = harness(); ctx.providerStatus = status
    assert.equal((await ctx.process()).needs_review, 1); await ctx.process(); assert.equal(ctx.calls.length, 1)
  }
})
test('provider concurrent-idempotency response is safely retried', async () => {
  const ctx = harness(); ctx.providerStatus = 409; ctx.providerName = 'concurrent_idempotent_requests'
  assert.equal((await ctx.process()).failed, 1)
})
test('missing provider message ID is retried using the durable envelope', async () => {
  const ctx = harness(); ctx.providerMalformed = true
  assert.equal((await ctx.process()).failed, 1); ctx.providerMalformed = false; ctx.due()
  assert.equal((await ctx.process()).sent, 1); assert.equal(ctx.accepted.size, 1)
})
test('queued HTML and labels are escaped; unsafe links cannot reach the provider', async () => {
  const ctx = harness(); await ctx.process()
  assert.ok(ctx.calls[0].payload.html.includes('&lt;script&gt;'))
  assert.ok(ctx.calls[0].payload.html.includes('View &amp; review'))
  for (const link of ['//evil.example.invalid/dashboard/test','https://evil.example.invalid','/dashboard/../../outside']) {
    const other = harness(); other.row.outbox_payload.link = link
    assert.equal((await other.process()).needs_review, 1); assert.equal(other.calls.length, 0)
  }
})
test('worker batches remain bounded', async () => {
  const ctx = harness(); for (let index=1;index<12;index++) ctx.rows.push({ ...structuredClone(ctx.row), id:`delivery-${index}`, event_key:`event-${index}` })
  assert.equal((await ctx.process()).sent, 10); assert.equal(ctx.calls.length, 10)
})
test('worker claim errors fail without contacting the provider', async () => {
  const ctx = harness(); ctx.claimError = true; await assert.rejects(ctx.process(), /Could not claim/); assert.equal(ctx.calls.length, 0)
})
test('worker route rejects missing/wrong credentials before reading the queue', async () => {
  const ctx = harness()
  for (const auth of ['', 'Bearer wrong', 'Bearer '+'x'.repeat(40)]) assert.equal((await ctx.route({},auth)).status, 401)
  assert.equal(ctx.row.attempts, 0)
})
test('missing worker secret/configuration stays closed', async () => {
  const ctx = harness()
  for (const env of [{ EMAIL_WORKER_SECRET: '' },{ EMAIL_WORKER_SECRET: 'short' },{ RESEND_API_KEY: '' },{ EMAIL_APP_URL: '' }]) assert.equal((await ctx.route(env)).status, 503)
  assert.equal(ctx.row.attempts, 0)
})
test('route uses configured canonical links and returns only aggregate counts', async () => {
  const ctx = harness(); const response = await ctx.route(); assert.equal(response.status, 200)
  const result = await response.json(); assert.equal(result.sent, 1)
  assert.equal(JSON.stringify(result).includes(ctx.email), false)
  assert.ok(ctx.calls[0].payload.html.includes(config.origin+'/dashboard/my-applications'))
})
test('invalid canonical origins and queue errors return a service error', async () => {
  const ctx = harness()
  for (const origin of ['http://app.example.invalid','https://app.example.invalid/','https://user:pass@app.example.invalid']) assert.equal((await ctx.route({ EMAIL_APP_URL: origin })).status, 503)
  ctx.claimError = true; assert.equal((await ctx.route()).status, 503)
})
test('legacy browser endpoint is inert and accepts no request-supplied event', async () => {
  const exports = {}; vm.runInNewContext(compatibility, { exports, require: () => ({ NextResponse: { json: (body,init) => Response.json(body,init) } }) })
  const response = await exports.POST(new Request('https://app.example.invalid/api/email-notifications', { method: 'POST', body: JSON.stringify({ eventType:'account_suspension',relatedId:'someone-else' }) }))
  assert.equal(response.status, 202); assert.deepEqual(await response.json(), { queuedByBusinessEvent:true })
})
