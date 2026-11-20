import type { SupabaseClient } from '@supabase/supabase-js'

type EmailContent = { subject: string; heading: string; message: string; link: string; buttonLabel: string; essential: boolean }
type Envelope = { from: string; to: string; subject: string; html: string }
type Delivery = {
  id: string; recipient_id: string; event_key: string; claim_token: string
  attempts: number; first_attempt_at: string | null
  outbox_payload: EmailContent; provider_payload: Envelope | null
}
type Outcome = 'sent' | 'skipped' | 'failed' | 'needs_review' | 'unrecorded'
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]!)

export function renderEmail(content: EmailContent, origin: string) {
  if (!content || !['subject', 'heading', 'message', 'link', 'buttonLabel'].every(key => typeof content[key as keyof EmailContent] === 'string')) throw new Error('Invalid queued content')
  if (!content.link.startsWith('/dashboard/') && !['/login', '/suspended'].includes(content.link)) throw new Error('Invalid queued link')
  const link = new URL(content.link, origin)
  if (link.origin !== origin || (!link.pathname.startsWith('/dashboard/') && !['/login', '/suspended'].includes(link.pathname))) throw new Error('Invalid queued link')
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#f8fafc;padding:32px;border-radius:14px"><div style="font-size:20px;font-weight:700;color:#f97316">TradesCraftConnect</div><h1 style="font-size:26px;margin:28px 0 12px">${escapeHtml(content.heading)}</h1><p style="color:#cbd5e1;font-size:16px;line-height:1.6">${escapeHtml(content.message)}</p><a href="${escapeHtml(link.href)}" style="display:inline-block;margin-top:22px;background:#f97316;color:#fff;padding:12px 22px;border-radius:9px;text-decoration:none;font-weight:700">${escapeHtml(content.buttonLabel)}</a><p style="margin-top:32px;color:#64748b;font-size:12px">This transactional email was sent because of activity on your TradesCraftConnect account.</p></div>`
}

export async function processEmailQueue(admin: SupabaseClient, config: { apiKey: string; from: string; origin: string }) {
  const counts: Record<Outcome, number> = { sent: 0, skipped: 0, failed: 0, needs_review: 0, unrecorded: 0 }
  const started = Date.now()
  // Claim one at a time: an interrupted worker leaves only the current lease.
  // Ten requests maximum; stop claiming before the function execution deadline.
  for (let index = 0; index < 10 && Date.now() - started < 45_000; index++) {
    const { data, error } = await admin.rpc('claim_email_notification_delivery')
    if (error) throw new Error('Could not claim queued email')
    const delivery = (data as Delivery[] | null)?.[0]
    if (!delivery) break

    const update = async (values: Record<string, unknown>) => {
      const result = await admin.from('email_notification_deliveries').update(values)
        .eq('id', delivery.id).eq('claim_token', delivery.claim_token).eq('status', 'pending').select('id').maybeSingle()
      return !result.error && Boolean(result.data)
    }
    const finish = async (status: Exclude<Outcome, 'unrecorded'>, reason: string | null = null, extra: Record<string, unknown> = {}) => {
      const available = new Date(Date.now() + Math.min(900, 60 * 2 ** Math.min(delivery.attempts - 1, 4)) * 1000).toISOString()
      const saved = await update({ status, error_message: reason, available_at: available, locked_until: null, claim_token: null, ...extra })
      counts[saved ? status : 'unrecorded']++
    }
    try {
      const age = delivery.first_attempt_at ? Date.now() - Date.parse(delivery.first_attempt_at) : 0
      if (!Number.isFinite(age) || age < 0 || age >= 23 * 60 * 60 * 1000) {
        await finish('needs_review', 'Provider idempotency window requires reconciliation')
        continue
      }
      // Resolve addresses from confirmed Auth identities, not editable profiles.
      const [identity, preference] = await Promise.all([
        admin.auth.admin.getUserById(delivery.recipient_id),
        admin.from('profiles').select('email_notifications_enabled').eq('id', delivery.recipient_id).maybeSingle(),
      ])
      const user = identity.data?.user
      if ((identity.error && identity.error.status !== 404) || preference.error) {
        await finish(delivery.attempts >= 10 ? 'needs_review' : 'failed', 'Recipient verification unavailable')
        continue
      }
      const optedOut = !delivery.outbox_payload.essential && preference.data?.email_notifications_enabled === false
      if (!user?.email || !user.email_confirmed_at || !preference.data || optedOut) {
        await finish(delivery.provider_payload ? 'needs_review' : 'skipped', optedOut ? 'Recipient opted out' : 'Confirmed recipient unavailable')
        continue
      }
      let envelope = delivery.provider_payload
      if (envelope && envelope.to !== user.email) {
        await finish('needs_review', 'Recipient changed after the first attempt')
        continue
      }
      if (!envelope) {
        try {
          envelope = { from: config.from, to: user.email, subject: delivery.outbox_payload.subject, html: renderEmail(delivery.outbox_payload, config.origin) }
        } catch {
          await finish('needs_review', 'Invalid queued content')
          continue
        }
        // Freeze the exact request before contacting Resend. A crashed worker
        // can replay this unchanged request with the original idempotency key.
        const saved = await update({ provider_payload: envelope, first_attempt_at: new Date().toISOString() })
        if (!saved) { counts.unrecorded++; continue }
      }
      let response: Response
      try {
        response = await fetch('https://api.resend.com/emails', {
          method: 'POST', signal: AbortSignal.timeout(10_000),
          headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `tcc:${delivery.event_key}:${delivery.recipient_id}` },
          body: JSON.stringify({ from: envelope.from, to: envelope.to, subject: envelope.subject, html: envelope.html }),
        })
      } catch {
        await finish('failed', 'Provider response unknown; retry uses the frozen request')
        continue
      }
      const result = await response.json().catch(() => null) as { id?: string; name?: string } | null
      if (!response.ok) {
        const transient = response.status >= 500 || [408, 429].includes(response.status) || (response.status === 409 && result?.name === 'concurrent_idempotent_requests')
        await finish(transient ? 'failed' : 'needs_review', `Provider rejected the request (HTTP ${response.status})`)
        continue
      }
      if (typeof result?.id !== 'string' || !result.id) { await finish('failed', 'Provider response missing message ID'); continue }
      await finish('sent', null, { provider_message_id: result.id, sent_at: new Date().toISOString() })
    } catch {
      // Do not overwrite a possibly accepted send. The lease will expire and
      // recovery reuses the durable envelope and provider idempotency key.
      counts.unrecorded++
    }
  }
  return counts
}
