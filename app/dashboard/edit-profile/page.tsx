'use client'

import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import {
  availabilityLabels,
  calculateProfileCompletion,
  employmentOptions,
  verificationLabels,
} from '../../lib/profile'
import type { MemberProfile } from '../../lib/profile'
import AvatarUploader from '../../components/AvatarUploader'
import PortfolioUploader from '../../components/PortfolioUploader'
import CertUploader from '../../components/CertUploader'

const emptyProfileFields = {
  license_verification_status: 'unverified',
  availability_status: 'not_listed',
  employment_types: [] as string[],
  union_preference: 'no_preference',
  seeking_ojt: false,
}

export default function EditProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [formData, setFormData] = useState<Partial<MemberProfile>>(emptyProfileFields)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error || !data) {
        setMessage('We could not load your profile.')
        setLoading(false)
        return
      }

      const loaded = {
        ...emptyProfileFields,
        ...data,
        employment_types: data.employment_types ?? [],
      } as MemberProfile
      setProfile(loaded)
      setFormData(loaded)
      setLoading(false)
    }
    load()
  }, [router])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target
    setFormData(current => ({ ...current, [name]: value }))
  }

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData(current => ({
      ...current,
      [name]: value === '' ? null : Number(value),
    }))
  }

  const toggleEmploymentType = (value: string) => {
    setFormData(current => {
      const selected = current.employment_types ?? []
      return {
        ...current,
        employment_types: selected.includes(value)
          ? selected.filter(item => item !== value)
          : [...selected, value],
      }
    })
  }

  const handleSave = async () => {
    if (!formData.id) return
    setSaving(true)
    setMessage('')

    const allowedChanges = {
      full_name: formData.full_name?.trim() || null,
      location: formData.location?.trim() || null,
      avatar_url: formData.avatar_url ?? null,
      company_name: formData.company_name?.trim() || null,
      business_name: formData.business_name?.trim() || null,
      trade_type: formData.trade_type?.trim() || null,
      hiring_radius: formData.hiring_radius?.trim() || null,
      work_radius: formData.work_radius?.trim() || null,
      school_program: formData.school_program?.trim() || null,
      hire_abroad: formData.hire_abroad ?? false,
      bio: formData.bio?.trim() || null,
      years_experience: formData.years_experience ?? null,
      license_number: formData.license_number?.trim() || null,
      license_state: formData.license_state?.trim() || null,
      availability_status: formData.availability_status ?? 'not_listed',
      employment_types: formData.employment_types ?? [],
      union_preference: formData.union_preference ?? 'no_preference',
      tools_equipment: formData.tools_equipment?.trim() || null,
      references_summary: formData.references_summary?.trim() || null,
      social_url: formData.social_url?.trim() || null,
      video_intro_url: formData.video_intro_url?.trim() || null,
      apprentice_hours: formData.apprentice_hours ?? null,
      seeking_ojt: formData.seeking_ojt ?? false,
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(allowedChanges)
      .eq('id', formData.id)
      .select()
      .single()

    setSaving(false)
    if (error) { setMessage(error.message); return }

    const saved = {
      ...emptyProfileFields,
      ...data,
      employment_types: data.employment_types ?? [],
    } as MemberProfile
    setProfile(saved)
    setFormData(saved)
    setMessage('Profile saved!')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <p className="animate-pulse text-gray-400">Loading...</p>
      </div>
    )
  }

  const completion = calculateProfileCompletion(formData)
  const isWorker = profile?.user_type === 'professional' || profile?.user_type === 'apprentice'
  const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500'
  const labelClass = 'text-sm text-gray-300 mb-1.5 block'
  const sectionClass = 'bg-gray-900 border border-gray-800 rounded-2xl p-6'

  return (
    <div className="min-h-screen bg-gray-950 text-white p-5 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition"
        >
          ← Back to Dashboard
        </button>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Build Your Profile</h1>
            <p className="text-gray-400 mt-1">Complete profiles earn more trust and better matches.</p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm font-semibold text-orange-400">{completion}% complete</p>
            <div className="w-full sm:w-40 h-2 bg-gray-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <section className={sectionClass}>
            <h2 className="text-lg font-semibold mb-5">Personal Information</h2>
            {formData.id && (
              <AvatarUploader
                userId={formData.id}
                currentUrl={formData.avatar_url}
                onUploaded={(url) => setFormData(current => ({ ...current, avatar_url: url }))}
              />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name">
                <input name="full_name" value={formData.full_name ?? ''} onChange={handleChange} className={inputClass} required />
              </Field>
              <Field label="Location">
                <input name="location" placeholder="Miami, FL" value={formData.location ?? ''} onChange={handleChange} className={inputClass} required />
              </Field>
            </div>
            <Field label="About you">
              <textarea
                name="bio"
                rows={4}
                maxLength={800}
                placeholder="Share your experience, the work you do, and what makes you dependable."
                value={formData.bio ?? ''}
                onChange={handleChange}
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Professional or social profile">
                <input name="social_url" type="url" placeholder="https://..." value={formData.social_url ?? ''} onChange={handleChange} className={inputClass} />
              </Field>
              <Field label="Video introduction">
                <input name="video_intro_url" type="url" placeholder="YouTube or Vimeo URL" value={formData.video_intro_url ?? ''} onChange={handleChange} className={inputClass} />
              </Field>
            </div>
          </section>

          {(profile?.user_type === 'gc_builder' || profile?.user_type === 'business_owner') && (
            <section className={sectionClass}>
              <h2 className="text-lg font-semibold mb-5">Business Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.user_type === 'gc_builder' ? (
                  <>
                    <Field label="Company name">
                      <input name="company_name" value={formData.company_name ?? ''} onChange={handleChange} className={inputClass} />
                    </Field>
                    <Field label="Hiring radius">
                      <input name="hiring_radius" placeholder="50" value={formData.hiring_radius ?? ''} onChange={handleChange} className={inputClass} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Business name">
                      <input name="business_name" value={formData.business_name ?? ''} onChange={handleChange} className={inputClass} />
                    </Field>
                    <Field label="Primary trade">
                      <input name="trade_type" placeholder="Plumbing" value={formData.trade_type ?? ''} onChange={handleChange} className={inputClass} />
                    </Field>
                    <Field label="Work radius">
                      <input name="work_radius" placeholder="50" value={formData.work_radius ?? ''} onChange={handleChange} className={inputClass} />
                    </Field>
                  </>
                )}
              </div>
              {profile.user_type === 'gc_builder' && (
                <label className="flex items-center gap-3 text-sm text-gray-300 mt-2">
                  <input
                    type="checkbox"
                    checked={formData.hire_abroad ?? false}
                    onChange={(event) => setFormData(current => ({ ...current, hire_abroad: event.target.checked }))}
                    className="w-4 h-4 accent-orange-500"
                  />
                  Open to hiring from abroad
                </label>
              )}
            </section>
          )}

          {isWorker && (
            <>
              <section className={sectionClass}>
                <h2 className="text-lg font-semibold mb-5">Trade Experience</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={profile?.user_type === 'apprentice' ? 'Trade you are learning' : 'Primary trade'}>
                    <input name="trade_type" placeholder="Electrician" value={formData.trade_type ?? ''} onChange={handleChange} className={inputClass} />
                  </Field>
                  <Field label="Work radius">
                    <input name="work_radius" placeholder="25" value={formData.work_radius ?? ''} onChange={handleChange} className={inputClass} />
                  </Field>
                  {profile?.user_type === 'professional' ? (
                    <Field label="Years in the trade">
                      <input name="years_experience" type="number" min="0" max="80" value={formData.years_experience ?? ''} onChange={handleNumberChange} className={inputClass} />
                    </Field>
                  ) : (
                    <>
                      <Field label="School or program">
                        <input name="school_program" value={formData.school_program ?? ''} onChange={handleChange} className={inputClass} />
                      </Field>
                      <Field label="Verified trade hours">
                        <input name="apprentice_hours" type="number" min="0" max="50000" value={formData.apprentice_hours ?? ''} onChange={handleNumberChange} className={inputClass} />
                      </Field>
                    </>
                  )}
                </div>
                <Field label="Tools and equipment">
                  <textarea name="tools_equipment" rows={3} placeholder="List the tools, vehicles, or equipment you can bring to a job." value={formData.tools_equipment ?? ''} onChange={handleChange} className={inputClass} />
                </Field>
                <Field label="References">
                  <textarea name="references_summary" rows={3} placeholder="Add a short reference summary. Do not include private contact details yet." value={formData.references_summary ?? ''} onChange={handleChange} className={inputClass} />
                </Field>
              </section>

              <section className={sectionClass}>
                <h2 className="text-lg font-semibold mb-5">Availability & Preferences</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Availability">
                    <select name="availability_status" value={formData.availability_status ?? 'not_listed'} onChange={handleChange} className={inputClass}>
                      {Object.entries(availabilityLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Union preference">
                    <select name="union_preference" value={formData.union_preference ?? 'no_preference'} onChange={handleChange} className={inputClass}>
                      <option value="no_preference">No preference</option>
                      <option value="union">Union</option>
                      <option value="non_union">Non-union</option>
                    </select>
                  </Field>
                </div>
                <span className={labelClass}>Work types</span>
                <div className="grid grid-cols-2 gap-3">
                  {employmentOptions.map(option => (
                    <label key={option.value} className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={(formData.employment_types ?? []).includes(option.value)}
                        onChange={() => toggleEmploymentType(option.value)}
                        className="w-4 h-4 accent-orange-500"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {profile?.user_type === 'apprentice' && (
                  <label className="flex items-center gap-3 text-sm text-gray-300 mt-4">
                    <input
                      type="checkbox"
                      checked={formData.seeking_ojt ?? false}
                      onChange={(event) => setFormData(current => ({ ...current, seeking_ojt: event.target.checked }))}
                      className="w-4 h-4 accent-orange-500"
                    />
                    Looking for on-the-job training
                  </label>
                )}
              </section>

              <section className={sectionClass}>
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-lg font-semibold">License Verification</h2>
                    <p className="text-sm text-gray-400 mt-1">Changing license details sends them back for review.</p>
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-full ${
                    formData.license_verification_status === 'verified'
                      ? 'bg-green-500/10 text-green-400'
                      : formData.license_verification_status === 'pending'
                        ? 'bg-yellow-500/10 text-yellow-400'
                        : 'bg-gray-800 text-gray-400'
                  }`}>
                    {verificationLabels[formData.license_verification_status ?? 'unverified']}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="License number">
                    <input name="license_number" value={formData.license_number ?? ''} onChange={handleChange} className={inputClass} />
                  </Field>
                  <Field label="Issuing state or region">
                    <input name="license_state" placeholder="Florida" value={formData.license_state ?? ''} onChange={handleChange} className={inputClass} />
                  </Field>
                </div>
              </section>
            </>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>

          {message && (
            <p aria-live="polite" className={`text-sm text-center ${message === 'Profile saved!' ? 'text-green-400' : 'text-red-400'}`}>
              {message}
            </p>
          )}

          {formData.id && (
            <section className={sectionClass}>
              <h2 className="text-lg font-semibold mb-1">Project Portfolio</h2>
              <p className="text-sm text-gray-400 mb-5">Upload jobsite and before-and-after photos.</p>
              <PortfolioUploader userId={formData.id} />
            </section>
          )}

          {formData.id && (
            <section className={sectionClass}>
              <h2 className="text-lg font-semibold mb-1">Licenses & Certifications</h2>
              <p className="text-sm text-gray-400 mb-5">Files remain private while their verification status is reviewed.</p>
              <CertUploader userId={formData.id} />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="text-sm text-gray-300 mb-1.5 block">{label}</span>
      {children}
    </label>
  )
}
