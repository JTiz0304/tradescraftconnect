'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type ThreadMessage = { id: string; sender_id: string; body: string; read_at: string | null; created_at: string }
type ThreadDetails = { jobTitle: string; otherName: string; applicationStatus: string; jobStatus: string }

export default function MessageThreadPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [details, setDetails] = useState<ThreadDetails | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async (currentUserId: string) => {
    const { data } = await supabase.from('application_messages').select('id, sender_id, body, read_at, created_at').eq('application_id', id).order('created_at')
    const rows = (data ?? []) as ThreadMessage[]
    setMessages(rows)
    const unreadIds = rows.filter(message => message.sender_id !== currentUserId && !message.read_at).map(message => message.id)
    if (unreadIds.length) await supabase.from('application_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
  }, [id])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: application } = await supabase
        .from('job_applications')
        .select('id, applicant_id, status, profiles!job_applications_applicant_id_fkey(full_name), job_postings(title, status, poster_id, profiles!job_postings_poster_id_fkey(full_name, company_name))')
        .eq('id', id).single()

      if (!application) { router.push('/dashboard/messages'); return }
      const app = application as unknown as { applicant_id: string; status: string; profiles: { full_name: string }; job_postings: { title: string; status: string; poster_id: string; profiles: { full_name: string; company_name: string } } }
      const isApplicant = app.applicant_id === user.id
      setDetails({
        jobTitle: app.job_postings.title,
        otherName: isApplicant ? (app.job_postings.profiles?.company_name || app.job_postings.profiles?.full_name || 'Employer') : (app.profiles?.full_name || 'Applicant'),
        applicationStatus: app.status,
        jobStatus: app.job_postings.status,
      })
      await loadMessages(user.id)
      setLoading(false)
    }
    void load()
  }, [id, loadMessages, router])

  useEffect(() => {
    if (!userId) return
    const poller = window.setInterval(() => { void loadMessages(userId) }, 5000)
    return () => window.clearInterval(poller)
  }, [loadMessages, userId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const cleanBody = body.trim()
    if (!cleanBody || cleanBody.length > 2000) return
    setSending(true); setError('')
    const { error: sendError } = await supabase.from('application_messages').insert({ application_id: id, sender_id: userId, recipient_id: userId, body: cleanBody })
    if (sendError) setError(sendError.message.includes('closed') ? 'Messaging is closed for this application.' : 'Your message did not send. Please try again.')
    else { setBody(''); await loadMessages(userId) }
    setSending(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white"><p className="animate-pulse text-gray-400">Loading conversation...</p></div>
  const closed = details?.applicationStatus === 'declined' || details?.jobStatus !== 'open'

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.push('/dashboard/messages')} className="text-sm text-gray-400 hover:text-white mb-5">Back to Messages</button>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-800"><h1 className="text-xl font-bold">{details?.otherName}</h1><p className="text-sm text-gray-400 mt-1">Regarding {details?.jobTitle}</p></div>
          <div className="h-[52vh] overflow-y-auto p-5 flex flex-col gap-3">
            {messages.length === 0 && <div className="text-center text-gray-500 my-auto"><p className="text-3xl mb-2">💬</p><p>Start the conversation about this application.</p></div>}
            {messages.map(message => {
              const mine = message.sender_id === userId
              return <div key={message.id} className={`max-w-[82%] ${mine ? 'self-end' : 'self-start'}`}><div className={`rounded-2xl px-4 py-3 ${mine ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-100'}`}><p className="whitespace-pre-wrap break-words">{message.body}</p></div><p className={`text-[11px] text-gray-600 mt-1 ${mine ? 'text-right' : ''}`}>{new Date(message.created_at).toLocaleString()}</p></div>
            })}
            <div ref={bottomRef} />
          </div>
          <div className="p-4 border-t border-gray-800">
            {closed ? <p className="text-sm text-gray-400 text-center py-2">This conversation is read-only because the job is closed or the application was declined.</p> : (
              <form onSubmit={sendMessage} className="flex gap-3 items-end">
                <div className="flex-1"><textarea value={body} onChange={event => setBody(event.target.value)} maxLength={2000} rows={2} placeholder="Write a message..." className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-orange-500" />{error && <p className="text-red-400 text-xs mt-1">{error}</p>}</div>
                <button type="submit" disabled={sending || !body.trim()} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 font-semibold px-5 py-3 rounded-xl">{sending ? 'Sending...' : 'Send'}</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
