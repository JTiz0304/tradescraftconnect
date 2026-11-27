-- TradesCraftConnect transactional email preferences and delivery log.
-- Apply once after 009_safety_and_moderation.sql.

alter table public.profiles
  add column if not exists email_notifications_enabled boolean not null default true;

create table if not exists public.email_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  event_type text not null,
  related_id uuid not null,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  created_at timestamp with time zone not null default now(),
  sent_at timestamp with time zone,
  unique (event_key, recipient_id)
);

alter table public.email_notification_deliveries enable row level security;
revoke all on public.email_notification_deliveries from anon, authenticated;

create index if not exists email_notification_deliveries_created_idx
  on public.email_notification_deliveries(created_at desc);
