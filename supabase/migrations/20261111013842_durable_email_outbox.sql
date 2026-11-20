-- Additive migration. Existing sent/ambiguous delivery records are preserved.
-- Apply before deploying the queue worker; never backfill historical events.
create schema if not exists tcc_email;
revoke all on schema tcc_email from public, anon, authenticated;

alter table public.email_notification_deliveries
  add column if not exists outbox_payload jsonb,
  add column if not exists provider_payload jsonb,
  add column if not exists queue_order bigint generated always as identity,
  add column if not exists attempts integer not null default 0,
  add column if not exists first_attempt_at timestamptz,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists locked_until timestamptz,
  add column if not exists claim_token uuid;
alter table public.email_notification_deliveries
  drop constraint if exists email_notification_deliveries_status_check;
alter table public.email_notification_deliveries
  add constraint email_notification_deliveries_status_check
  check (status in ('queued','pending','sent','failed','skipped','needs_review'));
alter table public.email_notification_deliveries enable row level security;
revoke all on public.email_notification_deliveries from public, anon, authenticated;
grant select, insert, update on public.email_notification_deliveries to service_role;
grant usage, select on sequence public.email_notification_deliveries_queue_order_seq to service_role;
create index if not exists email_notification_queue_due_idx
  on public.email_notification_deliveries(status, available_at, queue_order)
  where outbox_payload is not null and status in ('queued','pending','failed');
create index if not exists email_notification_queue_recipient_idx
  on public.email_notification_deliveries(recipient_id, queue_order)
  where outbox_payload is not null and status in ('queued','pending','failed');

-- Runs only as a trigger after an authorized business write. No client may call
-- it or insert queue contents. Snapshot content and recipient at event time so
-- rapid status changes, deleted source rows and a closed browser lose no event.
create or replace function tcc_email.enqueue_event()
returns trigger language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_type text; v_key text; related uuid; recipient uuid;
  content jsonb; posting public.job_postings; display_name text;
  label text; approved boolean; essential boolean := false; enabled boolean;
begin
  if tg_table_name = 'job_applications' then
    select * into strict posting from public.job_postings where id = new.job_id;
    related := new.id;
    if tg_op = 'INSERT' then
      v_type := 'new_application'; v_key := 'new_application:' || new.id;
      recipient := posting.poster_id;
      select coalesce(full_name, 'A member') into display_name from public.profiles where id = new.applicant_id;
      content := jsonb_build_object('subject', 'New application for ' || posting.title,
        'heading', 'New Job Application', 'message', display_name || ' applied for ' || posting.title || '.',
        'link', '/dashboard/my-postings/' || posting.id, 'buttonLabel', 'Review Applicant');
    else
      if new.status is not distinct from old.status then return new; end if;
      v_type := 'application_status'; v_key := 'application_status:' || new.id || ':' || new.status;
      recipient := new.applicant_id;
      label := case new.status when 'new' then 'received' when 'reviewing' then 'under review'
        when 'interviewing' then 'moved to interviewing' when 'hired' then 'marked as hired'
        when 'declined' then 'declined' else 'updated' end;
      content := jsonb_build_object('subject', 'Application update: ' || posting.title,
        'heading', case when new.status = 'hired' then 'You Were Hired!' else 'Application Status Updated' end,
        'message', 'Your application for ' || posting.title || ' was ' || label || '.',
        'link', '/dashboard/my-applications', 'buttonLabel', 'View Application');
    end if;
  elsif tg_table_name = 'application_messages' then
    v_type := 'application_message'; related := new.id;
    v_key := 'application_message:' || new.id; recipient := new.recipient_id;
    select j.* into strict posting from public.job_postings j join public.job_applications a on a.job_id=j.id where a.id=new.application_id;
    select coalesce(full_name, 'a member') into display_name from public.profiles where id=new.sender_id;
    content := jsonb_build_object('subject', 'New message about ' || posting.title,
      'heading', 'New Message from ' || display_name,
      'message', 'You received a private message regarding ' || posting.title || '.',
      'link', '/dashboard/messages/' || new.application_id, 'buttonLabel', 'Read Message');
  elsif tg_table_name = 'certifications' then
    if new.verification_status is not distinct from old.verification_status
      or new.verification_status not in ('verified','rejected') then return new; end if;
    v_type := 'certification_review'; related := new.id; recipient := new.user_id;
    v_key := 'certification_review:' || new.id || ':' || new.verification_status;
    approved := new.verification_status = 'verified';
    content := jsonb_build_object('subject', case when approved then 'Certification approved' else 'Certification needs attention' end,
      'heading', case when approved then 'Certification Approved' else 'Certification Needs Attention' end,
      'message', case when approved then new.cert_name || ' is now verified on your TradesCraftConnect profile.'
        else new.cert_name || ' was not approved. Open your profile to review the administrator note.' end,
      'link', '/dashboard/edit-profile', 'buttonLabel', 'View Certification');
  elsif tg_table_name = 'member_suspensions' then
    if tg_op = 'UPDATE' then
      if new.suspended_at is not distinct from old.suspended_at and new.lifted_at is not distinct from old.lifted_at then return new; end if;
    end if;
    essential := true; v_type := 'account_suspension'; related := new.user_id; recipient := new.user_id;
    v_key := 'account_suspension:' || new.user_id || case when new.lifted_at is null
      then ':paused:' || (to_jsonb(new.suspended_at) #>> '{}') else ':lifted:' || (to_jsonb(new.lifted_at) #>> '{}') end;
    content := jsonb_build_object('subject', case when new.lifted_at is null then 'Important account access update' else 'Account access restored' end,
      'heading', case when new.lifted_at is null then 'Account Access Paused' else 'Account Access Restored' end,
      'message', case when new.lifted_at is null then 'Your account access was temporarily paused. Reason: ' || new.reason
        else 'Your TradesCraftConnect account access has been restored.' end,
      'link', case when new.lifted_at is null then '/suspended' else '/login' end,
      'buttonLabel', case when new.lifted_at is null then 'View Account Status' else 'Sign In' end);
  else
    raise exception 'Unexpected email event source';
  end if;

  select email_notifications_enabled into strict enabled from public.profiles where id=recipient;
  -- A genuine return to a previous status is a new event, while the unsuffixed
  -- key remains reserved so an old browser tab cannot send that event again.
  if v_type in ('application_status','certification_review','account_suspension') and exists
    (select 1 from public.email_notification_deliveries d where d.event_key=v_key and d.recipient_id=recipient) then
    v_key := v_key || ':' || gen_random_uuid();
  end if;
  insert into public.email_notification_deliveries(event_key,event_type,related_id,recipient_id,status,outbox_payload,error_message)
  values(v_key,v_type,related,recipient,case when essential or enabled then 'queued' else 'skipped' end,
    content || jsonb_build_object('essential',essential),case when essential or enabled then null else 'Recipient opted out at event time' end)
  on conflict (event_key,recipient_id) do nothing;
  return new;
end;
$$;
revoke all on function tcc_email.enqueue_event() from public, anon, authenticated, service_role;

drop trigger if exists job_applications_email_insert on public.job_applications;
create trigger job_applications_email_insert after insert on public.job_applications for each row execute function tcc_email.enqueue_event();
drop trigger if exists job_applications_email_status on public.job_applications;
create trigger job_applications_email_status after update of status on public.job_applications for each row execute function tcc_email.enqueue_event();
drop trigger if exists application_messages_email_insert on public.application_messages;
create trigger application_messages_email_insert after insert on public.application_messages for each row execute function tcc_email.enqueue_event();
drop trigger if exists certifications_email_review on public.certifications;
create trigger certifications_email_review after update of verification_status on public.certifications for each row execute function tcc_email.enqueue_event();
drop trigger if exists member_suspensions_email_access on public.member_suspensions;
create trigger member_suspensions_email_access after insert or update on public.member_suspensions for each row execute function tcc_email.enqueue_event();

-- Short atomic claim; the HTTP call occurs outside this transaction. The lease
-- is longer than the worker's 60-second maximum. A crashed attempt is replayed
-- only within 23 hours using its frozen provider request and stable key.
create or replace function public.claim_email_notification_delivery()
returns setof public.email_notification_deliveries language plpgsql security invoker set search_path = '' as $$
begin
  update public.email_notification_deliveries set status='needs_review',locked_until=null,claim_token=null,
    error_message='Provider idempotency window requires reconciliation'
  where outbox_payload is not null and status in ('pending','failed')
    and first_attempt_at <= now()-interval '23 hours';
  return query
    with candidate as (
      select d.id from public.email_notification_deliveries d
      where d.outbox_payload is not null and d.available_at<=now()
        and (d.status in ('queued','failed') or (d.status='pending' and d.locked_until<=now()))
        and not exists (select 1 from public.email_notification_deliveries earlier
          where earlier.recipient_id=d.recipient_id and earlier.queue_order<d.queue_order
            and earlier.outbox_payload is not null and earlier.status in ('queued','pending','failed'))
      order by d.queue_order for update of d skip locked limit 1
    )
    update public.email_notification_deliveries d set status='pending',attempts=d.attempts+1,
      locked_until=now()+interval '5 minutes',claim_token=gen_random_uuid()
    from candidate where d.id=candidate.id returning d.*;
end;
$$;
revoke all on function public.claim_email_notification_delivery() from public, anon, authenticated;
grant execute on function public.claim_email_notification_delivery() to service_role;
