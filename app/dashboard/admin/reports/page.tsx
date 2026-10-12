'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { sendEmailNotification } from '../../../lib/emailNotifications'

type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'
type Report = {
  id: string
  reporter_id: string
  reported_user_id: string | null
  entity_type: 'profile' | 'job'
  entity_id: string
  category: string
  details: string
  status: ReportStatus
  resolution_notes: string | null
  created_at: string
  profiles: { full_name: string | null; email: string | null } | null
}

const filters: Array<{ value: ReportStatus | 'all'; label: string }> = [
  { value: 'open', label: 'Open' }, { value: 'reviewing', label: 'Reviewing' },
  { value: 'resolved', label: 'Resolved' }, { value: 'dismissed', label: 'Dismissed' }, { value: 'all', label: 'All' },
]

export default function SafetyReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: admin } = await supabase.rpc('is_admin')
    if (!admin) { setMessage('Administrator access is required.'); setLoading(false); return }
    let query = supabase.from('member_reports').select('*, profiles!member_reports_reported_user_fkey(full_name,email)').order('created_at', { ascending: false })
    if (filter !== 'all') query = query.eq('status', filter)
    const { data, error } = await query
    if (error) setMessage(`Could not load reports: ${error.message}`)
    else setReports((data ?? []) as unknown as Report[])
    setLoading(false)
  }, [filter, router])

  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

  const review = async (report: Report, decision: Exclude<ReportStatus, 'open'>) => {
    setBusy(report.id); setMessage('')
    const { error } = await supabase.rpc('review_member_report', { report_id: report.id, decision, admin_notes: notes[report.id]?.trim() || null })
    if (error) setMessage(`Review did not save: ${error.message}`)
    else { setMessage(`Report marked ${decision}.`); await load() }
    setBusy('')
  }

  const suspend = async (report: Report) => {
    if (!report.reported_user_id) return
    const reason = notes[report.id]?.trim() || `Safety report: ${report.category.replaceAll('_', ' ')}`
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    setBusy(report.id); setMessage('')
    const { error } = await supabase.rpc('set_member_suspension', { target_user: report.reported_user_id, suspend: true, admin_reason: reason, suspension_expires_at: expires })
    if (error) setMessage(`Account was not suspended: ${error.message}`)
    else {
      setMessage('Account suspended for 30 days.')
      void sendEmailNotification('account_suspension', report.reported_user_id)
      await review(report, 'resolved')
    }
    setBusy('')
  }

  const lift = async (report: Report) => {
    if (!report.reported_user_id) return
    setBusy(report.id); setMessage('')
    const { error } = await supabase.rpc('set_member_suspension', { target_user: report.reported_user_id, suspend: false, admin_reason: null, suspension_expires_at: null })
    setMessage(error ? `Suspension was not lifted: ${error.message}` : 'Any active suspension for this member was lifted.')
    if (!error) void sendEmailNotification('account_suspension', report.reported_user_id)
    setBusy('')
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-400">Administrator</p>
        <h1 className="text-3xl font-bold">Safety Reports</h1>
        <p className="mt-1 text-gray-400">Review member concerns and control platform access.</p>
        <div className="my-6 flex flex-wrap gap-2">{filters.map(item => <button key={item.value} onClick={() => setFilter(item.value)} className={`rounded-xl px-4 py-2 text-sm ${filter === item.value ? 'bg-orange-500 font-semibold' : 'bg-gray-800 text-gray-300'}`}>{item.label}</button>)}</div>
        {message && <p className="mb-4 rounded-xl border border-gray-700 bg-gray-900 p-3 text-sm">{message}</p>}
        {loading ? <p className="text-gray-400">Loading reports…</p> : reports.length === 0 ? <div className="rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center"><p className="text-3xl">✓</p><p className="mt-2 font-semibold">No reports in this section</p></div> : (
          <div className="flex flex-col gap-4">{reports.map(report => (
            <section key={report.id} className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold capitalize">{report.category.replaceAll('_', ' ')}</h2><span className="rounded-full bg-gray-800 px-2 py-1 text-xs capitalize text-orange-400">{report.status}</span></div><p className="mt-1 text-sm text-gray-400">Reported member: {report.profiles?.full_name || report.profiles?.email || 'Unknown member'} · {new Date(report.created_at).toLocaleDateString()}</p></div>
                <Link href={report.entity_type === 'job' ? `/dashboard/jobs/${report.entity_id}` : `/dashboard/directory/${report.entity_id}`} className="text-sm text-orange-400">View reported {report.entity_type}</Link>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-gray-200">{report.details}</p>
              <textarea value={notes[report.id] ?? report.resolution_notes ?? ''} onChange={event => setNotes(current => ({ ...current, [report.id]: event.target.value }))} placeholder="Private administrator notes or suspension reason…" className="mt-4 min-h-20 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 placeholder-gray-500" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busy === report.id} onClick={() => review(report, 'reviewing')} className="rounded-xl bg-yellow-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">Start Review</button>
                <button disabled={busy === report.id} onClick={() => review(report, 'resolved')} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">Resolve</button>
                <button disabled={busy === report.id} onClick={() => review(report, 'dismissed')} className="rounded-xl bg-gray-700 px-4 py-2 text-sm disabled:opacity-50">Dismiss</button>
                <button disabled={busy === report.id || !report.reported_user_id} onClick={() => suspend(report)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">Suspend 30 Days</button>
                <button disabled={busy === report.id || !report.reported_user_id} onClick={() => lift(report)} className="rounded-xl border border-gray-600 px-4 py-2 text-sm disabled:opacity-50">Lift Suspension</button>
              </div>
            </section>
          ))}</div>
        )}
      </div>
    </main>
  )
}

