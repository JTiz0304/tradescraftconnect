# Supabase setup

The application expects a Supabase project with the tables, triggers, row-level
security policies, and storage buckets defined in:

`supabase/migrations/001_initial_schema.sql`

## Initial setup

1. Wait until the Supabase project status shows that it is ready.
2. Open **SQL Editor** in Supabase and create a new query.
3. Paste the full contents of `001_initial_schema.sql`.
4. Run the query once.
5. In **Authentication > URL Configuration**, set:
   - Site URL: `https://www.tradescraftconnect.com`
   - Redirect URL: `https://www.tradescraftconnect.com/update-password`
6. Add these environment variables to the Vercel project:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only; never prefix with `NEXT_PUBLIC_`)
   - `RESEND_API_KEY`
   - `EMAIL_FROM` (for example, `TradesCraftConnect <notifications@tradescraftconnect.com>`)

## Existing TradesCraftConnect project

Do not run the initial schema again on the existing production database. Apply
only the newer numbered migrations in order:

1. Apply each numbered migration after `001_initial_schema.sql` in order.

Migration 010 adds the transactional-email preference and a private delivery
log used to prevent duplicate sends.

Existing SQL Editor changes may not appear in migration history. Inspect the
actual schema before applying 010 or any older migration. The live audit found
the delivery table and preference column already present.

Run `npm run test:email`, `npm run lint`, and `npx tsc --noEmit` before review.
The email tests mock Supabase and Resend and never send real emails. See
`EMAIL_DELIVERY_RUNBOOK.md` for retry/reconciliation behavior and live checks.

Never expose the Supabase service-role key in browser code or commit it to this
repository.

## Safety and moderation follow-up

After migrations 001–009 are installed, apply
`supabase/migrations/20261109165921_safety_moderation_hardening.sql`. Migration 010 is
reserved for the separate email-notifications PR; the safety migration does not depend on it.
Do not edit or rerun the original schema on an existing project.

The safety migration makes reports and admin notes readable only by administrators,
validates report targets, restricts submission columns, and blocks suspended
members through restrictive RLS policies on member data and storage operations.
Suspended members retain read access to their own suspension reason. Public
avatar/portfolio URLs remain public; suspension does not revoke public files.

Next apply `supabase/migrations/20261109170012_reconcile_legacy_permissions.sql`.
The existing deployment has older policies and explicit Supabase default grants
that differ from a clean installation. This follow-up revokes anonymous member
data access, narrows update privileges, restricts job posting to hiring roles,
protects new application status and verified credentials, and removes direct
execution access to trigger-only functions. It also sets the existing signup
trigger's search path and brings upload limits into line with the schema.

The two source filenames match the versions recorded by Supabase when applied
to production on November 9, 2026. Both are installed in the existing project.
Seventeen live database checks passed inside a rolled-back transaction, including
report privacy, application/message permissions, suspension and restore. Existing
account, profile, job, application, report and suspension counts were unchanged.

An empty or partial migration-history list does not mean older feature tables
are missing: the original project was updated through SQL Editor. Inspect its
actual schema before applying older migrations. Never rerun 001 to reconcile
this project, and do not bulk-push legacy migrations until its baseline history
has been reconciled.

Run `npm run test:safety`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`
before review. The safety tests use disposable embedded PostgreSQL with simulated
Supabase auth/storage schemas and mocked frontend handlers, never a live project.
The database suite overlays synthetic reproductions of legacy access patterns before
the two hardening migrations, covering both old permissive policies and default
grants rather than relying only on a clean-install schema.

For preview sign-off, confirm the Vercel preview points at the intended Supabase
test project, then apply the missing safety migrations above. Use one administrator (already in
`public.admin_users`) and two disposable members to verify:

1. Signup requires the policy checkbox and records the policy version/timestamp.
2. Both job and profile reports reach the admin queue; members cannot read reports
   or administrator notes, forge review fields, or change report ownership.
3. Review/resolve/dismiss preserve existing notes; explicitly clearing a note works.
4. A 30-day suspension blocks dashboard access and direct database reads/writes,
   including profile edits, job posts, applications, messages, and private uploads.
5. The suspended member can read their reason; another member cannot query their
   suspension status. Non-admins cannot review, suspend, or restore anyone.
6. Restore and expiry permit access again, including with an already-issued session.

Missing migration/RPC errors must show the access-check retry screen, without
rendering the dashboard. Local tests do not replace live preview sign-off.
