'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function EditProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setFormData(data ?? {})
      setLoading(false)
    }
    load()
  }, [])

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    const { error } = await supabase
      .from('profiles')
      .update(formData)
      .eq('id', formData.id)

    setSaving(false)
    if (error) { setMessage(error.message); return }
    setMessage('Profile saved!')
    setTimeout(() => router.push('/dashboard'), 1000)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <p className="animate-pulse text-gray-400">Loading...</p>
    </div>
  )

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 mb-3"

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition"
        >
          ← Back to Dashboard
        </button>

        <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-4">Personal</h2>
          <input
            name="full_name"
            placeholder="Full Name"
            value={formData.full_name ?? ''}
            onChange={handleChange}
            className={inputClass}
          />
          <input
            name="location"
            placeholder="Location (e.g. Miami, FL)"
            value={formData.location ?? ''}
            onChange={handleChange}
            className={inputClass}
          />

          {profile?.user_type === 'gc_builder' && (
            <>
              <h2 className="text-sm text-gray-400 uppercase tracking-wide mt-4 mb-3">Company</h2>
              <input name="company_name" placeholder="Company Name" value={formData.company_name ?? ''} onChange={handleChange} className={inputClass} />
              <input name="hiring_radius" placeholder="Hiring Radius (miles)" value={formData.hiring_radius ?? ''} onChange={handleChange} className={inputClass} />
              <label className="flex items-center gap-3 text-sm text-gray-300 mt-1 mb-3">
                <input
                  type="checkbox"
                  checked={formData.hire_abroad ?? false}
                  onChange={(e) => setFormData({ ...formData, hire_abroad: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
                Open to hiring from abroad
              </label>
            </>
          )}

          {profile?.user_type === 'business_owner' && (
            <>
              <h2 className="text-sm text-gray-400 uppercase tracking-wide mt-4 mb-3">Business</h2>
              <input name="business_name" placeholder="Business Name" value={formData.business_name ?? ''} onChange={handleChange} className={inputClass} />
              <input name="trade_type" placeholder="Trade Type (e.g. Plumbing)" value={formData.trade_type ?? ''} onChange={handleChange} className={inputClass} />
              <input name="work_radius" placeholder="Work Radius (miles)" value={formData.work_radius ?? ''} onChange={handleChange} className={inputClass} />
            </>
          )}

          {profile?.user_type === 'professional' && (
            <>
              <h2 className="text-sm text-gray-400 uppercase tracking-wide mt-4 mb-3">Trade Info</h2>
              <input name="trade_type" placeholder="Your Trade (e.g. Electrician)" value={formData.trade_type ?? ''} onChange={handleChange} className={inputClass} />
              <input name="work_radius" placeholder="Work Radius (miles)" value={formData.work_radius ?? ''} onChange={handleChange} className={inputClass} />
            </>
          )}

          {profile?.user_type === 'apprentice' && (
            <>
              <h2 className="text-sm text-gray-400 uppercase tracking-wide mt-4 mb-3">Trade Info</h2>
              <input name="trade_type" placeholder="Trade You're Learning" value={formData.trade_type ?? ''} onChange={handleChange} className={inputClass} />
              <input name="school_program" placeholder="School or Program Name" value={formData.school_program ?? ''} onChange={handleChange} className={inputClass} />
            </>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition mt-4"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {message && (
            <p className={`text-sm mt-3 text-center ${message === 'Profile saved!' ? 'text-green-400' : 'text-red-400'}`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}