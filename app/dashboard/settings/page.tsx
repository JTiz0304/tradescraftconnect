'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function SettingsPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setEmail(user.email ?? '')
    }
    void load()
  }, [router])

  const sendReset = async () => {
    setSending(true); setMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/update-password` })
    setSending(false)
    setMessage(error ? error.message : 'Password reset email sent. Check your inbox.')
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="mt-1 text-gray-400">Manage your login and account security.</p>
        <section className="mt-7 rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
          <p className="text-xs uppercase tracking-wide text-gray-500">Sign-in email</p>
          <p className="mt-1 font-medium">{email || 'Loading...'}</p>
          <div className="mt-6 border-t border-gray-800 pt-6">
            <h2 className="font-semibold">Change your password</h2>
            <p className="mt-1 text-sm text-gray-400">We’ll email you a secure link to choose a new password.</p>
            <button onClick={sendReset} disabled={sending || !email} className="mt-4 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">{sending ? 'Sending...' : 'Send Password Reset Email'}</button>
            {message && <p className={`mt-3 text-sm ${message.startsWith('Password reset') ? 'text-green-400' : 'text-red-400'}`}>{message}</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
