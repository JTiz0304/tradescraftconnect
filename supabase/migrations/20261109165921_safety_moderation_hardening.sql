-- Apply after 009_safety_and_moderation.sql. Migration 010 belongs to the
-- independent email-notifications workflow and is not a prerequisite here.
begin;

create or replace function public.is_user_suspended(check_user uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if check_user is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  return exists (
    select 1 from public.member_suspensions
    where user_id = check_user
      and lifted_at is null
      and (expires_at is null or expires_at > now())
  );
end;
$$;

revoke all on function public.is_user_suspended(uuid) from public, anon;
grant execute on function public.is_user_suspended(uuid) to authenticated;

-- A restrictive policy is ANDed with existing permissive policies. A new
-- permissive policy alone would not block any existing member permissions.
-- Keep member_suspensions readable so a paused member can see their reason.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'job_postings', 'job_applications', 'portfolio_images',
    'certifications', 'admin_users', 'notifications', 'application_messages',
    'saved_jobs', 'saved_profiles', 'member_reports'
  ] loop
    execute format('drop policy if exists "Active members only" on public.%I', table_name);
    execute format(
      'create policy "Active members only" on public.%I as restrictive for all to authenticated
       using (not (select public.is_user_suspended()))
       with check (not (select public.is_user_suspended()))', table_name
    );
  end loop;
end;
$$;

drop policy if exists "Active members only" on storage.objects;
create policy "Active members only" on storage.objects
as restrictive for all to authenticated
using (not (select public.is_user_suspended()))
with check (not (select public.is_user_suspended()));

-- The reporting form inserts without requesting a row back. Members have no
-- report-history UI; only admins need to read reports and their private notes.
drop policy if exists "Members view their own reports" on public.member_reports;
drop policy if exists "Administrators view reports" on public.member_reports;
create policy "Administrators view reports" on public.member_reports
for select to authenticated using (public.is_admin());

-- Remove default/table-wide grants before granting just the submission fields.
-- Moderation updates are available only through the existing admin RPC.
revoke all on public.member_reports from public, anon, authenticated;
grant select on public.member_reports to authenticated;
grant insert (reporter_id, reported_user_id, entity_type, entity_id, category, details)
  on public.member_reports to authenticated;

revoke all on public.member_suspensions from public, anon, authenticated;
grant select on public.member_suspensions to authenticated;

create or replace function public.validate_member_report()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_member uuid;
begin
  if auth.role() = 'authenticated' then
    if new.reporter_id is distinct from auth.uid() then
      raise exception 'Reports must be submitted as the signed-in member';
    end if;
    if public.is_user_suspended() then raise exception 'Account access is paused'; end if;
    if new.status <> 'open' or new.resolution_notes is not null
      or new.resolved_by is not null or new.resolved_at is not null then
      raise exception 'Members cannot set report review fields';
    end if;
  end if;

  -- Resolve ownership from the entity, not from a client-supplied member ID.
  if new.entity_type = 'profile' then
    select id into target_member from public.profiles where id = new.entity_id;
  elsif new.entity_type = 'job' then
    select poster_id into target_member from public.job_postings where id = new.entity_id;
  else
    raise exception 'Invalid report target';
  end if;
  if target_member is null then raise exception 'Report target not found'; end if;
  if target_member = new.reporter_id then raise exception 'Members cannot report themselves'; end if;
  if new.reported_user_id is not null and new.reported_user_id <> target_member then
    raise exception 'Reported member does not match the report target';
  end if;
  new.reported_user_id := target_member;
  return new;
end;
$$;

revoke all on function public.validate_member_report() from public, anon, authenticated;
drop trigger if exists member_reports_validate_insert on public.member_reports;
create trigger member_reports_validate_insert
before insert on public.member_reports
for each row execute function public.validate_member_report();

commit;
