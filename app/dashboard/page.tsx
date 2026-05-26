'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function DashboardRouter() {
  const router = useRouter()

  useEffect(() => {
    const redirect = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single()

      if (!profile?.user_type) { router.push('/onboarding'); return }

      const routes: Record<string, string> = {
        gc_builder: '/dashboard/gc-builder',
        business_owner: '/dashboard/business-owner',
        professional: '/dashboard/professional',
        apprentice: '/dashboard/apprentice',
      }

      router.push(routes[profile.user_type] ?? '/onboarding')
    }

    redirect()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <p className="text-gray-400 animate-pulse">Loading your dashboard...</p>
    </div>
  )
}