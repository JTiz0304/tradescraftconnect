'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type ReviewStatus = 'pending' | 'verified' | 'rejected'

type Certification = {
  id: string
  user_id: string
  file_url: string
  file_name: string
  cert_name: string
  issuing_org: string | null
  expiry_date: string | null
  verification_status: ReviewStatus | 'unverified'
  review_notes: string | null
  reviewed_at: string | null
  created_at: string
  profiles: {
    full_name: string | null
    email: string | null
    trade_type: string | null
    location: string | null
  } | null
}

const filters: Array<{ value: ReviewStatus | 'all'; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

export default function CertificationReviewPage() {
  const router = useRouter()
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [filter, setFilter] = useState<ReviewStatus | 'all'>('pending')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadCertifications = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin')
    if (adminError || !isAdmin) {
      setError('Administrator access is required to view this page.')
      setLoading(false)
      return
    }

    let query = supabase
      .from('certifications')
      .select('id,user_id,file_url,file_name,cert_name,issuing_org,expiry_date,verification_status,review_notes,reviewed_at,created_at,profiles(full_name,email,trade_type,location)')
      .order('created_at', { ascending: false })

    if (filter !== 'all') query = query.eq('verification_status', filter)

    const { data, error: loadError } = await query
    if (loadError) setError(`Could not load the review queue: ${loadError.message}`)
    else setCertifications((data ?? []) as unknown as Certification[])
    setLoading(false)
  }, [filter, router])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCertifications() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCertifications])

  const viewDocument = async (certification: Certification) => {
    setError('')
    const { data, error: viewError } = await supabase.storage
      .from('certifications')
      .createSignedUrl(certification.file_url, 60)

    if (viewError || !data) { setError('The document could not be opened.'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const review = async (certification: Certification, decision: 'verified' | 'rejected') => {
    const reviewerNotes = notes[certification.id]?.trim() ?? ''
    if (decision === 'rejected' && !reviewerNotes) {
      setError('Please enter a reason before rejecting this document.')
      return
    }

    setSavingId(certification.id)
    setError('')
    setSuccess('')
    const { error: reviewError } = await supabase.rpc('review_certification', {
      certification_id: certification.id,
      decision,
      reviewer_notes: reviewerNotes || null,
    })

    if (reviewError) setError(`Review did not save: ${reviewError.message}`)
    else {
      setSuccess(`${certification.cert_name} was ${decision === 'verified' ? 'approved' : 'rejected'}.`)
      setNotes(current => ({ ...current, [certification.id]: '' }))
      await loadCertifications()
    }
    setSavingId('')
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-orange-400 text-sm font-semibold uppercase tracking-wide">Administrator</p>
            <h1 className="text-3xl font-bold">Certification Review</h1>
            <p className="text-gray-400 mt-1">Review licenses and certifications before displaying a verified badge.</p>
          </div>
          <Link href="/dashboard/gc-builder" className="border border-gray-700 hover:border-orange-500 px-4 py-2 rounded-xl text-sm transition text-center">
            Member Dashboard
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {filters.map(option => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-4 py-2 rounded-xl text-sm transition ${filter === option.value ? 'bg-orange-500 font-semibold' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && <p className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3 mb-4">{error}</p>}
        {success && <p className="bg-green-500/10 border border-green-500/30 text-green-300 rounded-xl p-3 mb-4">{success}</p>}

        {loading ? (
          <p className="text-gray-400 animate-pulse">Loading review queue...</p>
        ) : certifications.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
            <p className="text-3xl mb-2">✓</p>
            <p className="font-semibold">Nothing waiting in this section</p>
            <p className="text-gray-400 text-sm mt-1">New uploads will appear here automatically.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {certifications.map(certification => (
              <section key={certification.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-xl font-semibold">{certification.cert_name}</h2>
                      <StatusBadge status={certification.verification_status} />
                    </div>
                    <p className="text-gray-300">{certification.profiles?.full_name ?? 'Member'} · {certification.profiles?.trade_type ?? 'Trade not listed'}</p>
                    <p className="text-sm text-gray-500">{certification.profiles?.location ?? 'Location not listed'} · Uploaded {new Date(certification.created_at).toLocaleDateString()}</p>
                    <p className="text-sm text-gray-400 mt-3">
                      {certification.issuing_org || 'Issuing organization not supplied'}
                      {certification.expiry_date && ` · Expires ${new Date(certification.expiry_date).toLocaleDateString()}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">File: {certification.file_name}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => viewDocument(certification)} className="border border-gray-600 hover:border-orange-500 px-4 py-2 rounded-xl text-sm transition">View Document</button>
                    <Link href={`/dashboard/directory/${certification.user_id}`} className="border border-gray-600 hover:border-orange-500 px-4 py-2 rounded-xl text-sm transition">View Profile</Link>
                  </div>
                </div>

                {certification.verification_status === 'pending' && (
                  <div className="border-t border-gray-800 mt-5 pt-5">
                    <label className="text-sm text-gray-300 mb-2 block">Review note <span className="text-gray-500">(required when rejecting)</span></label>
                    <textarea
                      value={notes[certification.id] ?? ''}
                      onChange={(event) => setNotes(current => ({ ...current, [certification.id]: event.target.value }))}
                      placeholder="Explain anything the member needs to correct..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 min-h-24"
                    />
                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                      <button disabled={savingId === certification.id} onClick={() => review(certification, 'verified')} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 font-semibold py-2.5 rounded-xl transition">Approve &amp; Verify</button>
                      <button disabled={savingId === certification.id} onClick={() => review(certification, 'rejected')} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 font-semibold py-2.5 rounded-xl transition">Reject with Reason</button>
                    </div>
                  </div>
                )}

                {certification.review_notes && certification.verification_status !== 'pending' && (
                  <p className="border-t border-gray-800 mt-4 pt-4 text-sm text-gray-300"><span className="font-semibold">Review note:</span> {certification.review_notes}</p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function StatusBadge({ status }: { status: Certification['verification_status'] }) {
  const styles: Record<Certification['verification_status'], string> = {
    unverified: 'bg-gray-700 text-gray-300',
    pending: 'bg-yellow-500/10 text-yellow-400',
    verified: 'bg-green-500/10 text-green-400',
    rejected: 'bg-red-500/10 text-red-400',
  }
  const labels: Record<Certification['verification_status'], string> = {
    unverified: 'Not reviewed', pending: 'Pending', verified: 'Approved', rejected: 'Rejected',
  }
  return <span className={`text-xs px-2 py-1 rounded-full ${styles[status]}`}>{labels[status]}</span>
}
