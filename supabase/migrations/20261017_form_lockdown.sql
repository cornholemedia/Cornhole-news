-- Form writes go through the server's service role. Visitors cannot insert
-- contact messages, newsletter rows, job postings, or old job applications,
-- and they cannot upload resumes or call the inbox and rate-limit functions.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/migrations/20261009_job_postings.sql first.
--
-- The app calls record_form_attempt and form_recipient_email with the
-- service role key. Per-IP hourly caps:
--   contact 5, job 3, newsletter 5, job_posting 3,
--   signup 5, post 10, comment 40.
-- A separate per-account cap on posts and comments is in
-- supabase/migrations/20261017_content_guards.sql.

do $$
begin
  if to_regclass('public.form_attempts') is null then
    raise exception 'Run supabase/migrations/20261007_forms_and_settings.sql first.';
  end if;
  if to_regclass('public.newsletter_subscribers') is null then
    raise exception 'Run supabase/migrations/20261008_newsletter_subscribers.sql first.';
  end if;
  if to_regclass('public.job_postings') is null then
    raise exception 'Run supabase/migrations/20261009_job_postings.sql first.';
  end if;
end $$;

alter table public.form_attempts drop constraint if exists form_attempts_form_check;

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'form_attempts'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%contact%'
  loop
    execute format('alter table public.form_attempts drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.form_attempts drop constraint if exists form_attempts_form_check;

alter table public.form_attempts
  add constraint form_attempts_form_check
  check (form in (
    'contact',
    'job',
    'newsletter',
    'job_posting',
    'signup',
    'post',
    'comment'
  ));

create or replace function public.record_form_attempt(p_form text, p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hourly_limit integer;
  recent_count integer;
  burst_count integer;
begin
  if p_form = 'contact' then
    hourly_limit := 5;
  elsif p_form = 'job' then
    hourly_limit := 3;
  elsif p_form = 'newsletter' then
    hourly_limit := 5;
  elsif p_form = 'job_posting' then
    hourly_limit := 3;
  elsif p_form = 'signup' then
    hourly_limit := 5;
  elsif p_form = 'post' then
    hourly_limit := 10;
  elsif p_form = 'comment' then
    hourly_limit := 40;
  else
    return false;
  end if;

  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  delete from public.form_attempts
  where created_at < now() - interval '2 days';

  select count(*) into burst_count
  from public.form_attempts
  where created_at > now() - interval '1 minute';

  if burst_count >= 60 then
    return false;
  end if;

  select count(*) into recent_count
  from public.form_attempts
  where form = p_form
    and ip_hash = p_ip_hash
    and created_at > now() - interval '1 hour';

  if recent_count >= hourly_limit then
    return false;
  end if;

  insert into public.form_attempts (form, ip_hash)
  values (p_form, p_ip_hash);

  return true;
end;
$$;

revoke all on function public.record_form_attempt(text, text) from public, anon, authenticated;
grant execute on function public.record_form_attempt(text, text) to service_role;

comment on function public.record_form_attempt(text, text) is
  'Service role only. Counts a form attempt for a hashed IP and returns whether it is still allowed.';

revoke all on function public.form_recipient_email(text) from public, anon, authenticated;
grant execute on function public.form_recipient_email(text) to service_role;

comment on function public.form_recipient_email(text) is
  'Service role only. Returns the contact or jobs inbox address.';

drop policy if exists "Anyone can submit a contact message" on public.contact_submissions;
drop policy if exists "Anyone can submit a job application" on public.job_applications;
drop policy if exists "Anyone can join the newsletter" on public.newsletter_subscribers;
drop policy if exists "Anyone can submit a pending job posting" on public.job_postings;

revoke insert on table public.contact_submissions from anon, authenticated;
revoke insert on table public.job_applications from anon, authenticated;
revoke insert on table public.newsletter_subscribers from anon, authenticated;
revoke insert on table public.job_postings from anon, authenticated;

drop policy if exists "Anyone can upload a resume" on storage.objects;

-- Service-role inserts still fire these triggers, so that role needs EXECUTE.
grant execute on function public.normalize_newsletter_subscriber() to service_role;
grant execute on function public.guard_job_posting() to service_role;

comment on table public.contact_submissions is
  'Backup copy of contact-form messages. The server inserts with the service role. Only admins can read.';
comment on table public.newsletter_subscribers is
  'Footer newsletter signups. The server inserts with the service role. Only admins can read, update, or delete.';
