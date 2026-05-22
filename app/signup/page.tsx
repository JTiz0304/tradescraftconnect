'use client'

import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [trade, setTrade] = useState('')
  const [location, setLocation] = useState('')
  const [message, setMessage] = useState('')

  const handleSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setMessage(error.message); return }
    const user = data.user
    if (user) {
      await supabase.from('profiles').insert({
        id: user.id,
        email,
        full_name: fullName,
        trade,
        location,
      })
    }
    setMessage('Check your email to confirm your account!')
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Create your account</h1>
      <input placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} style={input} />
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={input} />
      <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={input} />
      <input placeholder="Trade (e.g. Plumber)" value={trade} onChange={e => setTrade(e.target.value)} style={input} />
      <input placeholder="Location (e.g. Brisbane)" value={location} onChange={e => setLocation(e.target.value)} style={input} />
      <button onClick={handleSignUp} style={btn}>Sign Up</button>
      {message && <p>{message}</p>}
    </div>
  )
}

const input = { display: 'block', width: '100%', marginBottom: 12, padding: 10, fontSize: 16, boxSizing: 'border-box' as const }
const btn = { width: '100%', padding: 12, background: '#f97316', color: 'white', border: 'none', fontSize: 16, cursor: 'pointer', borderRadius: 6 }