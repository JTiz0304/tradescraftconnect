-- Apply after 011_safety_moderation_hardening.sql. The existing project predates
-- migration tracking and has permissive legacy policies/default function grants.
-- Reconcile those permissions without recreating tables or changing member data.
begin;

-- Anonymous callers must not read member profiles/emails or insert profiles.
-- Public avatar/portfolio object downloads remain intentionally public.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'job_postings', 'job_applications', 'portfolio_images',
    'certifications', 'admin_users', 'notifications', 'application_messages',
    'saved_jobs', 'saved_profiles', 'member_reports', 'member_suspensions',
    'email_notification_deliveries'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('revoke all on public.%I from public, anon', table_name);
      if table_name = 'email_notification_deliveries' then
        execute format('revoke all on public.%I from authenticated', table_name);
      end if;
    end if;
  end loop;
end;
$$;

-- Profiles are created by the Auth trigger; onboarding only updates that row.
-- Prevent bypassing the verification-update trigger with a direct INSERT.
revoke insert on public.profiles from authenticated;

-- Restrictive policies also constrain old permissive policies whose names vary
-- between the original project and the clean-install schema.
drop policy if exists "Hiring roles create jobs" on public.job_postings;
create policy "Hiring roles create jobs" on public.job_postings
as restrictive for insert to authenticated
with check (
  poster_id = (select auth.uid())
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and user_type in ('gc_builder', 'business_owner')
  )
);

drop policy if exists "Members read open or owned jobs" on public.job_postings;
create policy "Members read open or owned jobs" on public.job_postings
as restrictive for select to authenticated
using (status = 'open' or poster_id = (select auth.uid()));

drop policy if exists "Valid new applications only" on public.job_applications;
create policy "Valid new applications only" on public.job_applications
as restrictive for insert to authenticated
with check (
  applicant_id = (select auth.uid()) and status = 'new'
  and exists (
    select 1 from public.job_postings
    where id = job_id and status = 'open' and poster_id <> (select auth.uid())
  )
);

-- These owner actions exist in the app but were absent in the legacy policies.
drop policy if exists "Posters can delete their jobs" on public.job_postings;
create policy "Posters can delete their jobs" on public.job_postings
for delete to authenticated using (poster_id = (select auth.uid()));

drop policy if exists "Applicants can withdraw applications" on public.job_applications;
create policy "Applicants can withdraw applications" on public.job_applications
for delete to authenticated using (applicant_id = (select auth.uid()));

drop policy if exists "Verified certifications cannot be deleted by members" on public.certifications;
create policy "Verified certifications cannot be deleted by members" on public.certifications
as restrictive for delete to authenticated
using (user_id = (select auth.uid()) and verification_status <> 'verified');

-- Column grants alone do not narrow an existing table-wide UPDATE grant.
revoke update on public.job_applications from authenticated;
grant update (status) on public.job_applications to authenticated;
revoke update on public.application_messages from authenticated;
grant update (read_at) on public.application_messages to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Supabase default grants include anon/authenticated explicitly; revoking only
-- PUBLIC is insufficient. Trigger functions need no direct client execution.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_application_participant(uuid) to authenticated;
grant execute on function public.is_user_suspended(uuid) to authenticated;
grant execute on function public.review_certification(uuid, text, text) to authenticated;
grant execute on function public.review_member_report(uuid, text, text) to authenticated;
grant execute on function public.set_member_suspension(uuid, boolean, text, timestamptz) to authenticated;

alter function public.handle_new_user() set search_path = '';
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Bring existing storage upload limits into line with the original schema.
update storage.buckets set file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id in ('avatars', 'portfolios');
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'certifications';

commit;
