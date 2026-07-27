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
