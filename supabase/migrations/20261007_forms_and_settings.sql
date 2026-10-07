-- Contact form, job applications, resume storage, and the inboxes they email.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
--
-- The website uses the anon key only. It does not need the service role key.
-- Visitors can insert a contact message or a job application. They cannot read
-- those rows. Signed-in admins can read them, using public.is_admin().
-- The two inbox addresses are read through form_recipient_email(), which
-- returns only those addresses. Rate limits go through record_form_attempt(),
-- which records a hashed IP and returns true or false. Neither function
-- returns other people's rows.
-- Resume files go in the private Storage bucket "resumes". Visitors can add a
-- file. Only admins can read one. The bucket allows PDF, DOC, and DOCX up to
-- 5 MB. The form itself stops at 4 MB so the file can be attached to the email.

-- 1. Inboxes the admin can change. Seeded once; re-running does not reset them.
create table if not exists public.site_settings (
  key text primary key check (key in ('contact_recipient_email', 'jobs_recipient_email')),
  value text not null check (
    char_length(value) between 3 and 320
    and value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.site_settings enable row level security;

drop policy if exists "Admins can read site settings" on public.site_settings;
create policy "Admins can read site settings"
  on public.site_settings for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update site settings" on public.site_settings;
create policy "Admins can update site settings"
  on public.site_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.touch_site_setting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.key := old.key;
  end if;
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.touch_site_setting() from public, anon;
grant execute on function public.touch_site_setting() to authenticated;

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch
  before insert or update on public.site_settings
  for each row execute procedure public.touch_site_setting();

revoke all on table public.site_settings from public, anon, authenticated;
grant select, update on table public.site_settings to authenticated;

insert into public.site_settings (key, value)
values
  ('contact_recipient_email', 'cornholemedia@gmail.com'),
  ('jobs_recipient_email', 'cornholemedia@gmail.com')
on conflict (key) do nothing;

comment on table public.site_settings is
  'Email inboxes for the contact form and job applications. Change them from the admin page.';

-- Returns one inbox address and nothing else. Granted to anon so the site can
-- send mail with the anon key. Callers cannot read any other setting.
create or replace function public.form_recipient_email(p_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select value
  from public.site_settings
  where p_key in ('contact_recipient_email', 'jobs_recipient_email')
    and key = p_key;
$$;

revoke all on function public.form_recipient_email(text) from public;
grant execute on function public.form_recipient_email(text) to anon, authenticated;

comment on function public.form_recipient_email(text) is
  'Returns the contact or jobs inbox address. Does not return any other setting.';

-- 2. Saved copies of the forms, in case email fails.
create table if not exists public.contact_submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (
    char_length(email) between 3 and 320
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  subject text not null default '' check (char_length(subject) <= 200),
  message text not null check (char_length(message) between 1 and 5000),
  email_sent boolean not null default false,
  email_error text check (email_error is null or char_length(email_error) <= 500),
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.job_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 200),
  email text not null check (
    char_length(email) between 3 and 320
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  phone text not null check (char_length(phone) between 7 and 30),
  city text not null check (char_length(city) between 1 and 80),
  state text not null check (char_length(state) between 1 and 80),
  position text not null check (char_length(position) between 1 and 200),
  website_url text not null default '' check (char_length(website_url) <= 500),
  resume_path text not null check (
    char_length(resume_path) between 1 and 300
    and resume_path !~ '\.\.'
    and resume_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9._-]{0,89}$'
  ),
  cover_letter text not null check (char_length(cover_letter) between 1 and 5000),
  heard_about text not null default '' check (char_length(heard_about) <= 200),
  consent boolean not null check (consent),
  email_sent boolean not null default false,
  email_error text check (email_error is null or char_length(email_error) <= 500),
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.form_attempts (
  id bigint generated always as identity primary key,
  form text not null check (form in ('contact', 'job')),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists form_attempts_lookup_idx
  on public.form_attempts (form, ip_hash, created_at desc);

create index if not exists contact_submissions_created_idx
  on public.contact_submissions (created_at desc);

create index if not exists job_applications_created_idx
  on public.job_applications (created_at desc);

alter table public.contact_submissions enable row level security;
alter table public.job_applications enable row level security;
alter table public.form_attempts enable row level security;

drop policy if exists "Admins can read contact submissions" on public.contact_submissions;
create policy "Admins can read contact submissions"
  on public.contact_submissions for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Anyone can submit a contact message" on public.contact_submissions;
create policy "Anyone can submit a contact message"
  on public.contact_submissions for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Admins can read job applications" on public.job_applications;
create policy "Admins can read job applications"
  on public.job_applications for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Anyone can submit a job application" on public.job_applications;
create policy "Anyone can submit a job application"
  on public.job_applications for insert
  to anon, authenticated
  with check (consent is true);

revoke all on table public.contact_submissions from public, anon, authenticated;
revoke all on table public.job_applications from public, anon, authenticated;
revoke all on table public.form_attempts from public, anon, authenticated;

grant insert on table public.contact_submissions to anon, authenticated;
grant select on table public.contact_submissions to authenticated;
grant insert on table public.job_applications to anon, authenticated;
grant select on table public.job_applications to authenticated;

comment on table public.contact_submissions is
  'Backup copy of contact-form messages. Visitors can insert. Only admins can read.';
comment on table public.job_applications is
  'Backup copy of job applications, including the private resume path. Visitors can insert. Only admins can read.';

-- Records one attempt and returns true when the caller is still under the
-- hourly limit (5 contact, 3 job). Returns false when they are over the limit
-- or the arguments are not usable. Does not return attempt rows.
-- A site-wide cap stops someone from filling the table with random hashes.
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

revoke all on function public.record_form_attempt(text, text) from public;
grant execute on function public.record_form_attempt(text, text) to anon, authenticated;

comment on function public.record_form_attempt(text, text) is
  'Counts a contact or job attempt for a hashed IP. Returns whether it is still allowed. Does not return stored rows.';

-- 3. Private bucket for resumes. 5 MB. PDF, DOC, and DOCX only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can upload a resume" on storage.objects;
create policy "Anyone can upload a resume"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'resumes'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9._-]{0,89}$'
  );

drop policy if exists "Admins can read resumes" on storage.objects;
create policy "Admins can read resumes"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'resumes' and public.is_admin());

-- An earlier draft of this file kept upload tickets. The site no longer uses them.
drop table if exists public.resume_uploads;
