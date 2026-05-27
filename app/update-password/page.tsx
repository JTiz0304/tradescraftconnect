'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleUpdate = async () => {
    if (password !== confirm) { setMessage('Passwords do not match.'); return }
    if (password.length < 6) { setMessage('Password must be at least 6 characters.'); return }

    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (error) { setMessage(error.message); return }
    router.push('/dashboard')
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 mb-3"

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">Set new password</h1>
        <p className="text-gray-400 text-center mb-8">Choose a strong password for your account</p>

        <input
          type="password"
          placeholder="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder="Confirm New Password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
          className={inputClass}
        />

        <button
          onClick={handleUpdate}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition mt-2"
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>

        {message && <p className="text-red-400 text-sm mt-3 text-center">{message}</p>}
      </div>
    </div>
  )
}