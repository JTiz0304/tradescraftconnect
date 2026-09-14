'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Conversation = {
  applicationId: string
  jobTitle: string
  personName: string
  status: string
  lastMessage: string
  lastMessageAt: string
  unread: number
}

type ApplicationRow = {
  id: string
  applicant_id: string
  status: string
  job_postings: { id: string; title: string; poster_id: string }
  profiles: { full_name: string }
}

type MessageRow = {
  application_id: string
  recipient_id: string
  body: string
  created_at: string
  read_at: string | null
}

export default function MessagesPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: ownJobs } = await supabase.from('job_postings').select('id').eq('poster_id', user.id)
      const ownedJobIds = (ownJobs ?? []).map(job => job.id)

      const applicantQuery = supabase
        .from('job_applications')
        .select('id, applicant_id, status, job_postings(id, title, poster_id), profiles!job_applications_applicant_id_fkey(full_name)')
        .eq('applicant_id', user.id)

      const employerQuery = ownedJobIds.length
        ? supabase
            .from('job_applications')
            .select('id, applicant_id, status, job_postings(id, title, poster_id), profiles!job_applications_applicant_id_fkey(full_name)')
            .in('job_id', ownedJobIds)
        : Promise.resolve({ data: [] })

      const [{ data: applicantRows }, { data: employerRows }] = await Promise.all([applicantQuery, employerQuery])
      const rows = [...(applicantRows ?? []), ...(employerRows ?? [])] as unknown as ApplicationRow[]
      const uniqueRows = Array.from(new Map(rows.map(row => [row.id, row])).values())

      if (!uniqueRows.length) { setLoading(false); return }

      const { data: messages } = await supabase
        .from('application_messages')
        .select('application_id, recipient_id, body, created_at, read_at')
        .in('application_id', uniqueRows.map(row => row.id))
        .order('created_at', { ascending: false })

      const messageRows = (messages ?? []) as MessageRow[]
      setConversations(uniqueRows.map(row => {
        const thread = messageRows.filter(message => message.application_id === row.id)
        const last = thread[0]
        const isApplicant = row.applicant_id === user.id
        return {
          applicationId: row.id,
          jobTitle: row.job_postings.title,
          personName: isApplicant ? 'Employer' : (row.profiles?.full_name ?? 'Applicant'),
          status: row.status,
          lastMessage: last?.body ?? 'No messages yet',
          lastMessageAt: last?.created_at ?? '',
          unread: thread.filter(message => message.recipient_id === user.id && !message.read_at).length,
        }
      }).filter(item => item.lastMessageAt).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)))
      setLoading(false)
    }
    void load()
  }, [router])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white"><p className="animate-pulse text-gray-400">Loading messages...</p></div>

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8 gap-4">
          <div><h1 className="text-3xl font-bold">Messages</h1><p className="text-gray-400 mt-1">Private conversations about job applications</p></div>
          <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-400 border border-gray-700 px-4 py-2 rounded-xl hover:text-white">Dashboard</button>
        </div>
        {conversations.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-4">💬</p><p className="font-semibold text-lg">No conversations yet</p>
            <p className="text-gray-400 mt-1">Messages with employers and applicants will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {conversations.map(item => (
              <button key={item.applicationId} onClick={() => router.push(`/dashboard/messages/${item.applicationId}`)} className="text-left bg-gray-900 border border-gray-800 hover:border-orange-500 rounded-2xl p-5 transition">
                <div className="flex justify-between gap-4">
                  <div className="min-w-0"><p className="font-semibold">{item.personName} · {item.jobTitle}</p><p className="text-sm text-gray-400 mt-1 truncate">{item.lastMessage}</p><p className="text-xs text-gray-600 mt-2">{new Date(item.lastMessageAt).toLocaleString()} · {item.status}</p></div>
                  {item.unread > 0 && <span className="bg-orange-500 text-white text-xs font-bold rounded-full min-w-6 h-6 px-2 flex items-center justify-center">{item.unread}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
