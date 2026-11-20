import { NextResponse } from 'next/server'

// Compatibility for already-open tabs. The database mutation enqueues mail;
// this endpoint cannot create, change, or send an event supplied by a browser.
export async function POST() {
  return NextResponse.json({ queuedByBusinessEvent: true }, { status: 202 })
}
