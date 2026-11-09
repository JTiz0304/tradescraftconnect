'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthSessionMissingError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function DashboardAccessGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)
  const [accessError, setAccessError] = useState(false)

  useEffect(() => {
    let active = true
    const check = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (!active) return
        if (!user && (!authError || isAuthSessionMissingError(authError))) { router.replace('/login'); return }
        if (authError || !user) { setAccessError(true); return }
        const { data: suspended, error } = await supabase.rpc('is_user_suspended')
        if (!active) return
        if (error || typeof suspended !== 'boolean') { setAccessError(true); return }
        if (suspended) { router.replace('/suspended'); return }
        setAllowed(true)
      } catch {
        if (active) setAccessError(true)
      }
    }
    void check()
    return () => { active = false }
  }, [router])

  if (accessError) return (
    <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-4 text-center text-gray-300">
      <p>We couldn’t verify your account access. Please try again.</p>
      <button onClick={() => window.location.reload()} className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white">Try again</button>
    </div>
  )
  if (!allowed) return <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-400">Checking account access…</div>
  return children
}

