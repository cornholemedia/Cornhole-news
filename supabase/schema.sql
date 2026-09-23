-- Cornhole News database schema
-- Paste this whole file into Supabase Dashboard -> SQL Editor -> New query -> Run

-- 1. Profiles table (one row per signed-up user, linked to Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- is_admin is not a self-serve flag. The API can update username only.
-- Promote someone from the SQL editor:
--   update public.profiles set is_admin = true where username = 'your_username';
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

drop trigger if exists profiles_protect_admin_flag on public.profiles;
create trigger profiles_protect_admin_flag
  before insert or update on public.profiles
  for each row execute procedure public.protect_profile_admin_flag();

update public.profiles
set is_admin = true
where username = 'Cornhole_Admin';

revoke update on table public.profiles from anon, authenticated;
grant update (username) on table public.profiles to authenticated;
revoke insert on table public.profiles from anon, authenticated;
grant insert (id, username) on table public.profiles to authenticated;

-- Auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Posts table
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 300),
  url text,
  body text,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "Posts are viewable by everyone"
  on public.posts for select
  using (true);

create policy "Logged-in users can create posts"
  on public.posts for insert
  with check (auth.uid() = author_id);

create policy "Authors can delete their own posts"
  on public.posts for delete
  using (auth.uid() = author_id);

-- 3. Votes table (one vote per user per post)
create table if not exists public.votes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.votes enable row level security;

create policy "Votes are viewable by everyone"
  on public.votes for select
  using (true);

create policy "Logged-in users can vote"
  on public.votes for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own vote"
  on public.votes for delete
  using (auth.uid() = user_id);

-- 4. Comments table
create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "Comments are viewable by everyone"
  on public.comments for select
  using (true);

create policy "Logged-in users can comment"
  on public.comments for insert
  with check (auth.uid() = author_id);

create policy "Authors can delete their own comments"
  on public.comments for delete
  using (auth.uid() = author_id);


-- Authors can update their own posts; admins can update/delete any post
create policy "Authors can update their own posts"
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "Admins can update any post"
  on public.posts for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy "Admins can delete any post"
  on public.posts for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy "Admins can delete any comment"
  on public.comments for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- 5. A view that joins posts with vote counts, comment counts, and author name
-- (This is what the homepage/new page actually query.)
create or replace view public.posts_with_stats with (security_invoker = true) as
select
  p.id,
  p.title,
  p.url,
  p.body,
  p.created_at,
  p.author_id,
  pr.username as author_username,
  coalesce(v.vote_count, 0) as points,
  coalesce(c.comment_count, 0) as comment_count
from public.posts p
join public.profiles pr on pr.id = p.author_id
left join (
  select post_id, count(*) as vote_count from public.votes group by post_id
) v on v.post_id = p.id
left join (
  select post_id, count(*) as comment_count from public.comments group by post_id
) c on c.post_id = p.id;

-- 6. Editable static pages (About, Jobs, Advertise)
create table if not exists public.pages (
  slug text primary key check (slug in ('about', 'jobs', 'advertise')),
  title text not null check (char_length(title) between 1 and 200),
  subtitle text not null default '' check (char_length(subtitle) <= 400),
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.pages enable row level security;

create policy "Pages are viewable by everyone"
  on public.pages for select
  using (true);

create policy "Admins can insert pages"
  on public.pages for insert
  with check (public.is_admin());

create policy "Admins can update pages"
  on public.pages for update
  using (public.is_admin())
  with check (public.is_admin());

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
