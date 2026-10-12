import type { ReactNode } from 'react'
import DashboardNav from '../components/DashboardNav'
import DashboardAccessGuard from '../components/DashboardAccessGuard'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardAccessGuard>
      <div className="min-h-screen bg-gray-950">
        <DashboardNav />
        {children}
      </div>
    </DashboardAccessGuard>
  )
}
