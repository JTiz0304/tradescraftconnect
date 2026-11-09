import { supabase } from './supabase'

export type EmailEventType =
  | 'new_application'
  | 'application_status'
  | 'application_message'
  | 'certification_review'
  | 'account_suspension'

export async function sendEmailNotification(eventType: EmailEventType, relatedId: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const response = await fetch('/api/email-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ eventType, relatedId }),
    })

    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null
      console.error('Email notification failed:', result?.error ?? response.statusText)
    }
  } catch (error) {
    console.error('Email notification failed:', error)
  }
}
