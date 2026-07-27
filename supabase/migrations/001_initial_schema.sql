-- TradesCraftConnect MVP database
-- Run this migration in a new Supabase project before testing the application.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  user_type text check (
    user_type in ('gc_builder', 'business_owner', 'professional', 'apprentice')
  ),
  full_name text,
  company_name text,
  business_name text,
  trade_type text,
  location text,
  work_radius text,
  hiring_radius text,
  hire_abroad boolean not null default false,
  school_program text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  description text not null default '',
  trade_type text not null,
  location text not null,
  radius text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_postings(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  message text not null default '',
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'rejected')
  ),
  created_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);

create table if not exists public.portfolio_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  cert_name text not null,
  issuing_org text,
  expiry_date date,
  verification_status text not null default 'unverified' check (
    verification_status in ('unverified', 'pending', 'verified', 'rejected')
  ),
  created_at timestamptz not null default now()
);

create index if not exists job_postings_status_created_idx
  on public.job_postings(status, created_at desc);
create index if not exists job_postings_poster_idx
  on public.job_postings(poster_id);
create index if not exists job_applications_applicant_idx
  on public.job_applications(applicant_id, created_at desc);
create index if not exists job_applications_job_idx
  on public.job_applications(job_id, created_at desc);
create index if not exists portfolio_images_user_idx
  on public.portfolio_images(user_id, sort_order);
create index if not exists certifications_user_idx
  on public.certifications(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists job_postings_set_updated_at on public.job_postings;
create trigger job_postings_set_updated_at
before update on public.job_postings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.job_postings enable row level security;
alter table public.job_applications enable row level security;
alter table public.portfolio_images enable row level security;
alter table public.certifications enable row level security;

drop policy if exists "Authenticated users can view member profiles" on public.profiles;
create policy "Authenticated users can view member profiles"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Members can view open jobs and their own postings" on public.job_postings;
create policy "Members can view open jobs and their own postings"
on public.job_postings for select
to authenticated
using (status = 'open' or poster_id = (select auth.uid()));

drop policy if exists "Hiring accounts can create jobs" on public.job_postings;
create policy "Hiring accounts can create jobs"
on public.job_postings for insert
to authenticated
with check (
  poster_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and user_type in ('gc_builder', 'business_owner')
  )
);

drop policy if exists "Posters can update their jobs" on public.job_postings;
create policy "Posters can update their jobs"
on public.job_postings for update
to authenticated
using (poster_id = (select auth.uid()))
with check (poster_id = (select auth.uid()));

drop policy if exists "Posters can delete their jobs" on public.job_postings;
create policy "Posters can delete their jobs"
on public.job_postings for delete
to authenticated
using (poster_id = (select auth.uid()));

drop policy if exists "Applicants and job posters can view applications" on public.job_applications;
create policy "Applicants and job posters can view applications"
on public.job_applications for select
to authenticated
using (
  applicant_id = (select auth.uid())
  or exists (
    select 1
    from public.job_postings
    where id = job_id and poster_id = (select auth.uid())
  )
);

drop policy if exists "Members can apply to open jobs" on public.job_applications;
create policy "Members can apply to open jobs"
on public.job_applications for insert
to authenticated
with check (
  applicant_id = (select auth.uid())
  and exists (
    select 1
    from public.job_postings
    where id = job_id
      and status = 'open'
      and poster_id <> (select auth.uid())
  )
);

drop policy if exists "Job posters can update application status" on public.job_applications;
create policy "Job posters can update application status"
on public.job_applications for update
to authenticated
using (
  exists (
    select 1
    from public.job_postings
    where id = job_id and poster_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.job_postings
    where id = job_id and poster_id = (select auth.uid())
  )
);

drop policy if exists "Applicants can withdraw applications" on public.job_applications;
create policy "Applicants can withdraw applications"
on public.job_applications for delete
to authenticated
using (applicant_id = (select auth.uid()));

drop policy if exists "Members can view portfolio images" on public.portfolio_images;
create policy "Members can view portfolio images"
on public.portfolio_images for select
to authenticated
using (true);

drop policy if exists "Users can add their own portfolio images" on public.portfolio_images;
create policy "Users can add their own portfolio images"
on public.portfolio_images for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own portfolio images" on public.portfolio_images;
create policy "Users can update their own portfolio images"
on public.portfolio_images for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own portfolio images" on public.portfolio_images;
create policy "Users can delete their own portfolio images"
on public.portfolio_images for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can view their own certifications" on public.certifications;
create policy "Users can view their own certifications"
on public.certifications for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can add their own certifications" on public.certifications;
create policy "Users can add their own certifications"
on public.certifications for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own certifications" on public.certifications;
create policy "Users can update their own certifications"
on public.certifications for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own certifications" on public.certifications;
create policy "Users can delete their own certifications"
on public.certifications for delete
to authenticated
using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('portfolios', 'portfolios', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('certifications', 'certifications', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view avatars" on storage.objects;
create policy "Public can view avatars"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Public can view portfolios" on storage.objects;
create policy "Public can view portfolios"
on storage.objects for select
using (bucket_id = 'portfolios');

drop policy if exists "Users can upload own avatars" on storage.objects;
create policy "Users can upload own avatars"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can update own avatars" on storage.objects;
create policy "Users can update own avatars"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can delete own avatars" on storage.objects;
create policy "Users can delete own avatars"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can upload own portfolios" on storage.objects;
create policy "Users can upload own portfolios"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'portfolios'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can delete own portfolios" on storage.objects;
create policy "Users can delete own portfolios"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'portfolios'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can view own certification files" on storage.objects;
create policy "Users can view own certification files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'certifications'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can upload own certification files" on storage.objects;
create policy "Users can upload own certification files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'certifications'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can delete own certification files" on storage.objects;
create policy "Users can delete own certification files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'certifications'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
