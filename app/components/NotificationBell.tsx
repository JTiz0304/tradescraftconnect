'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type Notification = {
  id: string
  title: string
  message: string
  link: string | null
  read_at: string | null
  created_at: string
}

export default function NotificationBell() {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  const loadNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('notifications')
      .select('id,title,message,link,read_at,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6)

    setNotifications(data ?? [])
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadNotifications() }, 0)
    const poller = window.setInterval(() => { void loadNotifications() }, 30000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(poller)
    }
  }, [loadNotifications])

  useEffect(() => {
    const closePanel = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closePanel)
    return () => document.removeEventListener('mousedown', closePanel)
  }, [])

  const unreadCount = notifications.filter(item => !item.read_at).length

  const openNotification = async (notification: Notification) => {
    if (!notification.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notification.id)
      setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item))
    }
    setOpen(false)
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
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(current => !current); void loadNotifications() }}
        className="relative w-11 h-11 rounded-xl border border-gray-700 bg-gray-900 hover:border-orange-500 transition flex items-center justify-center"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
      >
        <span className="text-xl" aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-orange-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[min(22rem,calc(100vw-2rem))] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div>
              <p className="font-semibold">Notifications</p>
              <p className="text-xs text-gray-500">{unreadCount} unread</p>
            </div>
            {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-orange-400 hover:text-orange-300">Mark all read</button>}
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-2xl mb-2">🔔</p>
              <p className="text-sm text-gray-400">No notifications yet.</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map(notification => (
                <button
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-800 transition ${notification.read_at ? '' : 'bg-orange-500/5'}`}
                >
                  <div className="flex gap-3">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${notification.read_at ? 'bg-gray-700' : 'bg-orange-500'}`} />
                    <div>
                      <p className="text-sm font-semibold text-white">{notification.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{notification.message}</p>
                      <p className="text-[11px] text-gray-600 mt-1">{formatNotificationDate(notification.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <button onClick={() => { setOpen(false); router.push('/dashboard/notifications') }} className="w-full py-3 text-sm text-orange-400 hover:bg-gray-800 transition">
            View all notifications
          </button>
        </div>
      )}
    </div>
  )
}

function formatNotificationDate(value: string) {
  const date = new Date(value)
  const elapsedMinutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (elapsedMinutes < 1) return 'Just now'
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`
  if (elapsedMinutes < 1440) return `${Math.floor(elapsedMinutes / 60)}h ago`
  return date.toLocaleDateString()
}
