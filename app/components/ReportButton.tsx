'use client'

import { useId, useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  entityType: 'profile' | 'job'
  entityId: string
  reportedUserId: string
  targetLabel: string
}

const categories = [
  ['scam', 'Scam or fraud'],
  ['harassment', 'Harassment or threats'],
  ['unsafe', 'Unsafe activity'],
  ['discrimination', 'Discrimination'],
  ['false_credentials', 'False credentials'],
  ['inappropriate', 'Inappropriate content'],
  ['other', 'Other concern'],
] as const

export default function ReportButton({ entityType, entityId, reportedUserId, targetLabel }: Props) {
  const formId = useId()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<(typeof categories)[number][0]>('other')
  const [details, setDetails] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async () => {
    if (details.trim().length < 10) { setMessage('Please include at least 10 characters of detail.'); return }
    setSaving(true)
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMessage('Please sign in before submitting a report.'); setSaving(false); return }
    const { error } = await supabase.from('member_reports').insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId,
      entity_type: entityType,
      entity_id: entityId,
      category,
      details: details.trim(),
    })
    if (error) setMessage(`Report could not be submitted: ${error.message}`)
    else {
      setMessage('Thank you. Your private report was sent to the administrator.')
      setDetails('')
    }
    setSaving(false)
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen(current => !current)} aria-expanded={open} aria-controls={open ? formId : undefined} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-400/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300">
        <span aria-hidden="true">⚑</span> Report {entityType}
      </button>
      {open && <div id={formId} className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="font-semibold">Report {targetLabel}</p><p className="mt-1 text-sm text-gray-400">Reports are private and reviewed by an administrator.</p></div>
          <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white" aria-label="Close report form">✕</button>
        </div>
        <label htmlFor={`${formId}-reason`} className="mt-4 block text-sm text-gray-300">Reason</label>
        <select id={`${formId}-reason`} value={category} onChange={event => setCategory(event.target.value as typeof category)} className="mt-2 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3">
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label htmlFor={`${formId}-details`} className="mt-4 block text-sm text-gray-300">What happened?</label>
        <textarea id={`${formId}-details`} value={details} onChange={event => setDetails(event.target.value)} maxLength={2000} rows={4} placeholder="Give enough detail for an administrator to understand the concern..." className="mt-2 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 placeholder-gray-500 focus:border-orange-500 focus:outline-none" />
        {message && <p role="status" className={`mt-3 text-sm ${message.startsWith('Thank') ? 'text-green-400' : 'text-red-400'}`}>{message}</p>}
        <button disabled={saving} onClick={submit} className="mt-4 w-full rounded-xl bg-red-600 py-3 font-semibold transition hover:bg-red-700 disabled:opacity-50">{saving ? 'Sending…' : 'Submit Private Report'}</button>
      </div>}
    </div>
  )
}

