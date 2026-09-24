-- TradesCraftConnect saved jobs and saved professional profiles.
-- Apply once after 007_secure_messaging.sql.

create table if not exists public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.job_postings(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (user_id, job_id)
);

create table if not exists public.saved_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (user_id, profile_id),
  check (user_id <> profile_id)
);

alter table public.saved_jobs enable row level security;
alter table public.saved_profiles enable row level security;

drop policy if exists "Members manage their saved jobs" on public.saved_jobs;
create policy "Members manage their saved jobs"
on public.saved_jobs for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Members manage their saved profiles" on public.saved_profiles;
create policy "Members manage their saved profiles"
on public.saved_profiles for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant select, insert, delete on public.saved_jobs to authenticated;
grant select, insert, delete on public.saved_profiles to authenticated;

create index if not exists saved_jobs_user_idx on public.saved_jobs(user_id, created_at desc);
create index if not exists saved_profiles_user_idx on public.saved_profiles(user_id, created_at desc);
