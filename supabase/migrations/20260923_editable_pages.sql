-- Editable About / Jobs / Advertise pages, and a lock on profiles.is_admin.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
--
-- Mark a site admin (SQL editor only — the API cannot change this flag):
--   update public.profiles set is_admin = true where username = 'your_username';

-- 1. Keep is_admin from being self-assigned through the public API.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

create or replace function public.protect_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.is_admin, false) and auth.uid() is not null and not public.is_admin() then
      new.is_admin := false;
    end if;
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an existing admin, or the Supabase SQL editor, can change is_admin';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_admin_flag() from public;

-- Promote the known admin before the guard trigger exists, so the first run
-- does not depend on there already being an admin JWT.
update public.profiles
set is_admin = true
where username = 'Cornhole_Admin';

drop trigger if exists profiles_protect_admin_flag on public.profiles;
create trigger profiles_protect_admin_flag
  before insert or update on public.profiles
  for each row execute procedure public.protect_profile_admin_flag();

revoke update on table public.profiles from anon, authenticated;
grant update (username) on table public.profiles to authenticated;
revoke insert on table public.profiles from anon, authenticated;
grant insert (id, username) on table public.profiles to authenticated;

-- 2. Static page content. Public read; only is_admin can write (see policies).
create table if not exists public.pages (
  slug text primary key check (slug in ('about', 'jobs', 'advertise')),
  title text not null check (char_length(title) between 1 and 200),
  subtitle text not null default '' check (char_length(subtitle) <= 400),
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.pages enable row level security;

drop policy if exists "Pages are viewable by everyone" on public.pages;
create policy "Pages are viewable by everyone"
  on public.pages for select
  using (true);

drop policy if exists "Admins can insert pages" on public.pages;
create policy "Admins can insert pages"
  on public.pages for insert
  with check (public.is_admin());

drop policy if exists "Admins can update pages" on public.pages;
create policy "Admins can update pages"
  on public.pages for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete pages" on public.pages;
create policy "Admins can delete pages"
  on public.pages for delete
  using (public.is_admin());

create or replace function public.touch_page_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.touch_page_row() from public;

drop trigger if exists pages_touch_row on public.pages;
create trigger pages_touch_row
  before insert or update on public.pages
  for each row execute procedure public.touch_page_row();

grant select on public.pages to anon, authenticated;
grant insert, update, delete on public.pages to authenticated;

insert into public.pages (slug, title, subtitle, body)
values
  (
    'about',
    'About Cornhole News',
    '',
    $about$Cornhole News is a community-driven site for news, discussion, and everything related to the game of cornhole.

Whether you play in your backyard, compete in local leagues, or follow the professional tours, this is a place to share links, ask questions, and talk about the game.

The site is inspired by classic link aggregators and is built to stay simple, fast, and focused on the content.$about$
  ),
  (
    'jobs',
    'Jobs',
    'Cornhole-related job openings and opportunities.',
    $jobs$## No jobs posted yet

note: Check back later, or [contact us](/advertise) if you'd like to post a position.$jobs$
  ),
  (
    'advertise',
    'Advertise on Cornhole News',
    'Reach an engaged audience of cornhole players, fans, league organizers, and gear enthusiasts.',
    $advertise$## Ad Placements

- **Sidebar 300×250** — Standard medium rectangle
- **Sidebar 300×600** — Tall skyscraper unit

Interested in advertising? Reach out and we'll get back to you with rates and availability.

note: (Contact form / email will be added here once the site is live.)$advertise$
  )
on conflict (slug) do nothing;
