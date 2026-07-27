'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import {
  availabilityLabels,
  employmentOptions,
  verificationLabels,
} from '../../../lib/profile'
import type { MemberProfile } from '../../../lib/profile'

type PortfolioImage = {
  id: string
  image_url: string
  caption: string | null
}

type Certification = {
  id: string
  cert_name: string
  issuing_org: string | null
  expiry_date: string | null
}

const userTypeLabels: Record<string, string> = {
  gc_builder: 'GC / Builder',
  business_owner: 'Trade Business Owner',
  professional: 'Trades Professional',
  apprentice: 'Apprentice',
}

export default function MemberProfilePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioImage[]>([])
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [profileResult, portfolioResult, certificationResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', params.id).single(),
        supabase
          .from('portfolio_images')
          .select('id, image_url, caption')
          .eq('user_id', params.id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('certifications')
          .select('id, cert_name, issuing_org, expiry_date')
          .eq('user_id', params.id)
          .eq('verification_status', 'verified')
          .order('created_at', { ascending: false }),
      ])

      if (profileResult.error || !profileResult.data) {
        setError('This member profile could not be found.')
      } else {
        setProfile(profileResult.data as MemberProfile)
        setPortfolio(portfolioResult.data ?? [])
        setCertifications(certificationResult.data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [params.id, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <p className="animate-pulse text-gray-400">Loading profile...</p>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-3xl mx-auto text-center py-24">
          <p className="text-gray-300">{error}</p>
          <button onClick={() => router.push('/dashboard/directory')} className="text-orange-400 mt-4">
            Return to directory
          </button>
        </div>
      </div>
    )
  }

  const displayName = profile.full_name || profile.business_name || profile.company_name || 'TradesCraftConnect Member'
  const safeSocialUrl = safeExternalUrl(profile.social_url)
  const safeVideoUrl = safeExternalUrl(profile.video_intro_url)
  const selectedEmployment = employmentOptions.filter(option =>
    (profile.employment_types ?? []).includes(option.value)
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-5 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/dashboard/directory')}
          className="text-gray-400 hover:text-white text-sm mb-6 transition"
        >
          ← Back to Directory
        </button>

        <section className="bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={displayName} className="w-24 h-24 rounded-2xl object-cover border border-gray-700" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center text-3xl text-gray-400">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold">{displayName}</h1>
                {profile.license_verification_status === 'verified' && (
                  <span className="text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-400">
                    ✓ {verificationLabels.verified}
                  </span>
                )}
              </div>
              <p className="text-orange-400 mt-1">{userTypeLabels[profile.user_type]}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-400 mt-4">
                {profile.trade_type && <span>🔧 {profile.trade_type}</span>}
                {profile.location && <span>📍 {profile.location}</span>}
                {profile.work_radius && <span>📏 {profile.work_radius} mile radius</span>}
                {typeof profile.years_experience === 'number' && <span>🧰 {profile.years_experience} years</span>}
              </div>
              {profile.availability_status !== 'not_listed' && (
                <span className={`inline-block text-sm px-3 py-1.5 rounded-full mt-4 ${
                  profile.availability_status === 'available_now'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-gray-800 text-gray-300'
                }`}>
                  {availabilityLabels[profile.availability_status]}
                </span>
              )}
            </div>
          </div>

          {profile.bio && <p className="text-gray-300 leading-7 mt-7 whitespace-pre-wrap">{profile.bio}</p>}

          {(safeSocialUrl || safeVideoUrl) && (
            <div className="flex flex-wrap gap-3 mt-6">
              {safeSocialUrl && (
                <a href={safeSocialUrl} target="_blank" rel="noopener noreferrer" className="border border-gray-700 hover:border-orange-500 px-4 py-2 rounded-xl text-sm transition">
                  Professional Profile ↗
                </a>
              )}
              {safeVideoUrl && (
                <a href={safeVideoUrl} target="_blank" rel="noopener noreferrer" className="border border-gray-700 hover:border-orange-500 px-4 py-2 rounded-xl text-sm transition">
                  Video Introduction ↗
                </a>
              )}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <ProfileSection title="Experience & Preferences">
            <InfoRow label="Business" value={profile.business_name || profile.company_name} />
            <InfoRow label="School / Program" value={profile.school_program} />
            <InfoRow label="Trade hours" value={profile.apprentice_hours === null ? null : `${profile.apprentice_hours} hours`} />
            <InfoRow label="Union preference" value={formatValue(profile.union_preference)} />
            <InfoRow label="Work types" value={selectedEmployment.map(option => option.label).join(', ')} />
            <InfoRow label="On-the-job training" value={profile.seeking_ojt ? 'Seeking OJT' : null} />
          </ProfileSection>

          <ProfileSection title="Tools & References">
            <InfoRow label="Tools and equipment" value={profile.tools_equipment} multiline />
            <InfoRow label="References" value={profile.references_summary} multiline />
          </ProfileSection>
        </div>

        <section className="bg-gray-900 border border-gray-800 rounded-3xl p-6 mt-6">
          <h2 className="text-xl font-semibold">Verified Certifications</h2>
          {certifications.length === 0 ? (
            <p className="text-gray-500 mt-4">No verified certifications displayed yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {certifications.map(certification => (
                <div key={certification.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <p className="font-medium">✓ {certification.cert_name}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {[certification.issuing_org, certification.expiry_date && `Expires ${new Date(certification.expiry_date).toLocaleDateString()}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-gray-900 border border-gray-800 rounded-3xl p-6 mt-6">
          <h2 className="text-xl font-semibold">Project Portfolio</h2>
          {portfolio.length === 0 ? (
            <p className="text-gray-500 mt-4">No project photos added yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
              {portfolio.map(image => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={image.id}
                  src={image.image_url}
                  alt={image.caption ?? 'Project work'}
                  className="w-full aspect-square object-cover rounded-xl border border-gray-700"
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-3xl p-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function InfoRow({ label, value, multiline = false }: { label: string; value?: string | null; multiline?: boolean }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-gray-200 mt-1 ${multiline ? 'whitespace-pre-wrap leading-6' : ''}`}>{value}</p>
    </div>
  )
}

function safeExternalUrl(value?: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function formatValue(value?: string | null) {
  if (!value || value === 'no_preference') return null
  return value.replaceAll('_', '-').replace(/\b\w/g, letter => letter.toUpperCase())
}
