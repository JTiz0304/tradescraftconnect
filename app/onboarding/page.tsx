'use client'

import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'

const userTypes = [
  { id: 'gc_builder', label: 'GC / Builder', icon: '🏗️', desc: 'Managing projects and subcontractors' },
  { id: 'business_owner', label: 'Trade Business Owner', icon: '🔧', desc: 'Own a trades business and hire staff' },
  { id: 'professional', label: 'Trades Professional', icon: '👷', desc: 'Skilled tradesperson looking for work' },
  { id: 'apprentice', label: 'Apprentice', icon: '🎓', desc: 'Learning the trade and building experience' },
]

export default function OnboardingPage() {
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
    if (!user) { window.location.href = '/login'; return }

    const { error } = await supabase.from('profiles').update({
      user_type: userType,
      ...formData,
    }).eq('id', user.id)

    if (error) { setMessage(error.message); return }
    window.location.href = '/dashboard'
  }

  return (
    <div style={{ maxWidth: 600, margin: '80px auto', fontFamily: 'sans-serif', padding: '0 20px' }}>
      {step === 1 && (
        <>
          <h1>Welcome! What best describes you?</h1>
          <p style={{ color: '#888', marginBottom: 32 }}>Choose your role to get started</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {userTypes.map(type => (
              <button key={type.id} onClick={() => handleTypeSelect(type.id)} style={card}>
                <div style={{ fontSize: 36 }}>{type.icon}</div>
                <div style={{ fontWeight: 'bold', fontSize: 16, margin: '8px 0 4px' }}>{type.label}</div>
                <div style={{ fontSize: 13, color: '#aaa' }}>{type.desc}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && userType === 'gc_builder' && (
        <>
          <h1>🏗️ Tell us about your business</h1>
          <input name="company_name" placeholder="Company Name" onChange={handleChange} style={input} />
          <input name="location" placeholder="Location (e.g. Miami, FL)" onChange={handleChange} style={input} />
          <input name="trade_type" placeholder="Project Types (e.g. Residential, Commercial)" onChange={handleChange} style={input} />
          <button onClick={handleSave} style={btn}>Complete Setup</button>
        </>
      )}

      {step === 2 && userType === 'business_owner' && (
        <>
          <h1>🔧 Tell us about your business</h1>
          <input name="business_name" placeholder="Business Name" onChange={handleChange} style={input} />
          <input name="trade_type" placeholder="Trade Type (e.g. Plumbing, Electrical)" onChange={handleChange} style={input} />
          <input name="location" placeholder="Location (e.g. Miami, FL)" onChange={handleChange} style={input} />
          <input name="hiring_radius" placeholder="Hiring Radius (e.g. 50 miles)" onChange={handleChange} style={input} />
          <button onClick={handleSave} style={btn}>Complete Setup</button>
        </>
      )}

      {step === 2 && userType === 'professional' && (
        <>
          <h1>👷 Tell us about yourself</h1>
          <input name="full_name" placeholder="Full Name" onChange={handleChange} style={input} />
          <input name="trade_type" placeholder="Your Trade (e.g. Plumber, Electrician)" onChange={handleChange} style={input} />
          <input name="location" placeholder="Location (e.g. Miami, FL)" onChange={handleChange} style={input} />
          <input name="work_radius" placeholder="Work Radius (e.g. 25 miles)" onChange={handleChange} style={input} />
          <button onClick={handleSave} style={btn}>Complete Setup</button>
        </>
      )}

      {step === 2 && userType === 'apprentice' && (
        <>
          <h1>🎓 Tell us about yourself</h1>
          <input name="full_name" placeholder="Full Name" onChange={handleChange} style={input} />
          <input name="trade_type" placeholder="Trade You're Learning (e.g. Electrician)" onChange={handleChange} style={input} />
          <input name="school_program" placeholder="School or Program Name" onChange={handleChange} style={input} />
          <input name="location" placeholder="Location (e.g. Miami, FL)" onChange={handleChange} style={input} />
          <button onClick={handleSave} style={btn}>Complete Setup</button>
        </>
      )}

      {message && <p style={{ color: 'red', marginTop: 16 }}>{message}</p>}
    </div>
  )
}

const card: any = { background: '#1a1a2e', border: '2px solid #333', borderRadius: 12, padding: 20, cursor: 'pointer', textAlign: 'center', color: 'white', transition: 'border-color 0.2s' }
const input = { display: 'block', width: '100%', marginBottom: 12, padding: 10, fontSize: 16, boxSizing: 'border-box' as const, borderRadius: 6, border: '1px solid #444', background: '#111', color: 'white' }
const btn = { width: '100%', padding: 12, background: '#f97316', color: 'white', border: 'none', fontSize: 16, cursor: 'pointer', borderRadius: 6, marginTop: 8 }