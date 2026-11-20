import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processEmailQueue } from '../../../lib/emailQueue'

export const maxDuration = 60

export async function POST(request: Request) {
  const secret = process.env.EMAIL_WORKER_SECRET
  if (!secret || secret.length < 32) return NextResponse.json({ error: 'Email worker is not configured' }, { status: 503 })
  const authorization = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (authorization.length !== expected.length || !timingSafeEqual(authorization, expected)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const appUrl = process.env.EMAIL_APP_URL
  if (!url || !serviceKey || !apiKey || !from || !appUrl) return NextResponse.json({ error: 'Email worker is not configured' }, { status: 503 })
  try {
    const canonical = new URL(appUrl)
    if (canonical.protocol !== 'https:' || canonical.username || canonical.password || canonical.origin !== appUrl) throw new Error('Invalid origin')
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const counts = await processEmailQueue(admin, { apiKey, from, origin: canonical.origin })
    console.info('Email queue processed', counts)
    return NextResponse.json(counts)
  } catch {
    console.error('Email queue processing failed')
    return NextResponse.json({ error: 'Email queue processing failed' }, { status: 503 })
  }
}
