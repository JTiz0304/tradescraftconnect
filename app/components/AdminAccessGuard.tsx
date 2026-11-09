'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { isAuthSessionMissingError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function AdminAccessGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied' | 'error'>('checking')

  useEffect(() => {
    let active = true
    const checkAdminAccess = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (!active) return
        if (!user && (!authError || isAuthSessionMissingError(authError))) { router.replace('/login'); return }
        if (authError || !user) { setAccess('error'); return }
        const { data: admin, error } = await supabase.rpc('is_admin')
        if (!active) return
        if (error || typeof admin !== 'boolean') { setAccess('error'); return }
        setAccess(admin ? 'allowed' : 'denied')
      } catch {
        if (active) setAccess('error')
      }
    }
    void checkAdminAccess()
    return () => { active = false }
  }, [router])

  if (access === 'allowed') return children

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-gray-700 bg-gray-900 p-8 text-center">
        {access === 'checking' ? <p role="status" className="text-gray-300">Checking administrator access…</p> : (
          <>
            <h1 className="text-2xl font-bold">{access === 'denied' ? 'Administrator access required' : 'Could not verify administrator access'}</h1>
            <p role="alert" className="mt-3 text-gray-300">{access === 'denied' ? 'This page is available only to platform administrators.' : 'Please try checking your access again.'}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {access === 'error' && <button onClick={() => window.location.reload()} className="rounded-xl bg-orange-500 px-5 py-3 font-semibold">Try again</button>}
              <Link href="/dashboard" className="rounded-xl border border-gray-600 px-5 py-3">Return to dashboard</Link>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
