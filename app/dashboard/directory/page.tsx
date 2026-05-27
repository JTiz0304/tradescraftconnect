'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Profile = {
  id: string
  full_name: string
  user_type: string
  trade: string
  trade_type: string
  location: string
  work_radius: string
  business_name: string
  company_name: string
}

const userTypeLabel: Record<string, string> = {
  gc_builder: 'GC / Builder',
  business_owner: 'Business Owner',
  professional: 'Professional',
  apprentice: 'Apprentice',
}

const userTypeColor: Record<string, string> = {
  gc_builder: 'text-yellow-400 bg-yellow-400/10',
  business_owner: 'text-blue-400 bg-blue-400/10',
  professional: 'text-green-400 bg-green-400/10',
  apprentice: 'text-purple-400 bg-purple-400/10',
}

export default function DirectoryPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [filtered, setFiltered] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, trade, trade_type, location, work_radius, business_name, company_name')
        .not('user_type', 'is', null)
        .order('full_name', { ascending: true })

      setProfiles(data ?? [])
      setFiltered(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    let results = profiles

    if (typeFilter !== 'all') {
      results = results.filter(p => p.user_type === typeFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter(p =>
        p.full_name?.toLowerCase().includes(q) ||
        p.trade?.toLowerCase().includes(q) ||
        p.trade_type?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.business_name?.toLowerCase().includes(q) ||
        p.company_name?.toLowerCase().includes(q)
      )
    }

    setFiltered(results)
  }, [search, typeFilter, profiles])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <p className="animate-pulse text-gray-400">Loading directory...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Trades Directory</h1>
            <p className="text-gray-400 mt-1">{filtered.length} member{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white text-sm border border-gray-700 px-4 py-2 rounded-xl transition"
          >
            ← Dashboard
          </button>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <input
            type="text"
            placeholder="Search by name, trade, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Types</option>
            <option value="gc_builder">GC / Builder</option>
            <option value="business_owner">Business Owner</option>
            <option value="professional">Professional</option>
            <option value="apprentice">Apprentice</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-white font-semibold text-lg">No results found</p>
            <p className="text-gray-400 mt-1">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(profile => (
              <div key={profile.id} className="bg-gray-900 border border-gray-800 hover:border-orange-500 rounded-2xl p-5 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-white text-lg">{profile.full_name ?? '—'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-lg mt-1 inline-block ${userTypeColor[profile.user_type] ?? 'text-gray-400 bg-gray-800'}`}>
                      {userTypeLabel[profile.user_type] ?? profile.user_type}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-1">
                  {(profile.trade || profile.trade_type) && (
                    <p className="text-sm text-gray-300">
                      🔧 {profile.trade || profile.trade_type}
                    </p>
                  )}
                  {(profile.company_name || profile.business_name) && (
                    <p className="text-sm text-gray-300">
                      🏢 {profile.company_name || profile.business_name}
                    </p>
                  )}
                  {profile.location && (
                    <p className="text-sm text-gray-400">📍 {profile.location}</p>
                  )}
                  {profile.work_radius && (
                    <p className="text-sm text-gray-400">📏 {profile.work_radius} mile radius</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}