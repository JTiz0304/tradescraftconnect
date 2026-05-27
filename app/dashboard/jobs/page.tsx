'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Job = {
  id: string
  title: string
  description: string
  trade_type: string
  location: string
  radius: string
  created_at: string
  poster_id: string
}

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [userType, setUserType] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single()
      setUserType(profile?.user_type ?? '')

      const { data: jobData } = await supabase
        .from('job_postings')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })

      setJobs(jobData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <p className="animate-pulse text-gray-400">Loading jobs...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Open Jobs</h1>
            <p className="text-gray-400 mt-1">{jobs.length} open position{jobs.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-3">
            {userType === 'gc_builder' && (
              <button
                onClick={() => router.push('/dashboard/post-job')}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-xl transition text-sm"
              >
                + Post a Job
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white text-sm border border-gray-700 px-4 py-2 rounded-xl transition"
            >
              ← Dashboard
            </button>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-white font-semibold text-lg">No open jobs yet</p>
            <p className="text-gray-400 mt-1">Check back soon or post the first job!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {jobs.map(job => (
              <div
                key={job.id}
                onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                className="bg-gray-900 border border-gray-800 hover:border-orange-500 rounded-2xl p-6 transition cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-white">{job.title}</h2>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      <span className="text-xs bg-gray-800 text-orange-400 px-2 py-1 rounded-lg">{job.trade_type}</span>
                      <span className="text-xs text-gray-400">📍 {job.location}</span>
                      {job.radius && <span className="text-xs text-gray-400">📏 {job.radius}</span>}
                    </div>
                    {job.description && (
                      <p className="text-gray-400 text-sm mt-3 leading-relaxed line-clamp-2">{job.description}</p>
                    )}
                  </div>
                  {job.poster_id === userId && (
                    <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-lg whitespace-nowrap">Your post</span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-4">
                  Posted {new Date(job.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}