-- TradesCraftConnect in-app notification center.
-- Apply once after 005_admin_certification_review.sql.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null default '',
  link text,
  related_id uuid,
  read_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  unique (user_id, notification_type, related_id)
);

alter table public.notifications enable row level security;

drop policy if exists "Members can view their own notifications" on public.notifications;
create policy "Members can view their own notifications"
on public.notifications for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Members can mark their own notifications read" on public.notifications;
create policy "Members can mark their own notifications read"
on public.notifications for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Members can delete their own notifications" on public.notifications;
create policy "Members can delete their own notifications"
on public.notifications for delete
to authenticated
using (user_id = (select auth.uid()));

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(user_id, read_at)
  where read_at is null;

create or replace function public.notify_new_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  posting public.job_postings;
  applicant_name text;
begin
  select * into posting
  from public.job_postings
  where id = new.job_id;

  select coalesce(full_name, 'A member') into applicant_name
  from public.profiles
  where id = new.applicant_id;

  insert into public.notifications (
    user_id, notification_type, title, message, link, related_id
  ) values (
    posting.poster_id,
    'new_application',
    'New application received',
    applicant_name || ' applied for ' || posting.title || '.',
    '/dashboard/my-postings/' || posting.id,
    new.id
  ) on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists job_applications_notify_insert on public.job_applications;
create trigger job_applications_notify_insert
after insert on public.job_applications
for each row execute function public.notify_new_application();

create or replace function public.notify_application_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_title text;
  status_label text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select title into job_title
  from public.job_postings
  where id = new.job_id;

  status_label := case new.status
    when 'reviewing' then 'under review'
    when 'interviewing' then 'moved to interviewing'
    when 'hired' then 'marked as hired'
    when 'declined' then 'declined'
    else 'updated'
  end;

  insert into public.notifications (
    user_id, notification_type, title, message, link, related_id
  ) values (
    new.applicant_id,
    'application_status_' || new.status,
    case new.status
      when 'hired' then 'You were hired!'
      when 'declined' then 'Application update'
      else 'Application status changed'
    end,
    'Your application for ' || coalesce(job_title, 'a job') || ' was ' || status_label || '.',
    '/dashboard/my-applications',
    new.id
  ) on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists job_applications_notify_status on public.job_applications;
create trigger job_applications_notify_status
after update of status on public.job_applications
for each row execute function public.notify_application_status();

create or replace function public.notify_certification_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verification_status is not distinct from old.verification_status
    or new.verification_status not in ('verified', 'rejected') then
    return new;
  end if;

  insert into public.notifications (
    user_id, notification_type, title, message, link, related_id
  ) values (
    new.user_id,
    'certification_' || new.verification_status,
    case new.verification_status
      when 'verified' then 'Certification approved'
      else 'Certification needs attention'
    end,
    case new.verification_status
      when 'verified' then new.cert_name || ' is now verified on your profile.'
      else new.cert_name || ' was not approved. Open your profile to review the administrator note.'
    end,
    '/dashboard/edit-profile',
    new.id
  ) on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists certifications_notify_review on public.certifications;
create trigger certifications_notify_review
after update of verification_status on public.certifications
for each row execute function public.notify_certification_review();

create or replace function public.notify_matching_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (
    user_id, notification_type, title, message, link, related_id
  )
  select
    profiles.id,
    'matching_job',
    'New ' || new.trade_type || ' opportunity',
    new.title || ' was posted in ' || new.location || '.',
    '/dashboard/jobs/' || new.id,
    new.id
  from public.profiles
  where profiles.id <> new.poster_id
    and profiles.user_type in ('professional', 'apprentice', 'business_owner')
    and lower(coalesce(profiles.trade_type, '')) = lower(new.trade_type)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists job_postings_notify_matching_members on public.job_postings;
create trigger job_postings_notify_matching_members
after insert on public.job_postings
for each row execute function public.notify_matching_job();
