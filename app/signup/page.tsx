'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async () => {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signUp({ email, password })

    setLoading(false)
    if (error) { setMessage(error.message); return }
    router.push('/onboarding')
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 mb-3"

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">Create your account</h1>
        <p className="text-gray-400 text-center mb-8">Join TradesCraftConnect to get started</p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />

        <button
          onClick={handleSignup}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition mt-2"
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>

        {message && <p className="text-red-400 text-sm mt-3 text-center">{message}</p>}

        <p className="text-gray-500 text-sm text-center mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-orange-400 hover:text-orange-300 transition">Log in</a>
        </p>
      </div>
    </div>
  )
}