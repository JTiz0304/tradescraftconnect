'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import NotificationBell from './NotificationBell'

type UserType = 'gc_builder' | 'business_owner' | 'professional' | 'apprentice'
type NavItem = { label: string; href: string }

export default function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const [userType, setUserType] = useState<UserType | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)

  const loadAccess = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: profile }, { data: adminAccess }, { count }] = await Promise.all([
      supabase.from('profiles').select('user_type').eq('id', user.id).single(),
      supabase.rpc('is_admin'),
      supabase.from('application_messages').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).is('read_at', null),
    ])
    setUserType((profile?.user_type as UserType | undefined) ?? null)
    setIsAdmin(Boolean(adminAccess))
    setUnreadMessages(count ?? 0)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAccess() }, 0)
    const poller = window.setInterval(() => { void loadAccess() }, 30000)
    return () => { window.clearTimeout(timer); window.clearInterval(poller) }
  }, [loadAccess])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setMobileOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const dashboardRoutes: Record<UserType, string> = {
    gc_builder: '/dashboard/gc-builder',
    business_owner: '/dashboard/business-owner',
    professional: '/dashboard/trades-professional',
    apprentice: '/dashboard/apprentice',
  }
  const dashboardHref = userType ? dashboardRoutes[userType] : '/dashboard'
  const roleItems: NavItem[] = userType === 'gc_builder'
    ? [
        { label: 'My Postings', href: '/dashboard/my-postings' },
        { label: 'Post a Job', href: '/dashboard/post-job' },
      ]
    : [
        { label: 'Find Jobs', href: '/dashboard/jobs' },
        { label: 'Applications', href: '/dashboard/my-applications' },
      ]
  const items: NavItem[] = [
    { label: 'Dashboard', href: dashboardHref },
    ...roleItems,
    { label: 'Messages', href: '/dashboard/messages' },
    { label: 'Directory', href: '/dashboard/directory' },
    { label: 'Profile', href: '/dashboard/edit-profile' },
    ...(isAdmin ? [{ label: 'Certification Review', href: '/dashboard/admin/certifications' }] : []),
  ]

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href={dashboardHref} className="shrink-0 text-lg font-black tracking-tight">
          TradesCraft<span className="text-orange-500">Connect</span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex" aria-label="Dashboard navigation">
          {items.map(item => (
            <NavLink key={`${item.label}-${item.href}`} item={item} pathname={pathname} unreadMessages={unreadMessages} />
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <NotificationBell />
          <button onClick={signOut} className="hidden rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-red-500 hover:text-white lg:block">Sign out</button>
          <div className="relative lg:hidden" ref={panelRef}>
            <button onClick={() => setMobileOpen(open => !open)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-700 bg-gray-900 text-xl" aria-label="Open navigation menu" aria-expanded={mobileOpen}>☰</button>
            {mobileOpen && (
              <div className="absolute right-0 mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
                <nav className="p-2" aria-label="Mobile dashboard navigation">
                  {items.map(item => (
                    <NavLink key={`${item.label}-${item.href}`} item={item} pathname={pathname} unreadMessages={unreadMessages} mobile onNavigate={() => setMobileOpen(false)} />
                  ))}
                  <button onClick={signOut} className="mt-1 w-full rounded-xl px-4 py-3 text-left text-sm text-red-400 transition hover:bg-gray-800">Sign out</button>
                </nav>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function NavLink({ item, pathname, unreadMessages, mobile = false, onNavigate }: { item: NavItem; pathname: string; unreadMessages: number; mobile?: boolean; onNavigate?: () => void }) {
  const dashboardRoute = item.label === 'Dashboard'
  const active = dashboardRoute ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
  return (
    <Link href={item.href} onClick={onNavigate} className={`${mobile ? 'flex w-full px-4 py-3' : 'inline-flex px-3 py-2'} items-center gap-2 rounded-xl text-sm transition ${active ? 'bg-orange-500/15 font-semibold text-orange-400' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`} aria-current={active ? 'page' : undefined}>
      <span>{item.label}</span>
      {item.label === 'Messages' && unreadMessages > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white">{unreadMessages > 9 ? '9+' : unreadMessages}</span>}
    </Link>
  )
}
