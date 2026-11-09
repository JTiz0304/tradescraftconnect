-- Synthetic reproduction of the broad legacy access patterns found in audit.
-- No deployment snapshot or member data is included.
-- Policies deliberately coexist with clean-install permissive policies.

create policy "Legacy public profile read" on public.profiles
for select to public using (true);
create policy "Legacy public profile insert" on public.profiles
for insert to public with check (true);
create policy "Legacy member job read" on public.job_postings
for select to public using (auth.uid() is not null);
create policy "Legacy member job insert" on public.job_postings
for insert to public with check (auth.uid() = poster_id);
create policy "Legacy member application insert" on public.job_applications
for insert to public with check (auth.uid() = applicant_id);
create policy "Legacy certification owner delete" on public.certifications
for delete to public using (auth.uid() = user_id);

-- Explicit default grants survived the original migrations' PUBLIC revokes.
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
alter function public.handle_new_user() reset search_path;
