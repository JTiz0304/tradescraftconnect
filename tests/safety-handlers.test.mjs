import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { AuthSessionMissingError, isAuthSessionMissingError } from '@supabase/supabase-js'
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

// Execute the actual TS handlers with mocked boundaries, without creating
// accounts, accepting real terms, sending email, or accessing a live project.
function handler(file, name, bindings) {
  const source = ts.createSourceFile(file, readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let initializer
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) initializer = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(initializer, `Missing handler ${file}:${name}`)
  const { outputText } = ts.transpileModule(`const extracted = ${initializer.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  })
  return vm.runInNewContext(`${outputText}; extracted`, bindings)
}
function state() {
  const values = { allowed: false, accessError: false, access: 'checking', checking: true, checkError: '', reason: '', expires: null, messages: [], redirects: [], calls: [] }
  return {
    values, active: true, isAuthSessionMissingError, sendEmailNotification: async () => {},
    setAllowed: value => { values.allowed = value },
    setAccessError: value => { values.accessError = value },
    setAccess: value => { values.access = value },
    setChecking: value => { values.checking = value },
    setCheckError: value => { values.checkError = value },
    setReason: value => { values.reason = value },
    setExpires: value => { values.expires = value },
    setMessage: value => { values.messages.push(value) },
    setLoading: () => {}, setSuccess: () => {}, setBusy: () => {},
    setSaving: () => {}, setDetails: () => {},
    router: { replace: value => values.redirects.push(value), push: value => values.redirects.push(value) },
  }
}

for (const [name, user, suspended, error, expected] of [
  ['signed-out user', null, false, null, '/login'],
  ['suspended member', { id: 'test' }, true, null, '/suspended'],
  ['active member', { id: 'test' }, false, null, 'allowed'],
  ['missing migration/RPC', { id: 'test' }, null, { message: 'function not found' }, 'blocked'],
  ['unknown suspension response', { id: 'test' }, null, null, 'blocked'],
  ['malformed suspension response', { id: 'test' }, 'false', null, 'blocked'],
]) test(`dashboard access: ${name}`, async () => {
  const bindings = state()
  bindings.supabase = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    rpc: async () => ({ data: suspended, error }),
  }
  await handler('app/components/DashboardAccessGuard.tsx', 'check', bindings)()
  if (expected === 'allowed') assert.equal(bindings.values.allowed, true)
  else {
    assert.equal(bindings.values.allowed, false)
    if (expected === 'blocked') assert.equal(bindings.values.accessError, true)
    else assert.equal(bindings.values.redirects[0], expected)
  }
})

for (const [name, admin, error, expected] of [
  ['administrator', true, null, 'allowed'],
  ['ordinary member', false, null, 'denied'],
  ['failed admin RPC', null, { message: 'Unavailable' }, 'error'],
  ['missing result', null, null, 'error'],
  ['malformed result', 'true', null, 'error'],
]) test(`administrator access: ${name}`, async () => {
  const bindings = state()
  bindings.supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'member' } }, error: null }) },
    rpc: async () => ({ data: admin, error }),
  }
  await handler('app/components/AdminAccessGuard.tsx', 'checkAdminAccess', bindings)()
  assert.equal(bindings.values.access, expected)
})

test('administrator access distinguishes a missing session from a network failure', async () => {
  for (const [error, expected] of [[new AuthSessionMissingError(), 'login'], [{ message: 'Network error' }, 'error']]) {
    const bindings = state()
    bindings.supabase = { auth: { getUser: async () => ({ data: { user: null }, error }) } }
    await handler('app/components/AdminAccessGuard.tsx', 'checkAdminAccess', bindings)()
    assert.deepEqual(bindings.values.redirects, expected === 'login' ? ['/login'] : [])
    assert.equal(bindings.values.access, expected === 'login' ? 'checking' : 'error')
  }
})

test('admin queue content never renders during checking, denial or an access error', () => {
  const file = 'app/components/AdminAccessGuard.tsx'
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  })
  for (const access of ['checking', 'denied', 'error', 'allowed']) {
    const exports = {}
    const requireMock = name => {
      if (name === 'react') return { ...React, useState: () => [access, () => {}], useEffect: () => {} }
      if (name === 'react/jsx-runtime') return jsxRuntime
      if (name === 'next/navigation') return { useRouter: () => ({}) }
      if (name === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) }
      if (name === '@supabase/supabase-js') return { isAuthSessionMissingError }
      if (name === '../lib/supabase') return { supabase: {} }
      throw new Error(`Unexpected import ${name}`)
    }
    vm.runInNewContext(outputText, { exports, require: requireMock })
    const markup = renderToStaticMarkup(React.createElement(exports.default, {}, React.createElement('button', {}, 'Private queue action')))
    assert.equal(markup.includes('Private queue action'), access === 'allowed')
    if (access === 'denied') assert.ok(markup.includes('Administrator access required'))
  }
})

test('restored member rechecks access in the same session without reading old suspension details', async () => {
  const bindings = state()
  let suspended = true
  let reasonReads = 0
  bindings.supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'member' } }, error: null }) },
    rpc: async () => ({ data: suspended, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
      reasonReads++
      return { data: { reason: 'Safety report: other', expires_at: '2026-12-09T20:00:00Z' }, error: null }
    } }) }) }),
  }
  const checkAccess = handler('app/suspended/page.tsx', 'checkAccess', bindings)
  await checkAccess()
  assert.deepEqual(bindings.values.redirects, [])
  assert.equal(bindings.values.reason, 'Safety report: other')
  suspended = false
  await checkAccess()
  assert.deepEqual(bindings.values.redirects, ['/dashboard'])
  assert.equal(reasonReads, 1)
  assert.equal(bindings.values.checkError, '')
})

for (const [name, suspended, error] of [
  ['failed RPC', null, { message: 'Unavailable' }],
  ['missing response', null, null],
  ['malformed response', 'false', null],
]) test(`paused-page access check stays closed on ${name}`, async () => {
  const bindings = state()
  bindings.supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'member' } }, error: null }) },
    rpc: async () => ({ data: suspended, error }),
  }
  await handler('app/suspended/page.tsx', 'checkAccess', bindings)()
  assert.deepEqual(bindings.values.redirects, [])
  assert.ok(bindings.values.checkError.includes('try again'))
  assert.equal(bindings.values.checking, false)
})

test('paused-page recheck redirects missing sessions and recovers after a transient failure', async () => {
  const bindings = state()
  bindings.supabase = { auth: { getUser: async () => ({ data: { user: null }, error: new AuthSessionMissingError() }) } }
  const checkAccess = handler('app/suspended/page.tsx', 'checkAccess', bindings)
  await checkAccess()
  assert.deepEqual(bindings.values.redirects, ['/login'])
  bindings.values.redirects.length = 0
  bindings.supabase.auth.getUser = async () => { throw new Error('Network failure') }
  await checkAccess()
  assert.deepEqual(bindings.values.redirects, [])
  assert.ok(bindings.values.checkError)
  bindings.supabase.auth.getUser = async () => ({ data: { user: { id: 'member' } }, error: null })
  bindings.supabase.rpc = async () => ({ data: false, error: null })
  await checkAccess()
  assert.deepEqual(bindings.values.redirects, ['/dashboard'])
  assert.equal(bindings.values.checkError, '')
})

test('paused-page check cannot redirect after the member leaves the page', async () => {
  const bindings = state()
  bindings.supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'member' } }, error: null }) },
    rpc: async () => { bindings.active = false; return { data: false, error: null } },
  }
  await handler('app/suspended/page.tsx', 'checkAccess', bindings)()
  assert.deepEqual(bindings.values.redirects, [])
})
test('auth errors and thrown network failures block access', async () => {
  for (const auth of [
    { getUser: async () => ({ data: { user: null }, error: { message: 'Network failure' } }) },
    { getUser: async () => { throw new Error('Network failure') } },
  ]) {
    const bindings = state()
    bindings.supabase = { auth }
    await handler('app/components/DashboardAccessGuard.tsx', 'check', bindings)()
    assert.equal(bindings.values.allowed, false)
    assert.equal(bindings.values.accessError, true)
    assert.deepEqual(bindings.values.redirects, [])
  }
})
test('Supabase missing-session error redirects to login rather than a retry loop', async () => {
  const bindings = state()
  bindings.supabase = { auth: { getUser: async () => ({ data: { user: null }, error: new AuthSessionMissingError() }) } }
  await handler('app/components/DashboardAccessGuard.tsx', 'check', bindings)()
  assert.equal(bindings.values.allowed, false)
  assert.equal(bindings.values.accessError, false)
  assert.deepEqual(bindings.values.redirects, ['/login'])
})
test('a check completing after unmount cannot grant access or redirect', async () => {
  const bindings = state()
  bindings.active = false
  bindings.supabase = { auth: { getUser: async () => ({ data: { user: { id: 'test' } }, error: null }) } }
  await handler('app/components/DashboardAccessGuard.tsx', 'check', bindings)()
  assert.equal(bindings.values.allowed, false)
  assert.deepEqual(bindings.values.redirects, [])
})

for (const [name, notes, saved, expected] of [
  ['preserves a saved note', {}, 'Saved private note', 'Saved private note'],
  ['saves the edited note', { report: '  Updated note  ' }, 'Saved note', 'Updated note'],
  ['allows explicitly clearing a note', { report: '' }, 'Saved note', null],
]) test(`admin review ${name}`, async () => {
  const bindings = state()
  Object.assign(bindings, {
    notes, load: async () => {},
    supabase: { rpc: async (name, args) => { bindings.values.calls.push({ name, args }); return { error: null } } },
  })
  await handler('app/dashboard/admin/reports/page.tsx', 'review', bindings)({ id: 'report', resolution_notes: saved }, 'resolved')
  assert.equal(bindings.values.calls[0].args.admin_notes, expected)
  assert.equal(bindings.values.calls[0].args.decision, 'resolved')
})
test('suspend keeps administrator notes private and requests 30 days', async () => {
  const bindings = state()
  Object.assign(bindings, {
    notes: { report: 'Private draft note' }, review: async () => {},
    supabase: { rpc: async (name, args) => { bindings.values.calls.push({ name, args }); return { error: null } } },
  })
  const started = Date.now()
  await handler('app/dashboard/admin/reports/page.tsx', 'suspend', bindings)({ id: 'report', reported_user_id: 'target', resolution_notes: 'Saved reason', category: 'unsafe' })
  const args = bindings.values.calls[0].args
  assert.equal(args.admin_reason, 'Safety report: unsafe')
  assert.equal(args.target_user, 'target')
  assert.equal(args.suspend, true)
  const days30 = 30 * 24 * 60 * 60 * 1000
  assert.ok(Date.parse(args.suspension_expires_at) >= started + days30)
  assert.ok(Date.parse(args.suspension_expires_at) <= Date.now() + days30)
})
test('restore requests a lift without a new suspension reason or expiry', async () => {
  const bindings = state()
  bindings.supabase = { rpc: async (name, args) => { bindings.values.calls.push({ name, args }); return { error: null } } }
  await handler('app/dashboard/admin/reports/page.tsx', 'lift', bindings)({ id: 'report', reported_user_id: 'target' })
  const args = bindings.values.calls[0].args
  assert.equal(args.suspend, false)
  assert.equal(args.admin_reason, null)
  assert.equal(args.suspension_expires_at, null)
})

for (const [name, suspensionError, reviewError, expected] of [
  ['both actions succeed', null, null, 'Account suspended for 30 days. Report marked resolved.'],
  ['report resolution fails after suspension', null, { message: 'Connection lost' }, 'Account suspended for 30 days, but report resolution did not save: Connection lost'],
  ['suspension fails', { message: 'Permission denied' }, null, 'Account was not suspended: Permission denied'],
]) test(`suspension confirmation: ${name}`, async () => {
  const bindings = state()
  let loads = 0
  Object.assign(bindings, {
    notes: {}, load: async () => { loads++ },
    supabase: { rpc: async (name, args) => {
      bindings.values.calls.push({ name, args })
      return { error: name === 'set_member_suspension' ? suspensionError : reviewError }
    } },
  })
  bindings.review = handler('app/dashboard/admin/reports/page.tsx', 'review', { ...bindings })
  await handler('app/dashboard/admin/reports/page.tsx', 'suspend', bindings)({ id: 'report', reported_user_id: 'target', category: 'other', resolution_notes: 'Private note' })
  assert.equal(bindings.values.messages.at(-1), expected)
  assert.deepEqual(bindings.values.calls.map(call => call.name), suspensionError ? ['set_member_suspension'] : ['set_member_suspension', 'review_member_report'])
  assert.equal(loads, !suspensionError && !reviewError ? 1 : 0)
  if (!suspensionError) assert.equal(bindings.values.calls[1].args.admin_notes, 'Private note')
})

test('policy checkbox blocks signup when unchecked', async () => {
  const bindings = state()
  bindings.accepted = false
  bindings.supabase = { auth: { signUp: async () => { throw new Error('Signup must not be called') } } }
  await handler('app/signup/page.tsx', 'handleSignup', bindings)()
  assert.ok(bindings.values.messages.some(value => value.includes('accept')))
})
test('accepted policy sends version and timestamp to mocked Auth', async () => {
  const bindings = state()
  Object.assign(bindings, {
    accepted: true, email: 'isolated@example.invalid', password: 'test-only-not-a-real-account',
    supabase: { auth: { signUp: async args => { bindings.values.calls.push(args); return { data: { session: {} }, error: null } } } },
  })
  await handler('app/signup/page.tsx', 'handleSignup', bindings)()
  const metadata = bindings.values.calls[0].options.data
  assert.equal(metadata.terms_version, '2026-10-12')
  assert.ok(Number.isFinite(Date.parse(metadata.terms_accepted_at)))
  assert.equal(bindings.values.redirects[0], '/onboarding')
})
test('report validation stops short details before calling Auth', async () => {
  const bindings = state()
  bindings.details = '  short  '
  await handler('app/components/ReportButton.tsx', 'submit', bindings)()
  assert.ok(bindings.values.messages.some(value => value.includes('10 characters')))
})
test('report sends only the allowed submission columns without requesting a row back', async () => {
  const bindings = state()
  Object.assign(bindings, {
    details: '  Isolated test concern  ', category: 'unsafe', entityType: 'job', entityId: 'job', reportedUserId: 'target',
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: 'reporter' } } }) },
      from: table => ({ insert: async args => { bindings.values.calls.push({ table, args }); return { error: null } } }),
    },
  })
  await handler('app/components/ReportButton.tsx', 'submit', bindings)()
  const call = bindings.values.calls[0]
  assert.equal(call.table, 'member_reports')
  assert.deepEqual(Object.keys(call.args).sort(), ['reporter_id', 'reported_user_id', 'entity_type', 'entity_id', 'category', 'details'].sort())
  assert.equal(call.args.details, 'Isolated test concern')
  assert.ok(bindings.values.messages.some(value => value.startsWith('Thank you')))
})
