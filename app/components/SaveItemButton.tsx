'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  kind: 'job' | 'profile'
  itemId: string
  className?: string
}

export default function SaveItemButton({ kind, itemId, className = '' }: Props) {
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const table = kind === 'job' ? 'saved_jobs' : 'saved_profiles'
      const column = kind === 'job' ? 'job_id' : 'profile_id'
      const { data } = await supabase.from(table).select('id').eq('user_id', user.id).eq(column, itemId).maybeSingle()
      setSaved(Boolean(data))
      setLoading(false)
    }
    void load()
  }, [itemId, kind])

  const toggle = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || loading) return
    setLoading(true)
    const table = kind === 'job' ? 'saved_jobs' : 'saved_profiles'
    const column = kind === 'job' ? 'job_id' : 'profile_id'
    if (saved) {
      const { error } = await supabase.from(table).delete().eq('user_id', user.id).eq(column, itemId)
      if (!error) setSaved(false)
    } else {
      const { error } = await supabase.from(table).insert({ user_id: user.id, [column]: itemId })
      if (!error) setSaved(true)
    }
    setLoading(false)
  }

  return (
    <button onClick={toggle} disabled={loading} className={`rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${saved ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-gray-700 text-gray-300 hover:border-orange-500'} ${className}`}>
      {saved ? '★ Saved' : '☆ Save'}
    </button>
  )
}
