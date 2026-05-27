'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function PostJobPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    trade_type: '',
    location: '',
    radius: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.trade_type || !formData.location) {
      setMessage('Please fill in at least the title, trade type, and location.')
      return
    }

    setSaving(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase.from('job_postings').insert({
      ...formData,
      poster_id: user.id,
      status: 'open',
    })

    setSaving(false)
    if (error) { setMessage(error.message); return }
    router.push('/dashboard/jobs')
  }

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

        <h1 className="text-2xl font-bold mb-2">Post a Job</h1>
        <p className="text-gray-400 mb-6">Fill in the details to find the right tradesperson</p>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <input
            name="title"
            placeholder="Job Title (e.g. Plumber needed for bathroom remodel)"
            onChange={handleChange}
            className={inputClass}
          />
          <textarea
            name="description"
            placeholder="Job Description — what's the scope of work, timeline, any requirements?"
            onChange={handleChange}
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 mb-3 resize-none"
          />
          <input
            name="trade_type"
            placeholder="Trade Type (e.g. Plumbing, Electrical, Framing)"
            onChange={handleChange}
            className={inputClass}
          />
          <input
            name="location"
            placeholder="Location (e.g. Miami, FL)"
            onChange={handleChange}
            className={inputClass}
          />
          <input
            name="radius"
            placeholder="Hiring Radius (e.g. 25 miles)"
            onChange={handleChange}
            className={inputClass}
          />

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition mt-2"
          >
            {saving ? 'Posting...' : 'Post Job'}
          </button>

          {message && <p className="text-red-400 text-sm mt-3 text-center">{message}</p>}
        </div>
      </div>
    </div>
  )
}