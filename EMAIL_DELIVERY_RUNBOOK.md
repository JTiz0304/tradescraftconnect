# Transactional email verification and recovery

The endpoint verifies the caller and their suspension status before service-role
reads. Recipients come from the stored application/message/review records, never
from request-supplied addresses. Safety notices bypass optional-email preferences.

Each event/recipient pair has one delivery record. An INSERT reserves the sender
atomically; only a failed record can be claimed again using a conditional update.
Concurrent or already-pending requests do not call the provider again. Sent records
remain duplicates indefinitely. Every provider attempt also uses the same Resend
idempotency key for that event/recipient pair.

Resend keeps idempotency keys for 24 hours:
https://resend.com/docs/dashboard/emails/idempotency-keys
This endpoint permits failed-record retries only within 23 hours of creation.

## Status handling

- `sent`: provider acceptance was recorded. A repeated request returns success
  with `duplicate: true` and does not send another email.
- `failed`: the provider returned an error. A recent retry must atomically claim
  the record before sending with the original idempotency key.
- `pending`: another request may still be sending, a response may have been lost,
  or provider acceptance may not have been logged. A repeated request returns 202
  and does not blindly resend. Inspect Resend and reconcile the record first.
- Failed records older than 23 hours return 409 for administrator review.

When reconciling, check the event, recipient, creation time, provider message ID
and provider idempotency key. If Resend accepted the email, record the accepted
provider message ID and mark it sent; do not resend. Confirm a delivery was not
accepted before considering a retry. Do not delete delivery records to bypass
duplicate protection.

## Live sign-off

Use a separate test database and designated test inboxes. Verify both message
directions, application status notices, credential decisions, suspension and
multiple restoration events, opt-out, and duplicate requests. Check actual inbox
delivery and links as well as provider acceptance. Confirm the sender domain and
the Supabase Auth confirmation/reset email configuration separately.

The browser still initiates the notification request after the business event.
If the browser closes before making that request, there is no guaranteed email
handoff. A durable outbox/worker is a separate general-launch requirement; this
change improves safe sending and recovery but does not add that worker.
