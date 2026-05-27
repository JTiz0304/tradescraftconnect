import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { to, applicantName, jobTitle, applicantEmail } = await req.json()

  const { data, error } = await resend.emails.send({
    from: 'TradesCraftConnect <notifications@tradescraftconnect.com>',
    to,
    subject: `New application for: ${jobTitle}`,
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
        <p style="color: #475569; font-size: 12px; margin-top: 32px;">TradesCraftConnect · You're receiving this because someone applied to your job posting.</p>
      </div>
    `
  })

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ data })
}