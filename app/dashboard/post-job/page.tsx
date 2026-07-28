'use client'

import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { tradeOptions } from '../../lib/profile'

export default function PostJobPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    trade_type: '',
    location: '',
    radius: '',
    job_type: 'project',
    start_date: '',
    pay_range: '',
    requirements: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
          <label className="text-sm text-gray-300">Job title</label>
          <input
            name="title"
            placeholder="Job Title (e.g. Plumber needed for bathroom remodel)"
            onChange={handleChange}
            className={inputClass}
          />
          <label className="text-sm text-gray-300">Scope of work</label>
          <textarea
            name="description"
            placeholder="Job Description — what's the scope of work, timeline, any requirements?"
            onChange={handleChange}
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 mb-3 resize-none"
          />
          <label className="text-sm text-gray-300">Trade needed</label>
          <select name="trade_type" value={formData.trade_type} onChange={handleChange} className={inputClass}>
            <option value="">Select a trade</option>
            {tradeOptions.map(trade => <option key={trade} value={trade}>{trade}</option>)}
          </select>
          <label className="text-sm text-gray-300">Work arrangement</label>
          <select name="job_type" value={formData.job_type} onChange={handleChange} className={inputClass}>
            <option value="project">Project / One-time</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="weekends">Weekends</option>
          </select>
          <label className="text-sm text-gray-300">Location</label>
          <input
            name="location"
            placeholder="Location (e.g. Miami, FL)"
            onChange={handleChange}
            className={inputClass}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            name="radius"
            placeholder="Hiring radius (e.g. 25 miles)"
            onChange={handleChange}
            className={inputClass}
          />
          <input
            name="start_date"
            type="date"
            onChange={handleChange}
            className={inputClass}
          />
          </div>
          <input name="pay_range" placeholder="Pay range or project budget (optional)" onChange={handleChange} className={inputClass} />
          <textarea
            name="requirements"
            placeholder="Requirements — license, tools, experience, schedule..."
            onChange={handleChange}
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 mb-3 resize-none"
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
