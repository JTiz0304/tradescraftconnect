-- TradesCraftConnect administrator certification review workflow.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamp with time zone not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Administrators can view their admin membership" on public.admin_users;
create policy "Administrators can view their admin membership"
on public.admin_users for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.is_admin(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where admin_users.user_id = check_user
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

alter table public.certifications
  add column if not exists review_notes text,
  add column if not exists reviewed_at timestamp with time zone,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

create or replace function public.protect_profile_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin() then
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

create or replace function public.protect_certification_review()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.verification_status := 'pending';
      new.review_notes := null;
      new.reviewed_at := null;
      new.reviewed_by := null;
    else
      new.verification_status := old.verification_status;
      new.review_notes := old.review_notes;
      new.reviewed_at := old.reviewed_at;
      new.reviewed_by := old.reviewed_by;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists certifications_protect_review on public.certifications;
create trigger certifications_protect_review
before insert or update on public.certifications
for each row execute function public.protect_certification_review();

drop policy if exists "Admins can review certifications" on public.certifications;
create policy "Admins can review certifications"
on public.certifications for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can update certifications" on public.certifications;
create policy "Admins can update certifications"
on public.certifications for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can delete their own certifications" on public.certifications;
create policy "Users can delete their own unverified certifications"
on public.certifications for delete
to authenticated
using (
  user_id = (select auth.uid())
  and verification_status <> 'verified'
);

drop policy if exists "Admins can view certification files" on storage.objects;
create policy "Admins can view certification files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'certifications'
  and public.is_admin()
);

create or replace function public.review_certification(
  certification_id uuid,
  decision text,
  reviewer_notes text default null
)
returns public.certifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewed public.certifications;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if decision not in ('verified', 'rejected') then
    raise exception 'Decision must be verified or rejected';
  end if;

  if decision = 'rejected' and nullif(trim(coalesce(reviewer_notes, '')), '') is null then
    raise exception 'A reason is required when rejecting a certification';
  end if;

  update public.certifications
  set verification_status = decision,
      review_notes = nullif(trim(coalesce(reviewer_notes, '')), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = certification_id
  returning * into reviewed;

  if reviewed.id is null then
    raise exception 'Certification not found';
  end if;

  update public.profiles
  set license_verification_status =
    case
      when decision = 'verified' then 'verified'
      when exists (
        select 1 from public.certifications
        where user_id = reviewed.user_id
          and verification_status = 'verified'
      ) then 'verified'
      else 'rejected'
    end
  where id = reviewed.user_id;

  return reviewed;
end;
$$;

revoke all on function public.review_certification(uuid, text, text) from public;
grant execute on function public.review_certification(uuid, text, text) to authenticated;

create index if not exists certifications_review_queue_idx
  on public.certifications(verification_status, created_at);
