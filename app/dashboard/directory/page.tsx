'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { availabilityLabels, tradeOptions, verificationLabels } from '../../lib/profile'

type Profile = {
  id: string
  full_name: string
  user_type: string
  trade_type: string
  location: string
  work_radius: string
  business_name: string
  company_name: string
  avatar_url: string
  availability_status: string
  years_experience: number | null
  license_verification_status: string
  employment_types: string[]
  seeking_ojt: boolean
}

type ViewerProfile = {
  user_type: string
  location: string | null
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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [tradeFilter, setTradeFilter] = useState('all')
  const [workTypeFilter, setWorkTypeFilter] = useState('all')
  const [minimumExperience, setMinimumExperience] = useState('0')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [sortBy, setSortBy] = useState('best_match')
  const [viewer, setViewer] = useState<ViewerProfile | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [directoryResult, viewerResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, user_type, trade_type, location, work_radius, business_name, company_name, avatar_url, availability_status, years_experience, license_verification_status, employment_types, seeking_ojt')
          .not('user_type', 'is', null),
        supabase
          .from('profiles')
          .select('user_type, location')
          .eq('id', user.id)
          .single(),
      ])

      setProfiles(directoryResult.data ?? [])
      setViewer(viewerResult.data ?? null)
      setLoading(false)
    }
    load()
  }, [router])

  const trades = useMemo(() => (
    [...new Set([
      ...tradeOptions,
      ...profiles.map(profile => profile.trade_type).filter(Boolean) as string[],
    ])]
      .sort((a, b) => a.localeCompare(b))
  ), [profiles])

  const filtered = useMemo(() => {
    let results = profiles

    if (typeFilter !== 'all') {
      results = results.filter(p => p.user_type === typeFilter)
    }

    if (availabilityFilter !== 'all') {
      results = results.filter(p => p.availability_status === availabilityFilter)
    }

    if (tradeFilter !== 'all') {
      results = results.filter(p => p.trade_type === tradeFilter)
    }

    if (workTypeFilter !== 'all') {
      results = results.filter(p => (p.employment_types ?? []).includes(workTypeFilter))
    }

    if (minimumExperience !== '0') {
      results = results.filter(p => (p.years_experience ?? 0) >= Number(minimumExperience))
    }

    if (verifiedOnly) {
      results = results.filter(p => p.license_verification_status === 'verified')
    }

    if (availableOnly) {
      results = results.filter(p => p.availability_status === 'available_now')
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter(p =>
        p.full_name?.toLowerCase().includes(q) ||
        p.trade_type?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.business_name?.toLowerCase().includes(q) ||
        p.company_name?.toLowerCase().includes(q)
      )
    }

    return [...results].sort((a, b) => {
      if (sortBy === 'experience') {
        return (b.years_experience ?? 0) - (a.years_experience ?? 0)
      }
      if (sortBy === 'name') {
        return (a.full_name ?? '').localeCompare(b.full_name ?? '')
      }
      return matchScore(b, viewer) - matchScore(a, viewer)
    })
  }, [
    availabilityFilter,
    availableOnly,
    minimumExperience,
    profiles,
    search,
    sortBy,
    tradeFilter,
    typeFilter,
    verifiedOnly,
    viewer,
    workTypeFilter,
  ])

  const activeFilterCount = [
    typeFilter !== 'all',
    availabilityFilter !== 'all',
    tradeFilter !== 'all',
    workTypeFilter !== 'all',
    minimumExperience !== '0',
    verifiedOnly,
    availableOnly,
    Boolean(search.trim()),
  ].filter(Boolean).length

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setAvailabilityFilter('all')
    setTradeFilter('all')
    setWorkTypeFilter('all')
    setMinimumExperience('0')
    setVerifiedOnly(false)
    setAvailableOnly(false)
  }

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

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
          <div className="flex gap-3 flex-wrap">
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
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
          >
            <option value="all">Any Availability</option>
            <option value="available_now">Available Now</option>
            <option value="available_soon">Available Soon</option>
            <option value="not_available">Not Available</option>
          </select>
          <select
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Trades</option>
            {trades.map(trade => <option key={trade} value={trade}>{trade}</option>)}
          </select>
          <select
            value={workTypeFilter}
            onChange={(e) => setWorkTypeFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
          >
            <option value="all">Any Work Type</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="weekends">Weekends</option>
          </select>
          <select
            value={minimumExperience}
            onChange={(e) => setMinimumExperience(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
          >
            <option value="0">Any Experience</option>
            <option value="1">1+ Years</option>
            <option value="3">3+ Years</option>
            <option value="5">5+ Years</option>
            <option value="10">10+ Years</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
          >
            <option value="best_match">Best Match</option>
            <option value="experience">Most Experience</option>
            <option value="name">Name A–Z</option>
          </select>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
              <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} className="accent-orange-500" />
              Available now
            </label>
            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
              <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="accent-orange-500" />
              Verified only
            </label>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-orange-400 hover:text-orange-300 ml-auto">
                Clear {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-white font-semibold text-lg">No results found</p>
            <p className="text-gray-400 mt-1">Try widening your trade, availability, or experience filters.</p>
            <button onClick={clearFilters} className="mt-5 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-xl transition">
              Show all members
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(profile => (
              <button
                key={profile.id}
                onClick={() => router.push(`/dashboard/directory/${profile.id}`)}
                className="bg-gray-900 border border-gray-800 hover:border-orange-500 rounded-2xl p-5 transition text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    {profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name ?? 'Profile'}
                        className="w-12 h-12 rounded-full object-cover border border-gray-700 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 font-semibold flex-shrink-0">
                        {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-white text-lg">{profile.full_name ?? '—'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-lg mt-1 inline-block ${userTypeColor[profile.user_type] ?? 'text-gray-400 bg-gray-800'}`}>
                        {userTypeLabel[profile.user_type] ?? profile.user_type}
                      </span>
                      {sortBy === 'best_match' && matchScore(profile, viewer) >= 6 && (
                        <span className="text-xs px-2 py-0.5 rounded-lg mt-1 ml-2 inline-block text-orange-300 bg-orange-500/10">
                          Strong match
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-1">
                  {profile.trade_type && (
                    <p className="text-sm text-gray-300">
                      🔧 {profile.trade_type}
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
                  {typeof profile.years_experience === 'number' && (
                    <p className="text-sm text-gray-400">🧰 {profile.years_experience} years in trade</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.availability_status && profile.availability_status !== 'not_listed' && (
                    <span className={`text-xs px-2.5 py-1 rounded-full ${
                      profile.availability_status === 'available_now'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-gray-800 text-gray-300'
                    }`}>
                      {availabilityLabels[profile.availability_status]}
                    </span>
                  )}
                  {profile.license_verification_status === 'verified' && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400">
                      ✓ {verificationLabels.verified}
                    </span>
                  )}
                  {profile.seeking_ojt && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400">
                      Seeking OJT
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function matchScore(profile: Profile, viewer: ViewerProfile | null) {
  let score = 0
  if (profile.availability_status === 'available_now') score += 3
  if (profile.license_verification_status === 'verified') score += 3
  if ((profile.years_experience ?? 0) >= 5) score += 2
  if ((profile.employment_types ?? []).length > 0) score += 1
  if (profile.avatar_url) score += 1
  if (profile.location && viewer?.location && normalizeLocation(profile.location) === normalizeLocation(viewer.location)) score += 3
  if (
    (viewer?.user_type === 'gc_builder' || viewer?.user_type === 'business_owner') &&
    (profile.user_type === 'professional' || profile.user_type === 'apprentice')
  ) score += 2
  return score
}

function normalizeLocation(value: string) {
  return value.trim().toLowerCase().replaceAll(' ', '')
}
