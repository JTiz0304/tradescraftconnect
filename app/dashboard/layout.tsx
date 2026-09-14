import type { ReactNode } from 'react'
import DashboardNav from '../components/DashboardNav'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <DashboardNav />
      {children}
    </div>
  )
}
