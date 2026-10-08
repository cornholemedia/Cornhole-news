-- Newsletter signups from the site footer.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/migrations/20261007_forms_and_settings.sql first. This file
-- extends record_form_attempt() and the form_attempts check from that file.
--
-- The website uses the anon key only. It does not need the service role key.
-- Visitors can insert a subscription. They cannot read, update, or delete
-- those rows. Signed-in admins can, using public.is_admin().
-- Emails are stored in lowercase. A unique index on lower(email) blocks
-- the same address with different capitalization. The app treats that
-- conflict as a successful signup instead of showing an error.
-- Rate limits go through record_form_attempt(), which records a hashed IP
-- and returns true or false. It does not return other people's rows.

-- 1. Saved subscribers.
create table if not exists public.newsletter_subscribers (
  id uuid primary key default extensions.gen_random_uuid(),
  email text not null check (
    char_length(email) between 3 and 320
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  source text not null default '' check (
    char_length(source) <= 200
    and source !~ '[[:cntrl:]]'
  ),
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create unique index if not exists newsletter_subscribers_email_lower_idx
  on public.newsletter_subscribers (lower(email));

create index if not exists newsletter_subscribers_created_idx
  on public.newsletter_subscribers (created_at desc);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "Anyone can join the newsletter" on public.newsletter_subscribers;
create policy "Anyone can join the newsletter"
  on public.newsletter_subscribers for insert
  to anon, authenticated
  with check (status = 'active');

drop policy if exists "Admins can read newsletter subscribers" on public.newsletter_subscribers;
create policy "Admins can read newsletter subscribers"
  on public.newsletter_subscribers for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update newsletter subscribers" on public.newsletter_subscribers;
create policy "Admins can update newsletter subscribers"
  on public.newsletter_subscribers for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete newsletter subscribers" on public.newsletter_subscribers;
create policy "Admins can delete newsletter subscribers"
  on public.newsletter_subscribers for delete
  to authenticated
  using (public.is_admin());

-- Visitors can set the address, the page path, and the IP hash. Status and
-- created_at stay on their defaults unless a trigger normalizes the row.
revoke all on table public.newsletter_subscribers from public, anon, authenticated;
grant insert (email, source, ip_hash) on table public.newsletter_subscribers to anon, authenticated;
grant select, update, delete on table public.newsletter_subscribers to authenticated;

comment on table public.newsletter_subscribers is
  'Footer newsletter signups. Visitors can insert. Only admins can read, update, or delete.';

-- Lowercase the address, and keep a public insert from choosing a status
-- or a timestamp. Admins can still change status afterward.
create or replace function public.normalize_newsletter_subscriber()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := lower(btrim(new.email));
  if tg_op = 'INSERT' then
    new.status := 'active';
    new.created_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.normalize_newsletter_subscriber() from public;
grant execute on function public.normalize_newsletter_subscriber() to anon, authenticated;

drop trigger if exists newsletter_subscribers_normalize on public.newsletter_subscribers;
create trigger newsletter_subscribers_normalize
  before insert or update on public.newsletter_subscribers
  for each row execute procedure public.normalize_newsletter_subscriber();

-- 2. Let the shared rate limiter count newsletter attempts.
-- The old check only allowed contact and job. Drop whichever check that is,
-- then add one that also allows newsletter.
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

alter table public.form_attempts
  add constraint form_attempts_form_check
  check (form in ('contact', 'job', 'newsletter'));

-- Records one attempt and returns true when the caller is still under the
-- hourly limit (5 contact, 3 job, 5 newsletter). Returns false when they are
-- over the limit or the arguments are not usable. Does not return attempt rows.
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
  elsif p_form = 'newsletter' then
    hourly_limit := 5;
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
  'Counts a contact, job, or newsletter attempt for a hashed IP. Returns whether it is still allowed. Does not return stored rows.';
