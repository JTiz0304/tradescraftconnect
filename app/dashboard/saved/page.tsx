'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type SavedJob = { id: string; job_postings: { id: string; title: string; trade_type: string; location: string; status: string } }
type SavedProfile = { id: string; profiles: { id: string; full_name: string; trade_type: string | null; location: string | null; availability_status: string } }

export default function SavedPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<SavedJob[]>([])
  const [profiles, setProfiles] = useState<SavedProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const [jobResult, profileResult] = await Promise.all([
        supabase.from('saved_jobs').select('id, job_postings(id, title, trade_type, location, status)').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('saved_profiles').select('id, profiles!saved_profiles_profile_id_fkey(id, full_name, trade_type, location, availability_status)').eq('user_id', user.id).order('created_at', { ascending: false }),
      ])
      setJobs((jobResult.data ?? []) as unknown as SavedJob[])
      setProfiles((profileResult.data ?? []) as unknown as SavedProfile[])
      setLoading(false)
    }
    void load()
  }, [router])

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading saved items...</div>

  return (
    <div className="min-h-screen bg-gray-950 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">Saved</h1>
        <p className="mt-1 text-gray-400">Jobs and professionals you want to revisit.</p>
        {jobs.length === 0 && profiles.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center"><p className="text-4xl">☆</p><p className="mt-3 font-semibold">Nothing saved yet</p><p className="mt-1 text-sm text-gray-400">Use the Save button on jobs and professional profiles.</p></div>
        ) : (
          <div className="mt-8 flex flex-col gap-8">
            {jobs.length > 0 && <section><h2 className="mb-3 text-lg font-semibold">Saved Jobs</h2><div className="flex flex-col gap-3">{jobs.map(item => <button key={item.id} onClick={() => router.push(`/dashboard/jobs/${item.job_postings.id}`)} className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-left hover:border-orange-500"><p className="font-semibold">{item.job_postings.title}</p><p className="mt-1 text-sm text-gray-400">{item.job_postings.trade_type} · {item.job_postings.location} · {item.job_postings.status}</p></button>)}</div></section>}
            {profiles.length > 0 && <section><h2 className="mb-3 text-lg font-semibold">Saved Professionals</h2><div className="flex flex-col gap-3">{profiles.map(item => <button key={item.id} onClick={() => router.push(`/dashboard/directory/${item.profiles.id}`)} className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-left hover:border-orange-500"><p className="font-semibold">{item.profiles.full_name || 'Trades Professional'}</p><p className="mt-1 text-sm text-gray-400">{[item.profiles.trade_type, item.profiles.location, item.profiles.availability_status?.replaceAll('_', ' ')].filter(Boolean).join(' · ')}</p></button>)}</div></section>}
          </div>
        )}
      </div>
    </div>
  )
}
