-- Midwest job board.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/migrations/20261008_newsletter_subscribers.sql first.
--
-- This does not remove job_applications, the resumes bucket, or any saved
-- applications. The website simply stops using that form.
--
-- The website uses the anon key only. It does not need the service role key.
-- Anyone can insert a pending job. They cannot publish it themselves, and
-- they cannot read it back. The public can read approved jobs that have not
-- expired, and only through job_postings_public, which leaves out the
-- poster's name and email. Admins (public.is_admin()) can read, update, and
-- delete every row, including the private contact fields.
--
-- Posting is free. listing_fee_cents and payment_status are reserved so a
-- paid listing can be added later. Public inserts cannot set them.
-- Applying this file before the new website is deployed does not change the
-- contact form, the old job-application form, or newsletter signups.

do $$
begin
  if to_regclass('public.form_attempts') is null then
    raise exception 'Run supabase/migrations/20261008_newsletter_subscribers.sql first.';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing. Run the earlier admin migration first.';
  end if;
end $$;

-- 1. Job postings. Private contact columns live on the same row, but the
-- public API is not granted permission to read them.
create table if not exists public.job_postings (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null check (
    char_length(title) between 1 and 200
    and title !~ '[[:cntrl:]]'
  ),
  company_name text not null check (
    char_length(company_name) between 1 and 200
    and company_name !~ '[[:cntrl:]]'
  ),
  company_website text check (
    company_website is null
    or (
      char_length(company_website) between 8 and 500
      and company_website ~* '^https?://'
      and company_website !~ '[[:cntrl:][:space:]]'
    )
  ),
  city text not null check (
    char_length(city) between 1 and 80
    and city !~ '[[:cntrl:]]'
  ),
  state text not null check (state in (
    'IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'
  )),
  work_type text not null check (work_type in ('on_site', 'hybrid', 'remote')),
  employment_type text not null check (
    employment_type in ('full_time', 'part_time', 'contract', 'temporary', 'internship')
  ),
  pay_min numeric(10, 2) check (pay_min is null or (pay_min >= 0 and pay_min <= 99999999.99)),
  pay_max numeric(10, 2) check (pay_max is null or (pay_max >= 0 and pay_max <= 99999999.99)),
  pay_period text check (
    pay_period is null or pay_period in ('hour', 'day', 'week', 'month', 'year')
  ),
  pay_note text not null default '' check (
    char_length(pay_note) <= 300
    and pay_note !~ '[[:cntrl:]]'
  ),
  description text not null check (char_length(description) between 40 and 8000),
  apply_url text check (
    apply_url is null
    or (
      char_length(apply_url) between 8 and 500
      and apply_url ~* '^https?://'
      and apply_url !~ '[[:cntrl:][:space:]]'
    )
  ),
  apply_email text check (
    apply_email is null
    or (
      char_length(apply_email) between 3 and 320
      and apply_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  poster_name text not null check (
    char_length(poster_name) between 1 and 200
    and poster_name !~ '[[:cntrl:]]'
  ),
  poster_email text not null check (
    char_length(poster_email) between 3 and 320
    and poster_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  terms_accepted boolean not null check (terms_accepted),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  expires_at timestamptz,
  listing_fee_cents integer not null default 0 check (
    listing_fee_cents >= 0 and listing_fee_cents <= 100000000
  ),
  payment_status text not null default 'not_required' check (
    payment_status in ('not_required', 'unpaid', 'paid', 'refunded', 'waived')
  ),
  email_sent boolean not null default false,
  email_error text check (email_error is null or char_length(email_error) <= 500),
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_postings_pay_range_check check (
    pay_min is null or pay_max is null or pay_max >= pay_min
  ),
  constraint job_postings_pay_needs_period_check check (
    (pay_min is null and pay_max is null) or pay_period is not null
  ),
  constraint job_postings_pay_amount_check check (
    pay_period is null or pay_min is not null or pay_max is not null
  ),
  constraint job_postings_apply_check check (
    apply_url is not null or apply_email is not null
  )
);

create index if not exists job_postings_created_idx
  on public.job_postings (created_at desc);

create index if not exists job_postings_approved_idx
  on public.job_postings (state, expires_at desc)
  where status = 'approved';

alter table public.job_postings enable row level security;

drop policy if exists "Anyone can submit a pending job posting" on public.job_postings;
create policy "Anyone can submit a pending job posting"
  on public.job_postings for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and approved_at is null
    and expires_at is null
    and terms_accepted is true
    and listing_fee_cents = 0
    and payment_status = 'not_required'
  );

drop policy if exists "Anyone can read approved current job postings" on public.job_postings;
create policy "Anyone can read approved current job postings"
  on public.job_postings for select
  to anon, authenticated
  using (
    status = 'approved'
    and expires_at > now()
  );

drop policy if exists "Admins can read every job posting" on public.job_postings;
create policy "Admins can read every job posting"
  on public.job_postings for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can update job postings" on public.job_postings;
create policy "Admins can update job postings"
  on public.job_postings for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete job postings" on public.job_postings;
create policy "Admins can delete job postings"
  on public.job_postings for delete
  to authenticated
  using ((select public.is_admin()));

comment on table public.job_postings is
  'Midwest job board. Visitors insert pending rows. The public reads approved, unexpired rows without the poster contact. Admins can read, update, and delete everything.';

comment on column public.job_postings.poster_name is
  'Private. Admins only. Never shown on the public job page.';
comment on column public.job_postings.poster_email is
  'Private. Admins only. Never shown on the public job page.';
comment on column public.job_postings.expires_at is
  'When the public listing ends. Defaults to 30 days after approval.';
comment on column public.job_postings.listing_fee_cents is
  'Reserved for a future paid listing. Public posts are forced to 0. Do not charge anyone yet.';
comment on column public.job_postings.payment_status is
  'Reserved for a future paid listing. Public posts are forced to not_required.';

-- A visitor cannot choose the status, the dates, or a fee. An admin update
-- sets a 30-day expiry the first time a job is approved, unless a future
-- expiry was already chosen.
create or replace function public.guard_job_posting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if not (select public.is_admin()) then
      raise exception 'Only an admin can change a job posting';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.approved_at := null;
    new.expires_at := null;
    new.listing_fee_cents := 0;
    new.payment_status := 'not_required';
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if not (select public.is_admin()) then
    raise exception 'Only an admin can change a job posting';
  end if;

  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();

  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_at := now();
    if new.expires_at is null or new.expires_at <= now() then
      new.expires_at := now() + interval '30 days';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_job_posting() from public;
grant execute on function public.guard_job_posting() to anon, authenticated;

drop trigger if exists job_postings_guard on public.job_postings;
create trigger job_postings_guard
  before insert or update or delete on public.job_postings
  for each row execute procedure public.guard_job_posting();

-- Returns every column, including the private contact, and only to an admin.
create or replace function public.admin_job_postings()
returns setof public.job_postings
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
    select *
    from public.job_postings
    order by
      case status
        when 'pending' then 0
        when 'approved' then 1
        else 2
      end,
      created_at desc;
end;
$$;

revoke all on function public.admin_job_postings() from public;
grant execute on function public.admin_job_postings() to authenticated;

comment on function public.admin_job_postings() is
  'Admin-only list of job postings, including the private poster contact. Returns nothing to anyone else.';

-- Public read model. security_invoker keeps the table's row policies in
-- force. The column list is the second lock on the private contact fields.
create or replace view public.job_postings_public
with (security_invoker = true, security_barrier = true) as
select
  id,
  title,
  company_name,
  company_website,
  city,
  state,
  work_type,
  employment_type,
  pay_min,
  pay_max,
  pay_period,
  pay_note,
  description,
  apply_url,
  apply_email,
  approved_at,
  expires_at,
  created_at,
  updated_at
from public.job_postings
where status = 'approved'
  and expires_at > now();

comment on view public.job_postings_public is
  'Approved Midwest jobs that have not expired. Does not include the poster name or email.';

revoke all on table public.job_postings from public, anon, authenticated;
revoke all on table public.job_postings_public from public, anon, authenticated;

grant insert (
  title,
  company_name,
  company_website,
  city,
  state,
  work_type,
  employment_type,
  pay_min,
  pay_max,
  pay_period,
  pay_note,
  description,
  apply_url,
  apply_email,
  poster_name,
  poster_email,
  terms_accepted,
  email_sent,
  email_error,
  ip_hash
) on table public.job_postings to anon, authenticated;

grant select (
  id,
  title,
  company_name,
  company_website,
  city,
  state,
  work_type,
  employment_type,
  pay_min,
  pay_max,
  pay_period,
  pay_note,
  description,
  apply_url,
  apply_email,
  status,
  approved_at,
  expires_at,
  created_at,
  updated_at
) on table public.job_postings to anon, authenticated;

grant update, delete on table public.job_postings to authenticated;
grant select on table public.job_postings_public to anon, authenticated;

-- 2. Let the shared rate limiter count job-board attempts.
-- contact, job, and newsletter stay allowed so the current site keeps working.
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
      and pg_get_constraintdef(con.oid) ilike '%job%'
  loop
    execute format('alter table public.form_attempts drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.form_attempts drop constraint if exists form_attempts_form_check;

alter table public.form_attempts
  add constraint form_attempts_form_check
  check (form in ('contact', 'job', 'newsletter', 'job_posting'));

-- Records one attempt and returns true when the caller is still under the
-- hourly limit (5 contact, 3 job, 5 newsletter, 3 job_posting). Returns false
-- when they are over the limit or the arguments are not usable. Does not
-- return attempt rows. A site-wide cap stops someone from filling the table
-- with random hashes.
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
  'Counts a contact, job, newsletter, or job-posting attempt for a hashed IP. Returns whether it is still allowed. Does not return stored rows.';
