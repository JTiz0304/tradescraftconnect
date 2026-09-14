-- TradesCraftConnect secure employer-to-applicant messaging.
-- Apply once after 006_notifications.sql.

create table if not exists public.application_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  read_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  check (sender_id <> recipient_id)
);

alter table public.application_messages enable row level security;

create or replace function public.is_application_participant(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.job_applications application
    join public.job_postings posting on posting.id = application.job_id
    where application.id = target_application_id
      and (application.applicant_id = (select auth.uid()) or posting.poster_id = (select auth.uid()))
  );
$$;

create or replace function public.prepare_application_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  application public.job_applications;
  posting public.job_postings;
begin
  select * into application
  from public.job_applications
  where id = new.application_id;

  select * into posting
  from public.job_postings
  where id = application.job_id;

  if application.id is null
    or (select auth.uid()) not in (application.applicant_id, posting.poster_id) then
    raise exception 'You cannot message in this application.';
  end if;

  if application.status = 'declined' or posting.status <> 'open' then
    raise exception 'Messaging is closed for this application.';
  end if;

  new.sender_id := (select auth.uid());
  new.recipient_id := case
    when (select auth.uid()) = application.applicant_id then posting.poster_id
    else application.applicant_id
  end;
  new.body := trim(new.body);
  return new;
end;
$$;

drop trigger if exists application_messages_prepare on public.application_messages;
create trigger application_messages_prepare
before insert on public.application_messages
for each row execute function public.prepare_application_message();

drop policy if exists "Participants can view application messages" on public.application_messages;
create policy "Participants can view application messages"
on public.application_messages for select
to authenticated
using (public.is_application_participant(application_id));

drop policy if exists "Participants can send application messages" on public.application_messages;
create policy "Participants can send application messages"
on public.application_messages for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and public.is_application_participant(application_id)
);

drop policy if exists "Recipients can mark application messages read" on public.application_messages;
create policy "Recipients can mark application messages read"
on public.application_messages for update
to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

grant select, insert on public.application_messages to authenticated;
grant update (read_at) on public.application_messages to authenticated;

create index if not exists application_messages_thread_idx
  on public.application_messages(application_id, created_at);
create index if not exists application_messages_unread_idx
  on public.application_messages(recipient_id, read_at)
  where read_at is null;

create or replace function public.notify_application_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_name text;
  job_title text;
begin
  select coalesce(full_name, 'A member') into sender_name
  from public.profiles
  where id = new.sender_id;

  select posting.title into job_title
  from public.job_applications application
  join public.job_postings posting on posting.id = application.job_id
  where application.id = new.application_id;

  insert into public.notifications (
    user_id, notification_type, title, message, link, related_id
  ) values (
    new.recipient_id,
    'application_message',
    'New message from ' || sender_name,
    'Regarding ' || coalesce(job_title, 'a job application') || '.',
    '/dashboard/messages/' || new.application_id,
    new.id
  ) on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists application_messages_notify_insert on public.application_messages;
create trigger application_messages_notify_insert
after insert on public.application_messages
for each row execute function public.notify_application_message();
