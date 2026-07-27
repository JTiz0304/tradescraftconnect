-- TradesCraftConnect profile completion and verification foundation.
-- Apply this migration once to the existing Supabase project.

alter table public.profiles
  add column if not exists bio text,
  add column if not exists years_experience integer,
  add column if not exists license_number text,
  add column if not exists license_state text,
  add column if not exists license_verification_status text not null default 'unverified',
  add column if not exists availability_status text not null default 'not_listed',
  add column if not exists employment_types text[] not null default '{}',
  add column if not exists union_preference text not null default 'no_preference',
  add column if not exists tools_equipment text,
  add column if not exists references_summary text,
  add column if not exists social_url text,
  add column if not exists video_intro_url text,
  add column if not exists apprentice_hours integer,
  add column if not exists seeking_ojt boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_years_experience_check,
  add constraint profiles_years_experience_check
    check (years_experience is null or years_experience between 0 and 80),
  drop constraint if exists profiles_apprentice_hours_check,
  add constraint profiles_apprentice_hours_check
    check (apprentice_hours is null or apprentice_hours between 0 and 50000),
  drop constraint if exists profiles_license_verification_status_check,
  add constraint profiles_license_verification_status_check
    check (license_verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  drop constraint if exists profiles_availability_status_check,
  add constraint profiles_availability_status_check
    check (availability_status in ('not_listed', 'available_now', 'available_soon', 'not_available')),
  drop constraint if exists profiles_union_preference_check,
  add constraint profiles_union_preference_check
    check (union_preference in ('no_preference', 'union', 'non_union'));

create or replace function public.protect_profile_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' then
    if new.license_number is distinct from old.license_number
      or new.license_state is distinct from old.license_state then
      new.license_verification_status :=
        case
          when nullif(trim(coalesce(new.license_number, '')), '') is null
            then 'unverified'
          else 'pending'
        end;
    elsif new.license_verification_status is distinct from old.license_verification_status then
      new.license_verification_status := old.license_verification_status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_verification on public.profiles;
create trigger profiles_protect_verification
before update on public.profiles
for each row execute function public.protect_profile_verification();

drop policy if exists "Members can view verified certification metadata" on public.certifications;
create policy "Members can view verified certification metadata"
on public.certifications for select
to authenticated
using (
  user_id = (select auth.uid())
  or verification_status = 'verified'
);

create index if not exists profiles_discovery_idx
  on public.profiles(user_type, availability_status, trade_type);

