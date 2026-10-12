-- TradesCraftConnect reporting, moderation, and account suspension controls.
-- Apply once after 008_saved_items.sql.

create table if not exists public.member_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid,
  entity_type text not null check (entity_type in ('profile', 'job')),
  entity_id uuid not null,
  category text not null check (category in ('scam', 'harassment', 'unsafe', 'discrimination', 'false_credentials', 'inappropriate', 'other')),
  details text not null check (char_length(trim(details)) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution_notes text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint member_reports_reported_user_fkey foreign key (reported_user_id) references public.profiles(id) on delete cascade
);

create table if not exists public.member_suspensions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reason text not null,
  suspended_by uuid not null references auth.users(id) on delete restrict,
  suspended_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone,
  lifted_at timestamp with time zone,
  lifted_by uuid references auth.users(id) on delete set null
);

alter table public.member_reports enable row level security;
alter table public.member_suspensions enable row level security;

drop policy if exists "Members create their own reports" on public.member_reports;
create policy "Members create their own reports"
on public.member_reports for insert to authenticated
with check (
  reporter_id = (select auth.uid())
  and (reported_user_id is null or reported_user_id <> (select auth.uid()))
);

drop policy if exists "Members view their own reports" on public.member_reports;
create policy "Members view their own reports"
on public.member_reports for select to authenticated
using (reporter_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Administrators manage reports" on public.member_reports;
create policy "Administrators manage reports"
on public.member_reports for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Members view their own suspension" on public.member_suspensions;
create policy "Members view their own suspension"
on public.member_suspensions for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

grant select, insert on public.member_reports to authenticated;
grant update on public.member_reports to authenticated;
grant select on public.member_suspensions to authenticated;

create or replace function public.is_user_suspended(check_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.member_suspensions
    where user_id = check_user
      and lifted_at is null
      and (expires_at is null or expires_at > now())
  );
$$;

revoke all on function public.is_user_suspended(uuid) from public;
grant execute on function public.is_user_suspended(uuid) to authenticated;

create or replace function public.review_member_report(
  report_id uuid,
  decision text,
  admin_notes text default null
)
returns public.member_reports
language plpgsql security definer set search_path = '' as $$
declare reviewed public.member_reports;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if decision not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'Invalid review decision';
  end if;

  update public.member_reports
  set status = decision,
      resolution_notes = nullif(trim(coalesce(admin_notes, '')), ''),
      resolved_by = case when decision in ('resolved', 'dismissed') then auth.uid() else null end,
      resolved_at = case when decision in ('resolved', 'dismissed') then now() else null end
  where id = report_id returning * into reviewed;

  if reviewed.id is null then raise exception 'Report not found'; end if;
  return reviewed;
end;
$$;

revoke all on function public.review_member_report(uuid, text, text) from public;
grant execute on function public.review_member_report(uuid, text, text) to authenticated;

create or replace function public.set_member_suspension(
  target_user uuid,
  suspend boolean,
  admin_reason text default null,
  suspension_expires_at timestamp with time zone default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if target_user = auth.uid() then raise exception 'Administrators cannot suspend themselves'; end if;
  if public.is_admin(target_user) then raise exception 'Administrator accounts cannot be suspended here'; end if;

  if suspend then
    if nullif(trim(coalesce(admin_reason, '')), '') is null then raise exception 'A suspension reason is required'; end if;
    insert into public.member_suspensions (user_id, reason, suspended_by, expires_at, lifted_at, lifted_by)
    values (target_user, trim(admin_reason), auth.uid(), suspension_expires_at, null, null)
    on conflict (user_id) do update set
      reason = excluded.reason,
      suspended_by = auth.uid(),
      suspended_at = now(),
      expires_at = excluded.expires_at,
      lifted_at = null,
      lifted_by = null;
  else
    update public.member_suspensions
    set lifted_at = now(), lifted_by = auth.uid()
    where user_id = target_user and lifted_at is null;
  end if;
end;
$$;

revoke all on function public.set_member_suspension(uuid, boolean, text, timestamp with time zone) from public;
grant execute on function public.set_member_suspension(uuid, boolean, text, timestamp with time zone) to authenticated;

create index if not exists member_reports_queue_idx on public.member_reports(status, created_at desc);
create index if not exists member_reports_reported_user_idx on public.member_reports(reported_user_id, created_at desc);

