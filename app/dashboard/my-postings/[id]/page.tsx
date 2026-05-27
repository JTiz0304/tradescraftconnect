'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Applicant = {
  id: string
  created_at: string
  message: string
  status: string
  applicant_id: string
  profiles: {
    full_name: string
    email: string
    trade: string
    trade_type: string
    location: string
    user_type: string
  }
}

type Job = {
  id: string
  title: string
  trade_type: string
  location: string
  status: string
}

export default function JobApplicantsPage() {
  const router = useRouter()
  const { id } = useParams()
  const [job, setJob] = useState<Job | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: jobData } = await supabase
        .from('job_postings')
        .select('id, title, trade_type, location, status')
        .eq('id', id)
        .eq('poster_id', user.id)
        .single()

      if (!jobData) { router.push('/dashboard/my-postings'); return }
      setJob(jobData)

      const { data: appData } = await supabase
        .from('job_applications')
        .select('*, profiles(full_name, email, trade, trade_type, location, user_type)')
        .eq('job_id', id)
        .order('created_at', { ascending: false })

      setApplicants(appData ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <p className="animate-pulse text-gray-400">Loading applicants...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.push('/dashboard/my-postings')}
          className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition"
        >
          ← Back to My Postings
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">{job?.title}</h1>
          <div className="flex gap-3 mt-2 flex-wrap">
            <span className="text-xs bg-gray-800 text-orange-400 px-2 py-1 rounded-lg">{job?.trade_type}</span>
            <span className="text-xs text-gray-400">📍 {job?.location}</span>
            <span className={`text-xs px-2 py-1 rounded-lg ${job?.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
              {job?.status === 'open' ? '● Open' : '○ Closed'}
            </span>
          </div>
          <p className="text-gray-400 mt-3">{applicants.length} applicant{applicants.length !== 1 ? 's' : ''}</p>
        </div>

        {applicants.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-4">👥</p>
            <p className="text-white font-semibold text-lg">No applicants yet</p>
            <p className="text-gray-400 mt-1">Share your job posting to get more visibility</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {applicants.map(app => (
              <div key={app.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-white text-lg">
                      {app.profiles?.full_name ?? 'Unknown'}
                    </p>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      {(app.profiles?.trade || app.profiles?.trade_type) && (
                        <span className="text-xs bg-gray-800 text-orange-400 px-2 py-1 rounded-lg">
                          {app.profiles?.trade || app.profiles?.trade_type}
                        </span>
                      )}
                      {app.profiles?.location && (
                        <span className="text-xs text-gray-400">📍 {app.profiles.location}</span>
                      )}
                      <span className="text-xs text-gray-500 capitalize">{app.profiles?.user_type?.replace('_', ' ')}</span>
                    </div>
                    {app.message && (
                      <p className="text-gray-300 text-sm mt-3 leading-relaxed bg-gray-800 rounded-xl p-3">
                        "{app.message}"
                      </p>
                    )}
                    <p className="text-xs text-gray-600 mt-3">
                      Applied {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    
                      href={`mailto:${app.profiles?.email}`}
                      className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition text-center"
                    >
                      Contact
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}