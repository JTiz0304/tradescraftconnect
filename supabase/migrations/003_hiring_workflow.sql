-- TradesCraftConnect hiring workflow.
-- Apply once after 001_initial_schema.sql and 002_profile_verification.sql.

alter table public.job_postings
  add column if not exists job_type text not null default 'project',
  add column if not exists start_date date,
  add column if not exists pay_range text,
  add column if not exists requirements text;

alter table public.job_postings
  drop constraint if exists job_postings_job_type_check,
  add constraint job_postings_job_type_check
    check (job_type in ('full_time', 'part_time', 'contract', 'project', 'weekends'));

update public.job_applications
set status = case status
  when 'pending' then 'new'
  when 'accepted' then 'hired'
  when 'rejected' then 'declined'
  else status
end
where status in ('pending', 'accepted', 'rejected');

alter table public.job_applications
  alter column status set default 'new',
  drop constraint if exists job_applications_status_check,
  add constraint job_applications_status_check
    check (status in ('new', 'reviewing', 'interviewing', 'hired', 'declined'));

create index if not exists job_applications_pipeline_idx
  on public.job_applications(job_id, status, created_at desc);
