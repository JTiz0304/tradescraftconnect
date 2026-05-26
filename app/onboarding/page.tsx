'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

const userTypes = [
  { id: 'gc_builder', label: 'GC / Builder', icon: '🏗️', desc: 'Managing projects and subcontractors' },
  { id: 'business_owner', label: 'Trade Business Owner', icon: '🔧', desc: 'Own a trades business and hire staff' },
  { id: 'professional', label: 'Trades Professional', icon: '👷', desc: 'Skilled tradesperson looking for work' },
  { id: 'apprentice', label: 'Apprentice', icon: '🎓', desc: 'Learning the trade and building experience' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [userType, setUserType] = useState('')
  const [formData, setFormData] = useState<any>({})
  const [message, setMessage] = useState('')

  const handleTypeSelect = (type: string) => {
    setUserType(type)
    setStep(2)
  }

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase.from('profiles').update({
      user_type: userType,
      ...formData,
    }).eq('id', user.id)

    if (error) { setMessage(error.message); return }
    router.push('/dashboard')
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 mb-3"

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold text-center mb-2">Welcome! What best describes you?</h1>
            <p className="text-gray-400 text-center mb-8">Choose your role to get started</p>
            <div className="grid grid-cols-2 gap-4">
              {userTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => handleTypeSelect(type.id)}
                  className="bg-gray-900 border border-gray-700 hover:border-orange-500 rounded-2xl p-6 text-left transition"
                >
                  <div className="text-3xl mb-3">{type.icon}</div>
                  <div className="font-semibold text-white mb-1">{type.label}</div>
                  <div className="text-sm text-gray-400">{type.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && userType === 'gc_builder' && (
          <>
            <h1 className="text-2xl font-bold mb-6">🏗️ Tell us about your business</h1>
            <input name="full_name" placeholder="Your Full Name" onChange={handleChange} className={inputClass} />
            <input name="company_name" placeholder="Company Name" onChange={handleChange} className={inputClass} />
            <input name="location" placeholder="Location (e.g. Miami, FL)" onChange={handleChange} className={inputClass} />
            <input name="hiring_radius" placeholder="Hiring Radius (e.g. 50 miles)" onChange={handleChange} className={inputClass} />
            <button onClick={handleSave} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition mt-2">Complete Setup</button>
          </>
        )}

        {step === 2 && userType === 'business_owner' && (
          <>
            <h1 className="text-2xl font-bold mb-6">🔧 Tell us about your business</h1>
            <input name="full_name" placeholder="Your Full Name" onChange={handleChange} className={inputClass} />
            <input name="business_name" placeholder="Business Name" onChange={handleChange} className={inputClass} />
            <input name="trade_type" placeholder="Trade Type (e.g. Plumbing, Electrical)" onChange={handleChange} className={inputClass} />
            <input name="location" placeholder="Location (e.g. Miami, FL)" onChange={handleChange} className={inputClass} />
            <input name="work_radius" placeholder="Work Radius (e.g. 50 miles)" onChange={handleChange} className={inputClass} />
            <button onClick={handleSave} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition mt-2">Complete Setup</button>
          </>
        )}

        {step === 2 && userType === 'professional' && (
          <>
            <h1 className="text-2xl font-bold mb-6">👷 Tell us about yourself</h1>
            <input name="full_name" placeholder="Full Name" onChange={handleChange} className={inputClass} />
            <input name="trade_type" placeholder="Your Trade (e.g. Plumber, Electrician)" onChange={handleChange} className={inputClass} />
            <input name="location" placeholder="Location (e.g. Miami, FL)" onChange={handleChange} className={inputClass} />
            <input name="work_radius" placeholder="Work Radius (e.g. 25 miles)" onChange={handleChange} className={inputClass} />
            <button onClick={handleSave} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition mt-2">Complete Setup</button>
          </>
        )}

        {step === 2 && userType === 'apprentice' && (
          <>
            <h1 className="text-2xl font-bold mb-6">🎓 Tell us about yourself</h1>
            <input name="full_name" placeholder="Full Name" onChange={handleChange} className={inputClass} />
            <input name="trade_type" placeholder="Trade You're Learning (e.g. Electrician)" onChange={handleChange} className={inputClass} />
            <input name="school_program" placeholder="School or Program Name" onChange={handleChange} className={inputClass} />
            <input name="location" placeholder="Location (e.g. Miami, FL)" onChange={handleChange} className={inputClass} />
            <button onClick={handleSave} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition mt-2">Complete Setup</button>
          </>
        )}

        {message && <p className="text-red-400 mt-4 text-sm">{message}</p>}
      </div>
    </div>
  )
}