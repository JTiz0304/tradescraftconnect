# Transactional email delivery and recovery

## Durable handoff

Business-table triggers enqueue the notification in the same database transaction
as the application, message, status change, credential decision or account-access
change. A failed queue insert rolls back the business write. The browser does not
send email requests. The former `/api/email-notifications` endpoint is an inert
202 compatibility response for already-open tabs.

`email_notification_deliveries` is private to the service role. New events retain
content snapshots, a recipient ID and an ordered queue number. Existing delivery
records are preserved; historical events are not backfilled. Genuine repeated
status/access changes get distinct event keys. Read receipts, unchanged statuses
and repeated restoration of an already-restored account create no new event.

The worker resolves a confirmed email address from Supabase Auth, never editable
profile email. Optional notices honor the preference both when queued and before
the first send. Account pause/restoration notices bypass optional-email opt-out.
Private message bodies, uploaded documents and administrator review notes are
not included in email snapshots.

## Worker and scheduler

`POST /api/email-notifications/process` requires the private worker bearer secret.
It claims at most ten items per request and stops claiming after 45 seconds;
Vercel's function maximum is 60 seconds. Each item has a five-minute lease and a
random claim token. Conditional updates prevent an obsolete worker completing a
reclaimed lease. Work is ordered per recipient; different recipients can proceed.

Supabase Cron wakes the worker every minute through pg_net, only when work is due.
The cron command contains no credential. A private function reads the worker URL
and secret from Vault and refuses any URL except the canonical production worker.
The setup revokes application roles' access to pg_net, including the transient
request headers. pg_net is only a wake-up mechanism: losing its unlogged request
queue does not lose business events in the durable delivery table.

The exact provider envelope is stored before contacting Resend. Recovery uses
that same envelope and the same idempotency key. Resend retains keys for 24 hours:
https://resend.com/docs/dashboard/emails/idempotency-keys
Automatic replay stops 23 hours after the **first provider attempt**, allowing
operator review before provider deduplication expires. Unattempted older backlog
can still send. Changing the configured sender or app URL does not change a
previously attempted envelope. Recipient changes after an uncertain attempt
require review rather than sending to a different address.

## Status and recovery

| Status | Meaning | Action |
| --- | --- | --- |
| queued | Durable event awaiting its first claim | Worker claims it when due. |
| pending | Leased work; provider result may be unknown | Expired leases recover with the original envelope/key. |
| failed | Transient provider or identity lookup failure | Automatic backoff from one to fifteen minutes. |
| sent | Provider acceptance and message ID recorded | Never automatically resend. Inbox delivery is a separate check. |
| skipped | Optional opt-out or no confirmed recipient before sending | Terminal; enabling email later does not replay it. |
| needs_review | Permanent error, expired safety window or changed recipient | Reconcile with the provider before making any retry decision. |

Legacy rows without `outbox_payload` are never automatically claimed or modified.
Never delete delivery records or clear frozen payloads to bypass deduplication.
For ambiguous acceptance, check the original idempotency key, recipient, first
attempt time and Resend logs. Record a confirmed provider ID as sent; do not resend
an accepted email. Do not automatically replay anything outside the safety window.

Operational checks as a database administrator, without selecting payloads or
Vault values:

```sql
select status, count(*), min(created_at) as oldest
from public.email_notification_deliveries
where outbox_payload is not null group by status;
select jobname, schedule, active from cron.job where jobname='tcc-email-worker';
select status_code, timed_out, created from net._http_response
order by created desc limit 10;
```

Review pending/failed backlog and `needs_review` daily during the pilot. Worker
HTTP responses and logs contain aggregate counts only. An increasing backlog,
repeated non-200 scheduler responses or unresolved review items blocks expansion.

## Reviewed rollout order — not yet applied

The current preview and production share one Supabase database. Do not apply the
queue migration merely to test a preview; it changes production event handling.
Use an isolated database for staging before broader rollout.

1. Review `supabase/migrations/20261111013842_durable_email_outbox.sql` and
   `supabase/setup/email_worker_scheduler.sql`. Obtain approval for this new
   production migration/infrastructure setup. Do not bulk-push older migrations;
   existing SQL Editor history is partially unreconciled.
2. Create a random server-only secret of at least 32 characters privately. Set
   production `EMAIL_WORKER_SECRET` and `EMAIL_APP_URL=https://www.tradescraftconnect.com`.
   Existing service-role, Resend and verified sender settings remain required.
   Do not expose or paste secret values into a PR, source file or chat.
3. In Supabase Vault, privately store the same secret as `tcc_email_worker_secret`
   and the exact URL `https://www.tradescraftconnect.com/api/email-notifications/process`
   as `tcc_email_worker_url`. Configuration checks should reveal presence only.
4. Apply only the reviewed additive outbox migration. This starts durable queueing;
   it makes no network requests. Old browser reservations conflict with queue keys.
5. Merge/deploy the reviewed worker and browser changes, then apply the separate
   scheduler setup as postgres. Confirm the protected worker is reachable through
   the production custom domain without a deployment-protection redirect.
6. Using the two designated owned test accounts, commit a new message, then close
   the sender browser. Confirm automatic inbox arrival and the canonical link;
   verify only one sent record/provider ID. Repeat in the opposite direction.
7. Confirm application status, credential approval/rejection and both access
   notices, optional opt-out/re-enable, repeat restoration with no duplicate,
   and two genuine pause/restore cycles. Confirm no failed/pending/review backlog.
   Verify confirmation/reset Auth emails separately; those use Supabase SMTP.
8. Check production logs, application permissions, mobile layout and cleanup of
   temporary files/credentials. Verify leaked-password protection before inviting
   outside users. Invite a small owned/contact pilot group and monitor feedback.

To pause outbound processing, unschedule `tcc-email-worker` or remove its worker
secret. Leave the outbox triggers and delivery records intact so new business
activity remains queued. Redeploy the last healthy **queue-compatible** worker to
recover. Do not roll back to browser-driven sending or delete the queue migration.

## Verification scope

Local checks exercise actual application queue SQL in embedded PostgreSQL,
including transaction rollback, ACLs, event snapshots and claim ordering. Worker
and route checks simulate Supabase/Resend boundaries, covering lost responses,
log-write failure, expiring leases, payload freezing, opt-out, confirmation and
HTTP authentication. Scheduler checks execute its wrapper and ACL SQL with
simulated Cron/Vault/HTTP extension boundaries. They do not replace the production
extension/secret setup or the final browser-close/inbox smoke test.

Earlier live checks verified both message directions, application/status mail,
opt-out/re-enable, credential rejection, duplicate restoration, and two account
pause/restore cycles on the browser-driven implementation. Those results do not
constitute live sign-off for the new queue worker. Automated browser testing was
unavailable in this environment; perform the final browser flow manually.
