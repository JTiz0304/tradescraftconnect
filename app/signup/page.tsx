'use client'

import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setMessage(error.message); return }
    setMessage('Check your email to confirm your account, then come back and log in!')
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Create your account</h1>
      <p style={{ color: '#888' }}>Just email and password to get started</p>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={input} />
      <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={input} />
      <button onClick={handleSignUp} style={btn}>Sign Up</button>
      {message && <p style={{ marginTop: 16, color: '#f97316' }}>{message}</p>}
      <p style={{ marginTop: 16 }}>Already have an account? <a href="/login">Log in</a></p>
    </div>
  )
}

const input = { display: 'block', width: '100%', marginBottom: 12, padding: 10, fontSize: 16, boxSizing: 'border-box' as const }
const btn = { width: '100%', padding: 12, background: '#f97316', color: 'white', border: 'none', fontSize: 16, cursor: 'pointer', borderRadius: 6 }