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
  status: string
  created_at: string
}

export default function MyPostingsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('job_postings')
        .select('*')
        .eq('poster_id', user.id)
        .order('created_at', { ascending: false })

      setJobs(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const toggleStatus = async (job: Job) => {
    const newStatus = job.status === 'open' ? 'closed' : 'open'
    const { error } = await supabase
      .from('job_postings')
      .update({ status: newStatus })
      .eq('id', job.id)

    if (!error) {
      setJobs(jobs.map(j => j.id === job.id ? { ...j, status: newStatus } : j))
    }
  }

  const deleteJob = async (id: string) => {
    const { error } = await supabase
      .from('job_postings')
      .delete()
      .eq('id', id)

    if (!error) {
      setJobs(jobs.filter(j => j.id !== id))
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <p className="animate-pulse text-gray-400">Loading your postings...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Postings</h1>
            <p className="text-gray-400 mt-1">{jobs.length} job{jobs.length !== 1 ? 's' : ''} posted</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard/post-job')}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-xl transition text-sm"
            >
              + Post a Job
            </button>
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
            <p className="text-white font-semibold text-lg">No jobs posted yet</p>
            <p className="text-gray-400 mt-1 mb-6">Post your first job to find the right tradesperson</p>
            <button
              onClick={() => router.push('/dashboard/post-job')}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              Post a Job
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {jobs.map(job => (
              <div key={job.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-lg font-semibold text-white">{job.title}</h2>
                      <span className={`text-xs px-2 py-1 rounded-lg ${job.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                        {job.status === 'open' ? '● Open' : '○ Closed'}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      <span className="text-xs bg-gray-800 text-orange-400 px-2 py-1 rounded-lg">{job.trade_type}</span>
                      <span className="text-xs text-gray-400">📍 {job.location}</span>
                      {job.radius && <span className="text-xs text-gray-400">📏 {job.radius}</span>}
                    </div>
                    {job.description && (
                      <p className="text-gray-400 text-sm mt-3 leading-relaxed line-clamp-2">{job.description}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-3">
                      Posted {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => router.push(`/dashboard/my-postings/${job.id}`)}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition"
                    >
                      Applicants
                    </button>
                    <button
                      onClick={() => toggleStatus(job)}
                      className="text-xs border border-gray-700 hover:border-orange-500 text-gray-300 hover:text-orange-400 px-3 py-1.5 rounded-lg transition"
                    >
                      {job.status === 'open' ? 'Close' : 'Reopen'}
                    </button>
                    <button
                      onClick={() => deleteJob(job.id)}
                      className="text-xs border border-gray-700 hover:border-red-500 text-gray-300 hover:text-red-400 px-3 py-1.5 rounded-lg transition"
                    >
                      Delete
                    </button>
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