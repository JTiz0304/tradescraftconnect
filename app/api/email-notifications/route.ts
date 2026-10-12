import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

type EmailEventType =
  | 'new_application'
  | 'application_status'
  | 'application_message'
  | 'certification_review'
  | 'account_suspension'

type EmailDetails = {
  recipientId: string
  eventKey: string
  subject: string
  heading: string
  message: string
  link: string
  buttonLabel: string
  essential?: boolean
}

const escapeHtml = (value: string) => value.replace(
  /[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character,
)

const statusLabel = (status: string) => ({
  new: 'received',
  reviewing: 'under review',
  interviewing: 'moved to interviewing',
  hired: 'marked as hired',
  declined: 'declined',
}[status] ?? 'updated')

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY
  const emailFrom = process.env.EMAIL_FROM ?? 'TradesCraftConnect <notifications@tradescraftconnect.com>'

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) {
    return NextResponse.json({ error: 'Email delivery is not configured' }, { status: 503 })
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user } } = await authClient.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { eventType?: EmailEventType; relatedId?: string } | null
  if (!body?.eventType || !body.relatedId) {
    return NextResponse.json({ error: 'Event type and related ID are required' }, { status: 400 })
  }

  const { data: adminMembership } = await admin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
  const isAdmin = Boolean(adminMembership)
  let details: EmailDetails | null = null

  if (body.eventType === 'new_application') {
    const { data: application } = await admin.from('job_applications').select('id,applicant_id,job_id').eq('id', body.relatedId).single()
    if (!application || application.applicant_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const [{ data: job }, { data: applicant }] = await Promise.all([
      admin.from('job_postings').select('id,title,poster_id').eq('id', application.job_id).single(),
      admin.from('profiles').select('full_name').eq('id', application.applicant_id).single(),
    ])
    if (job) details = {
      recipientId: job.poster_id,
      eventKey: `new_application:${application.id}`,
      subject: `New application for ${job.title}`,
      heading: 'New Job Application',
      message: `${applicant?.full_name || 'A member'} applied for ${job.title}.`,
      link: `/dashboard/my-postings/${job.id}`,
      buttonLabel: 'Review Applicant',
    }
  }

  if (body.eventType === 'application_status') {
    const { data: application } = await admin.from('job_applications').select('id,applicant_id,job_id,status').eq('id', body.relatedId).single()
    const { data: job } = application
      ? await admin.from('job_postings').select('title,poster_id').eq('id', application.job_id).single()
      : { data: null }
    if (!application || !job || job.poster_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    details = {
      recipientId: application.applicant_id,
      eventKey: `application_status:${application.id}:${application.status}`,
      subject: `Application update: ${job.title}`,
      heading: application.status === 'hired' ? 'You Were Hired!' : 'Application Status Updated',
      message: `Your application for ${job.title} was ${statusLabel(application.status)}.`,
      link: '/dashboard/my-applications',
      buttonLabel: 'View Application',
    }
  }

  if (body.eventType === 'application_message') {
    const { data: message } = await admin.from('application_messages').select('id,application_id,sender_id,recipient_id').eq('id', body.relatedId).single()
    if (!message || message.sender_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const [{ data: application }, { data: sender }] = await Promise.all([
      admin.from('job_applications').select('job_id').eq('id', message.application_id).single(),
      admin.from('profiles').select('full_name').eq('id', message.sender_id).single(),
    ])
    const { data: job } = application
      ? await admin.from('job_postings').select('title').eq('id', application.job_id).single()
      : { data: null }
    details = {
      recipientId: message.recipient_id,
      eventKey: `application_message:${message.id}`,
      subject: `New message about ${job?.title || 'a job application'}`,
      heading: `New Message from ${sender?.full_name || 'a member'}`,
      message: `You received a private message regarding ${job?.title || 'a job application'}.`,
      link: `/dashboard/messages/${message.application_id}`,
      buttonLabel: 'Read Message',
    }
  }

  if (body.eventType === 'certification_review') {
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: certification } = await admin.from('certifications').select('id,user_id,cert_name,verification_status').eq('id', body.relatedId).single()
    if (!certification || !['verified', 'rejected'].includes(certification.verification_status)) {
      return NextResponse.json({ error: 'Certification review not found' }, { status: 404 })
    }
    const approved = certification.verification_status === 'verified'
    details = {
      recipientId: certification.user_id,
      eventKey: `certification_review:${certification.id}:${certification.verification_status}`,
      subject: approved ? 'Certification approved' : 'Certification needs attention',
      heading: approved ? 'Certification Approved' : 'Certification Needs Attention',
      message: approved
        ? `${certification.cert_name} is now verified on your TradesCraftConnect profile.`
        : `${certification.cert_name} was not approved. Open your profile to review the administrator note.`,
      link: '/dashboard/edit-profile',
      buttonLabel: 'View Certification',
    }
  }

  if (body.eventType === 'account_suspension') {
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: suspension } = await admin.from('member_suspensions').select('user_id,reason,expires_at,lifted_at').eq('user_id', body.relatedId).single()
    if (!suspension) return NextResponse.json({ error: 'Suspension record not found' }, { status: 404 })
    const lifted = Boolean(suspension.lifted_at)
    details = {
      recipientId: suspension.user_id,
      eventKey: `account_suspension:${suspension.user_id}:${lifted ? 'lifted' : suspension.expires_at || 'active'}`,
      subject: lifted ? 'Account access restored' : 'Important account access update',
      heading: lifted ? 'Account Access Restored' : 'Account Access Paused',
      message: lifted
        ? 'Your TradesCraftConnect account access has been restored.'
        : `Your account access was temporarily paused. Reason: ${suspension.reason}`,
      link: lifted ? '/login' : '/suspended',
      buttonLabel: lifted ? 'Sign In' : 'View Account Status',
      essential: true,
    }
  }

  if (!details) return NextResponse.json({ error: 'Notification event not found' }, { status: 404 })

  const { data: recipient } = await admin
    .from('profiles')
    .select('email,email_notifications_enabled')
    .eq('id', details.recipientId)
    .single()
  if (!recipient?.email) return NextResponse.json({ error: 'Recipient email not found' }, { status: 404 })
  if (!details.essential && recipient.email_notifications_enabled === false) {
    return NextResponse.json({ skipped: true, reason: 'Recipient opted out' })
  }

  const { data: existing } = await admin
    .from('email_notification_deliveries')
    .select('status')
    .eq('event_key', details.eventKey)
    .eq('recipient_id', details.recipientId)
    .maybeSingle()
  if (existing?.status === 'sent') return NextResponse.json({ sent: true, duplicate: true })

  await admin.from('email_notification_deliveries').upsert({
    event_key: details.eventKey,
    event_type: body.eventType,
    related_id: body.relatedId,
    recipient_id: details.recipientId,
    status: 'pending',
    error_message: null,
  }, { onConflict: 'event_key,recipient_id' })

  const origin = new URL(request.url).origin
  const safeHeading = escapeHtml(details.heading)
  const safeMessage = escapeHtml(details.message)
  const safeLink = `${origin}${details.link}`
  const safeButton = escapeHtml(details.buttonLabel)
  const resend = new Resend(resendApiKey)
  const { data, error } = await resend.emails.send({
    from: emailFrom,
    to: recipient.email,
    subject: details.subject,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#f8fafc;padding:32px;border-radius:14px"><div style="font-size:20px;font-weight:700;color:#f97316">TradesCraftConnect</div><h1 style="font-size:26px;margin:28px 0 12px">${safeHeading}</h1><p style="color:#cbd5e1;font-size:16px;line-height:1.6">${safeMessage}</p><a href="${safeLink}" style="display:inline-block;margin-top:22px;background:#f97316;color:#fff;padding:12px 22px;border-radius:9px;text-decoration:none;font-weight:700">${safeButton}</a><p style="margin-top:32px;color:#64748b;font-size:12px">This transactional email was sent because of activity on your TradesCraftConnect account.</p></div>`,
  })

  if (error) {
    await admin.from('email_notification_deliveries').update({ status: 'failed', error_message: JSON.stringify(error) }).eq('event_key', details.eventKey).eq('recipient_id', details.recipientId)
    return NextResponse.json({ error: 'Email provider rejected the message' }, { status: 502 })
  }

  await admin.from('email_notification_deliveries').update({ status: 'sent', provider_message_id: data?.id ?? null, sent_at: new Date().toISOString() }).eq('event_key', details.eventKey).eq('recipient_id', details.recipientId)
  return NextResponse.json({ sent: true })
}
