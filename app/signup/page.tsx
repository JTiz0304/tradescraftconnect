'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const handleSignup = async () => {
    if (!accepted) { setMessage('Please accept the Terms and Privacy Policy to continue.'); return }
    setLoading(true)
    setMessage('')
    setSuccess(false)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          terms_accepted_at: new Date().toISOString(),
          terms_version: '2026-10-12',
        },
      },
    })

    setLoading(false)
    if (error) { setMessage(error.message); return }
    if (!data.session) {
      setSuccess(true)
      setMessage('Check your email to confirm your account, then log in to finish your profile.')
      return
    }
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
          name="email"
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          aria-label="Password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />

        <label className="mb-3 flex items-start gap-3 text-sm text-gray-400"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-orange-500" /><span>I agree to the <Link href="/terms" className="text-orange-400 hover:text-orange-300">Terms of Service</Link>, <Link href="/privacy" className="text-orange-400 hover:text-orange-300">Privacy Policy</Link>, and <Link href="/community-standards" className="text-orange-400 hover:text-orange-300">Community Standards</Link>.</span></label>

        <button
          onClick={handleSignup}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition mt-2"
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>

        {message && (
          <p className={`${success ? 'text-green-400' : 'text-red-400'} text-sm mt-3 text-center`}>
            {message}
          </p>
        )}

        <p className="text-gray-500 text-sm text-center mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-orange-400 hover:text-orange-300 transition">Log in</a>
        </p>
      </div>
    </div>
  )
}
