'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Profile = {
  full_name: string
  email: string
  company_name: string
  hiring_radius: string
  hire_abroad: boolean
  location: string
}

export default function GCBuilderDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, company_name, hiring_radius, hire_abroad, location')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <p className="animate-pulse text-gray-400">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Welcome, {profile?.full_name ?? 'Builder'} 👷
          </h1>
          <p className="text-gray-400 mt-1">GC / Builder Dashboard</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 mb-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-yellow-400 mb-4">Your Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow label="Company" value={profile?.company_name} />
            <InfoRow label="Location" value={profile?.location} />
            <InfoRow label="Hiring Radius" value={profile?.hiring_radius ? `${profile.hiring_radius} miles` : undefined} />
            <InfoRow label="Hire Abroad" value={profile?.hire_abroad ? 'Yes' : 'No'} />
            <InfoRow label="Email" value={profile?.email} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ActionCard title="Post a Job" description="Find skilled tradespeople for your next project" emoji="📋" onClick={() => router.push('/dashboard/post-job')} />
          <ActionCard title="Browse Professionals" description="Search the trades directory" emoji="🔍" onClick={() => router.push('/dashboard/jobs')} />
          <ActionCard title="Edit Profile" description="Update your company info and hiring preferences" emoji="✏️" onClick={() => router.push('/dashboard/edit-profile')} />
          <ActionCard title="My Postings" description="View and manage your job listings" emoji="📁" onClick={() => router.push('/dashboard/my-postings')} />
        </div>

        <button
          onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          className="mt-8 text-sm text-gray-500 hover:text-red-400 transition"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-white font-medium mt-0.5">{value ?? '—'}</p>
    </div>
  )
}

function ActionCard({ title, description, emoji, disabled, onClick }: {
  title: string; description: string; emoji: string; disabled?: boolean; onClick?: () => void
}) {
  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-start gap-4 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-yellow-500 cursor-pointer transition'}`}
    >
      <span className="text-2xl">{emoji}</span>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="text-sm text-gray-400 mt-0.5">{description}</p>
        {disabled && <p className="text-xs text-yellow-600 mt-1">Coming soon</p>}
      </div>
    </div>
  )
}