-- Production infrastructure setup, separate from the portable application
-- migration. Review and apply once as postgres, after configuring Vault and
-- deploying the worker. Contains no secret values and performs no backfill.
begin;
create schema if not exists extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- pg_net temporarily stores the bearer header in its request queue. Application
-- roles must not read that queue or directly call its SECURITY DEFINER helpers.
revoke all on schema net from public, anon, authenticated, service_role;
revoke all on all tables in schema net from public, anon, authenticated, service_role;
revoke all on all functions in schema net from public, anon, authenticated, service_role;

create or replace function tcc_email.wake_worker()
returns bigint language plpgsql security definer set search_path = '' as $$
declare worker_url text; worker_secret text;
begin
  if not exists (
    select 1 from public.email_notification_deliveries
    where outbox_payload is not null and available_at<=now()
      and (status in ('queued','failed') or (status='pending' and locked_until<=now()))
  ) then return null; end if;
  select decrypted_secret into worker_url from vault.decrypted_secrets where name='tcc_email_worker_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name='tcc_email_worker_secret';
  -- Refuse to transmit credentials to a preview, redirect or unexpected host.
  if worker_url is distinct from 'https://www.tradescraftconnect.com/api/email-notifications/process'
    or worker_secret is null or length(worker_secret)<32 then return null; end if;
  return net.http_post(url:=worker_url,
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || worker_secret),
    body:='{}'::jsonb,timeout_milliseconds:=65000);
end;
$$;
alter function tcc_email.wake_worker() owner to postgres;
revoke all on function tcc_email.wake_worker() from public, anon, authenticated, service_role;
select cron.schedule('tcc-email-worker','* * * * *','select tcc_email.wake_worker()');
commit;
