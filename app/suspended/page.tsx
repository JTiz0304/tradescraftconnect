'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function SuspendedPage() {
  const router = useRouter()
  const [reason, setReason] = useState('Your account is temporarily unavailable while it is reviewed.')
  const [expires, setExpires] = useState<string | null>(null)
  useEffect(() => { void (async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    const { data } = await supabase.from('member_suspensions').select('reason,expires_at,lifted_at').eq('user_id', user.id).maybeSingle()
    if (!data || data.lifted_at || (data.expires_at && new Date(data.expires_at) <= new Date())) { router.replace('/dashboard'); return }
    setReason(data.reason); setExpires(data.expires_at)
  })() }, [router])
  return <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4 text-white"><section className="w-full max-w-xl rounded-3xl border border-red-500/30 bg-gray-900 p-8 text-center"><p className="text-4xl">⚠️</p><h1 className="mt-4 text-3xl font-bold">Account Access Paused</h1><p className="mt-4 text-gray-300">{reason}</p>{expires && <p className="mt-2 text-sm text-gray-500">Scheduled review date: {new Date(expires).toLocaleDateString()}</p>}<p className="mt-6 text-sm text-gray-400">If you believe this was a mistake, contact TradesCraftConnect support. Do not create another account to bypass this review.</p><button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="mt-6 rounded-xl border border-gray-600 px-5 py-2.5">Sign out</button></section></main>
}
