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
   - `RESEND_API_KEY` (only needed for application email notifications)

## Existing TradesCraftConnect project

Do not run the initial schema again on the existing production database. Apply
only the newer numbered migrations in order:

1. `supabase/migrations/002_profile_verification.sql`

Migration 002 adds profile-completion fields, protects license verification
status from member self-approval, and allows authenticated members to see
verified certification metadata.

Never expose the Supabase service-role key in browser code or commit it to this
repository.

## Safety and moderation follow-up

After migrations 001–009 are installed, apply
`supabase/migrations/011_safety_moderation_hardening.sql`. Migration 010 is
reserved for the separate email-notifications PR; 011 does not depend on it.
Do not edit or rerun the original schema on an existing project.

Migration 011 makes reports and admin notes readable only by administrators,
validates report targets, restricts submission columns, and blocks suspended
members through restrictive RLS policies on member data and storage operations.
Suspended members retain read access to their own suspension reason. Public
avatar/portfolio URLs remain public; suspension does not revoke public files.

Next apply `supabase/migrations/20261109141000_reconcile_legacy_permissions.sql`.
The existing deployment has older policies and explicit Supabase default grants
that differ from a clean installation. This follow-up revokes anonymous member
data access, narrows update privileges, restricts job posting to hiring roles,
protects new application status and verified credentials, and removes direct
execution access to trigger-only functions. It also sets the existing signup
trigger's search path and brings upload limits into line with the schema.

An empty migration-history list does not mean these feature tables are missing:
the original project was updated through SQL Editor. Inspect its actual schema
before applying any older migrations. Never rerun 001 to reconcile this project.

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
