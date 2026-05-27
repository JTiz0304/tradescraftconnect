'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Profile = {
  full_name: string
  email: string
  trade: string
  location: string
  school_program: string
}

export default function ApprenticeDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, trade, location, school_program')
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
            Welcome, {profile?.full_name ?? 'Apprentice'} 🎓
          </h1>
          <p className="text-gray-400 mt-1">Apprentice Dashboard</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 mb-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-purple-400 mb-4">Your Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow label="Trade" value={profile?.trade} />
            <InfoRow label="Location" value={profile?.location} />
            <InfoRow label="School / Program" value={profile?.school_program} />
            <InfoRow label="Email" value={profile?.email} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ActionCard title="Find Opportunities" description="Browse apprenticeships and entry-level jobs" emoji="🌱" onClick={() => router.push('/dashboard/jobs')} />
          <ActionCard title="My Applications" description="Track jobs you've applied to" emoji="📄" onClick={() => router.push('/dashboard/my-applications')} />
          <ActionCard title="Edit Profile" description="Update your trade and school info" emoji="✏️" onClick={() => router.push('/dashboard/edit-profile')} />
          <ActionCard title="Directory" description="Browse and connect with other trades" emoji="📒" onClick={() => router.push('/dashboard/directory')} />
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
      className={`bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-start gap-4 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-purple-500 cursor-pointer transition'}`}
    >
      <span className="text-2xl">{emoji}</span>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="text-sm text-gray-400 mt-0.5">{description}</p>
        {disabled && <p className="text-xs text-purple-600 mt-1">Coming soon</p>}
      </div>
    </div>
  )
}