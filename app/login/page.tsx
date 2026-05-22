'use client'

import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setMessage(error.message); return }
    
    // Check if user has completed onboarding
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user!.id).single()
    
    if (profile?.user_type) {
      window.location.href = '/dashboard'
    } else {
      window.location.href = '/onboarding'
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Login</h1>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={input} />
      <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={input} />
      <button onClick={handleLogin} style={btn}>Log In</button>
      {message && <p>{message}</p>}
      <p style={{ marginTop: 16 }}>Don't have an account? <a href="/signup">Sign up</a></p>
    </div>
  )
}

const input = { display: 'block', width: '100%', marginBottom: 12, padding: 10, fontSize: 16, boxSizing: 'border-box' as const }
const btn = { width: '100%', padding: 12, background: '#f97316', color: 'white', border: 'none', fontSize: 16, cursor: 'pointer', borderRadius: 6 }