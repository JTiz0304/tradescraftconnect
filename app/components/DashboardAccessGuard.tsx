'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function DashboardAccessGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: suspended } = await supabase.rpc('is_user_suspended')
      if (suspended) { router.replace('/suspended'); return }
      setAllowed(true)
    }
    void check()
  }, [router])

  if (!allowed) return <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-400">Checking account access…</div>
  return children
}

