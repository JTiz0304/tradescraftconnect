'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Application = {
  id: string
  created_at: string
  message: string
  status: string
  job_postings: {
    id: string
    title: string
    trade_type: string
    location: string
    status: string
  }
}

export default function MyApplicationsPage() {
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('job_applications')
        .select('*, job_postings(id, title, trade_type, location, status)')
        .eq('applicant_id', user.id)
        .order('created_at', { ascending: false })

      setApplications(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <p className="animate-pulse text-gray-400">Loading your applications...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Applications</h1>
            <p className="text-gray-400 mt-1">{applications.length} application{applications.length !== 1 ? 's' : ''} submitted</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white text-sm border border-gray-700 px-4 py-2 rounded-xl transition"
          >
            ← Dashboard
          </button>
        </div>

        {applications.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-4">📄</p>
            <p className="text-white font-semibold text-lg">No applications yet</p>
            <p className="text-gray-400 mt-1 mb-6">Browse open jobs and apply to get started</p>
            <button
              onClick={() => router.push('/dashboard/jobs')}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              Browse Jobs
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {applications.map(app => (
              <div
                key={app.id}
                onClick={() => router.push(`/dashboard/jobs/${app.job_postings?.id}`)}
                className="bg-gray-900 border border-gray-800 hover:border-orange-500 rounded-2xl p-6 cursor-pointer transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-white">{app.job_postings?.title}</h2>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      <span className="text-xs bg-gray-800 text-orange-400 px-2 py-1 rounded-lg">{app.job_postings?.trade_type}</span>
                      <span className="text-xs text-gray-400">📍 {app.job_postings?.location}</span>
                      <span className={`text-xs px-2 py-1 rounded-lg ${app.job_postings?.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                        {app.job_postings?.status === 'open' ? '● Open' : '○ Closed'}
                      </span>
                    </div>
                    {app.message && (
                      <p className="text-gray-400 text-sm mt-3 leading-relaxed line-clamp-2 italic">"{app.message}"</p>
                    )}
                    <p className="text-xs text-gray-600 mt-3">
                      Applied {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-lg shrink-0 ${
                    app.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                    app.status === 'accepted' ? 'bg-green-500/10 text-green-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}