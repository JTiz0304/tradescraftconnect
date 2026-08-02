-- Allow a job poster to manage the hiring status of applications
-- submitted to their own job postings.

grant update (status) on public.job_applications to authenticated;

drop policy if exists "Job posters can update application status"
  on public.job_applications;

create policy "Job posters can update application status"
on public.job_applications
for update
to authenticated
using (
  exists (
    select 1
    from public.job_postings as posting
    where posting.id = public.job_applications.job_id
      and posting.poster_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.job_postings as posting
    where posting.id = public.job_applications.job_id
      and posting.poster_id = (select auth.uid())
  )
);
