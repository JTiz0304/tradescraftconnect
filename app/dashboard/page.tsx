'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [trade, setTrade] = useState('')
  const [location, setLocation] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      setFullName(data?.full_name || '')
      setTrade(data?.trade || '')
      setLocation(data?.location || '')
      setLoading(false)
    }
    getProfile()
  }, [])

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      trade,
      location,
    }).eq('id', user!.id)
    if (error) { setMessage(error.message); return }
    setProfile({ ...profile, full_name: fullName, trade, location })
    setEditing(false)
    setMessage('Profile updated!')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) return <p style={{ padding: 40 }}>Loading...</p>

  return (
    <div style={{ maxWidth: 600, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Welcome back! 👋</h1>
        <button onClick={handleLogout} style={btnOutline}>Log Out</button>
      </div>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Your Profile</h2>
          <button onClick={() => setEditing(!editing)} style={btnOutline}>{editing ? 'Cancel' : 'Edit'}</button>
        </div>
        {editing ? (
          <>
            <input placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} style={input} />
            <input placeholder="Trade (e.g. Plumber)" value={trade} onChange={e => setTrade(e.target.value)} style={input} />
            <input placeholder="Location (e.g. Brisbane)" value={location} onChange={e => setLocation(e.target.value)} style={input} />
            <button onClick={handleSave} style={btn}>Save Changes</button>
          </>
        ) : (
          <>
            <p><strong>Email:</strong> {profile?.email}</p>
            <p><strong>Name:</strong> {profile?.full_name || 'Not set'}</p>
            <p><strong>Trade:</strong> {profile?.trade || 'Not set'}</p>
            <p><strong>Location:</strong> {profile?.location || 'Not set'}</p>
          </>
        )}
        {message && <p style={{ color: '#f97316', marginTop: 12 }}>{message}</p>}
      </div>
    </div>
  )
}

const card = { background: '#1a1a2e', padding: 24, borderRadius: 8, marginTop: 24 }
const input = { display: 'block', width: '100%', marginBottom: 12, padding: 10, fontSize: 16, boxSizing: 'border-box' as const }
const btn = { width: '100%', padding: 12, background: '#f97316', color: 'white', border: 'none', fontSize: 16, cursor: 'pointer', borderRadius: 6 }
const btnOutline = { padding: '8px 16px', border: '2px solid #f97316', color: '#f97316', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontSize: 14 }