import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] ?? character,
  )

export async function POST(req: Request) {
  const authorization = req.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const resendApiKey = process.env.RESEND_API_KEY

  if (!supabaseUrl || !supabaseAnonKey || !resendApiKey) {
    return NextResponse.json(
      { error: 'Notification service is not configured' },
      { status: 503 },
    )
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser(token)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { jobId?: string }
  if (!body.jobId) {
    return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
  }

  const { data: application } = await supabase
    .from('job_applications')
    .select('id')
    .eq('job_id', body.jobId)
    .eq('applicant_id', user.id)
    .single()

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 403 })
  }

  const { data: job } = await supabase
    .from('job_postings')
    .select('title, poster_id')
    .eq('id', body.jobId)
    .single()

  const { data: applicantProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  if (!job || !applicantProfile) {
    return NextResponse.json(
      { error: 'Application details not found' },
      { status: 404 },
    )
  }

  const { data: posterProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', job.poster_id)
    .single()

  if (!posterProfile?.email || !applicantProfile.email) {
    return NextResponse.json(
      { error: 'Contact information not found' },
      { status: 404 },
    )
  }

  const applicantName = escapeHtml(applicantProfile.full_name || 'A user')
  const applicantEmail = escapeHtml(applicantProfile.email)
  const jobTitle = escapeHtml(job.title)
  const resend = new Resend(resendApiKey)

  const { data, error } = await resend.emails.send({
    from: 'TradesCraftConnect <notifications@tradescraftconnect.com>',
    to: posterProfile.email,
    subject: `New application for: ${job.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f1f5f9; padding: 32px; border-radius: 12px;">
        <h2 style="color: #f97316; margin-top: 0;">New Job Application</h2>
        <p style="color: #cbd5e1;">Someone applied to your posting on TradesCraftConnect.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #1e293b; color: #94a3b8; width: 100px;">Job</td>
            <td style="padding: 10px; border-bottom: 1px solid #1e293b;">${jobTitle}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #1e293b; color: #94a3b8;">Applicant</td>
            <td style="padding: 10px; border-bottom: 1px solid #1e293b;">${applicantName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; color: #94a3b8;">Contact</td>
            <td style="padding: 10px;"><a href="mailto:${applicantEmail}" style="color: #f97316;">${applicantEmail}</a></td>
          </tr>
        </table>
        <a href="https://www.tradescraftconnect.com/dashboard" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View in Dashboard</a>
        <p style="color: #475569; font-size: 12px; margin-top: 32px;">TradesCraftConnect · You’re receiving this because someone applied to your job posting.</p>
      </div>
    `,
  })

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ data })
}
