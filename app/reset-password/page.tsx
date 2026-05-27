'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.tradescraftconnect.com/update-password',
    })

    setLoading(false)
    if (error) { setMessage(error.message); return }
    setSent(true)
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 mb-3"

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {sent ? (
          <div className="text-center">
            <p className="text-4xl mb-4">📬</p>
            <h1 className="text-2xl font-bold mb-2">Check your email</h1>
            <p className="text-gray-400">We sent a password reset link to <span className="text-white">{email}</span>. Click the link in the email to set a new password.</p>
            <a href="/login" className="mt-6 inline-block text-orange-400 hover:text-orange-300 text-sm transition">
              Back to Log In
            </a>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-center mb-2">Reset your password</h1>
            <p className="text-gray-400 text-center mb-8">Enter your email and we'll send you a reset link</p>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleReset()}
              className={inputClass}
            />

            <button
              onClick={handleReset}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition mt-2"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            {message && <p className="text-red-400 text-sm mt-3 text-center">{message}</p>}

            <p className="text-gray-500 text-sm text-center mt-6">
              <a href="/login" className="text-orange-400 hover:text-orange-300 transition">Back to Log In</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}