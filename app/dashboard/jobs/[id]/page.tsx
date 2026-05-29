'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Job = {
  id: string
  title: string
  description: string
  trade_type: string
  location: string
  radius: string
  status: string
  created_at: string
  poster_id: string
}

export default function JobDetailPage() {
  const router = useRouter()
  const { id } = useParams()
  const [job, setJob] = useState<Job | null>(null)
  const [userId, setUserId] = useState('')
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [message, setMessage] = useState('')
  const [message, setmessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: jobData } = await supabase
        .from('job_postings')
        .select('*')
        .eq('id', id)
        .single()
      if (jobData) setJob(jobData)

      const { data: existing } = await supabase
        .from('job_applications')
        .select('id')
        .eq('job_id', id)
        .eq('applicant_id', user.id)
        .single()
      if (existing) setAlreadyApplied(true)

      setLoading(false)
    }
    load()
  }, [id])

  const handleApply = async () => {
    if (!job) return
    setSubmitting(true)

    const { error } = await supabase
      .from('job_applications')
      .insert({ job_id: job.id, applicant_id: userId, message })

    if (error) {
      setMessage('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    // Fetch applicant profile and poster email, then send notification
    try {
      const { data: applicantProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single()

      const { data: posterProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', job.poster_id)
        .single()

      if (applicantProfile && posterProfile) {
        await fetch('/api/send-application-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: posterProfile.email,
            applicantName: applicantProfile.full_name || 'A user',
            applicantEmail: applicantProfile.email,
            jobTitle: job.title,
          }),
        })
      }
    } catch (e) {
      // Email failed silently — application still went through
      console.error('Email notification failed:', e)
    }

    setAlreadyApplied(true)
    setMessage('Application submitted!')
    setSubmitting(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  )

  if (!job) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-400">Job not found.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white text-sm mb-6 transition"
        >
          ← Back
        </button>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-2xl font-bold">{job.title}</h1>
            <span className={`text-xs px-2 py-1 rounded-lg ${job.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
              {job.status}
            </span>
          </div>

          <div className="flex gap-3 flex-wrap mb-6">
            <span className="text-xs bg-gray-800 text-orange-400 px-2 py-1 rounded-lg">{job.trade_type}</span>
            <span className="text-xs text-gray-400">📍 {job.location}</span>
            {job.radius && <span className="text-xs text-gray-400">📏 {job.radius}</span>}
          </div>

          {job.description && (
            <p className="text-gray-300 leading-relaxed">{job.description}</p>
          )}

          <p className="text-xs text-gray-600 mt-6">
            Posted {new Date(job.created_at).toLocaleDateString()}
          </p>
        </div>

        {job.poster_id === userId ? (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 text-center">
            <p className="text-yellow-400 font-semibold">This is your posting</p>
            <p className="text-gray-400 text-sm mt-1">You can manage it from My Postings.</p>
          </div>
        ) : alreadyApplied ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center">
            <p className="text-green-400 font-semibold">✓ You've applied to this job</p>
            <p className="text-gray-400 text-sm mt-1">The poster will be in touch if there's a match.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Apply for this job</h2>
            <textarea
              placeholder="Add a short message (optional) — introduce yourself, your experience, availability..."
              value={message}
              onChange={(e) => setmessage(e.target.value)}
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 mb-4 resize-none"
            />
            <button
              onClick={handleApply}
              disabled={submitting}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
            >
              {submitting ? 'Sending...' : 'Submit Application'}
            </button>
            {message && <p className="text-green-400 text-sm mt-3 text-center">{message}</p>}
          </div>
        )}
      </div>
    </div>
  )
}