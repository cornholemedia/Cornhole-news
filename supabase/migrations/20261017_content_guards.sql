-- Post shape checks, frozen created_at, and per-user write limits.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/migrations/20261017_user_bans.sql first.
--
-- Posts
--   6 per account per hour, 20 per account per day
-- Comments
--   30 per account per hour, 200 per account per day
-- A normal account cannot choose created_at. Digest publish runs as the
-- migration owner and may still set it. Banned accounts are rejected here
-- as well as by the insert policies.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_banned'
  ) then
    raise exception 'Run supabase/migrations/20261017_user_bans.sql first.';
  end if;
end $$;

update public.posts
set url = left(url, 2000)
where url is not null and char_length(url) > 2000;

update public.posts
set url = null
where url is not null
  and (
    char_length(btrim(url)) < 8
    or url !~* '^https?://[^[:space:][:cntrl:]]+$'
    or url ~* '^https?://[^/?#]*@'
  );

update public.posts
set body = left(body, 10000)
where body is not null and char_length(body) > 10000;

update public.posts
set body = null
where body is not null and btrim(body) = '';

alter table public.posts drop constraint if exists posts_url_format_check;
alter table public.posts
  add constraint posts_url_format_check check (
    url is null
    or (
      char_length(url) between 8 and 2000
      and url ~* '^https?://[^[:space:][:cntrl:]]+$'
      and url !~* '^https?://[^/?#]*@'
    )
  );

alter table public.posts drop constraint if exists posts_body_length_check;
alter table public.posts
  add constraint posts_body_length_check check (
    body is null
    or char_length(body) between 1 and 10000
  );

create index if not exists posts_author_created_idx
  on public.posts (author_id, created_at desc);

create index if not exists comments_author_created_idx
  on public.comments (author_id, created_at desc);

create or replace function public.guard_post_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  recent_count integer;
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
    if current_user in ('authenticated', 'anon') and not public.is_admin() then
      new.author_id := old.author_id;
    end if;
    return new;
  end if;

  if exists (
    select 1 from public.profiles p where p.id = new.author_id and p.is_banned
  ) then
    raise exception 'This account is suspended.' using errcode = '42501';
  end if;

  if current_user in ('authenticated', 'anon') then
    new.created_at := now();
  end if;

  select count(*) into recent_count
  from public.posts
  where author_id = new.author_id
    and created_at > now() - interval '1 hour';

  if recent_count >= 6 then
    raise exception 'You have submitted several stories recently. Please wait about an hour and try again.';
  end if;

  select count(*) into recent_count
  from public.posts
  where author_id = new.author_id
    and created_at > now() - interval '1 day';

  if recent_count >= 20 then
    raise exception 'You have submitted too many stories today. Please try again tomorrow.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_post_write() from public, anon;
grant execute on function public.guard_post_write() to authenticated, service_role;

drop trigger if exists posts_guard_write on public.posts;
create trigger posts_guard_write
  before insert or update on public.posts
  for each row execute procedure public.guard_post_write();

create or replace function public.guard_comment_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  recent_count integer;
begin
  if exists (
    select 1 from public.profiles p where p.id = new.author_id and p.is_banned
  ) then
    raise exception 'This account is suspended.' using errcode = '42501';
  end if;

  select count(*) into recent_count
  from public.comments
  where author_id = new.author_id
    and created_at > now() - interval '1 hour';

  if recent_count >= 30 then
    raise exception 'You have posted several comments recently. Please wait about an hour and try again.';
  end if;

  select count(*) into recent_count
  from public.comments
  where author_id = new.author_id
    and created_at > now() - interval '1 day';

  if recent_count >= 200 then
    raise exception 'You have posted too many comments today. Please try again tomorrow.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_comment_write() from public, anon;
grant execute on function public.guard_comment_write() to authenticated, service_role;

drop trigger if exists comments_guard_write on public.comments;
create trigger comments_guard_write
  before insert on public.comments
  for each row execute procedure public.guard_comment_write();

create or replace function public.guard_vote_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1 from public.profiles p where p.id = new.user_id and p.is_banned
  ) then
    raise exception 'This account is suspended.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_vote_write() from public, anon;
grant execute on function public.guard_vote_write() to authenticated, service_role;

drop trigger if exists votes_guard_write on public.votes;
create trigger votes_guard_write
  before insert on public.votes
  for each row execute procedure public.guard_vote_write();
