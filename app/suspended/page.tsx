'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthSessionMissingError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function SuspendedPage() {
  const router = useRouter()
  const [reason, setReason] = useState('Your account is temporarily unavailable while it is reviewed.')
  const [expires, setExpires] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [checkError, setCheckError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const checkAccess = async () => {
      setChecking(true)
      setCheckError('')
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (!active) return
        if (!user && (!authError || isAuthSessionMissingError(authError))) { router.replace('/login'); return }
        if (authError || !user) { setCheckError('We couldn’t verify your account access. Please try again.'); return }
        const { data: suspended, error } = await supabase.rpc('is_user_suspended')
        if (!active) return
        if (error || typeof suspended !== 'boolean') { setCheckError('We couldn’t verify your account access. Please try again.'); return }
        if (!suspended) { router.replace('/dashboard'); return }
        const { data, error: reasonError } = await supabase.from('member_suspensions').select('reason,expires_at').eq('user_id', user.id).maybeSingle()
        if (!active) return
        if (reasonError) { setCheckError('Your account is paused, but its details could not be loaded. Please try again.'); return }
        setReason(data?.reason || 'Your account is temporarily unavailable while it is reviewed.')
        setExpires(data?.expires_at ?? null)
      } catch {
        if (active) setCheckError('We couldn’t verify your account access. Please try again.')
      } finally {
        if (active) setChecking(false)
      }
    }
    const timer = window.setTimeout(() => { void checkAccess() }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [router, attempt])

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-red-500/30 bg-gray-900 p-8 text-center" aria-busy={checking}>
        <p aria-hidden="true" className="text-4xl">⚠️</p>
        <h1 className="mt-4 text-3xl font-bold">{checking ? 'Checking account access…' : checkError ? 'Account access check unavailable' : 'Account Access Paused'}</h1>
        {checkError ? <p role="alert" className="mt-4 text-red-300">{checkError}</p> : !checking && (
          <>
            <p className="mt-4 text-gray-300">{reason}</p>
            {expires && <p className="mt-2 text-sm text-gray-400">Scheduled review date: {new Date(expires).toLocaleDateString()}</p>}
          </>
        )}
        <p className="mt-6 text-sm text-gray-400">If you believe this was a mistake, contact TradesCraftConnect support. Do not create another account to bypass this review.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button disabled={checking} onClick={() => setAttempt(current => current + 1)} className="rounded-xl bg-orange-500 px-5 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300 disabled:opacity-50">{checking ? 'Checking…' : 'Check access again'}</button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="rounded-xl border border-gray-600 px-5 py-3">Sign out</button>
        </div>
      </section>
    </main>
  )
}
