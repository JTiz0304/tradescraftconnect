'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Notification = {
  id: string
  title: string
  message: string
  link: string | null
  read_at: string | null
  created_at: string
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data } = await supabase
      .from('notifications')
      .select('id,title,message,link,read_at,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setNotifications(data ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const openNotification = async (notification: Notification) => {
    if (!notification.read_at) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notification.id)
    if (notification.link) router.push(notification.link)
  }

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const readAt = new Date().toISOString()
    await supabase.from('notifications').update({ read_at: readAt }).eq('user_id', user.id).is('read_at', null)
    setNotifications(current => current.map(item => ({ ...item, read_at: item.read_at ?? readAt })))
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-gray-400 mt-1">Updates about jobs, applications, hiring, and verification.</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="border border-gray-700 hover:border-orange-500 px-4 py-2 rounded-xl text-sm transition">← Dashboard</button>
        </div>

        {notifications.some(item => !item.read_at) && (
          <button onClick={markAllRead} className="text-sm text-orange-400 hover:text-orange-300 mb-4">Mark all as read</button>
        )}

        {loading ? (
          <p className="text-gray-400 animate-pulse">Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">🔔</p>
            <p className="font-semibold">You’re all caught up</p>
            <p className="text-sm text-gray-400 mt-1">New activity will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map(notification => (
              <button key={notification.id} onClick={() => openNotification(notification)} className={`text-left rounded-2xl border p-5 transition hover:border-orange-500 ${notification.read_at ? 'bg-gray-900 border-gray-800' : 'bg-orange-500/5 border-orange-500/30'}`}>
                <div className="flex gap-3">
                  <span className={`mt-2 w-2.5 h-2.5 rounded-full shrink-0 ${notification.read_at ? 'bg-gray-700' : 'bg-orange-500'}`} />
                  <div>
                    <p className="font-semibold">{notification.title}</p>
                    <p className="text-sm text-gray-400 mt-1">{notification.message}</p>
                    <p className="text-xs text-gray-600 mt-2">{new Date(notification.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
