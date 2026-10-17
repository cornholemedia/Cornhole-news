-- Account bans and a reserved admin username.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run this after supabase/migrations/20261016_digest_trade_industry.sql.
--
-- is_banned is not a column a visitor can update. Admins change it through
-- set_profile_banned(). A banned account cannot insert a post, comment, or vote.
-- Re-running older admin files no longer promotes username Cornhole_Admin.
-- That username can still be created from the SQL editor. Public signup cannot
-- take it. If you re-run supabase/migrations/20260923_editable_pages.sql after
-- this file, run this file again so the is_banned guard is restored.

alter table public.profiles
  add column if not exists is_banned boolean not null default false;

comment on column public.profiles.is_banned is
  'When true, this account cannot post, comment, or vote. Only an admin can change it.';

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
    if coalesce(new.is_banned, false) and auth.uid() is not null and not public.is_admin() then
      new.is_banned := false;
    end if;
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an existing admin, or the Supabase SQL editor, can change is_admin';
  end if;

  if new.is_banned is distinct from old.is_banned
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an existing admin, or the Supabase SQL editor, can change is_banned';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_admin_flag() from public, anon;
grant execute on function public.protect_profile_admin_flag() to authenticated, service_role;

create or replace function public.set_profile_banned(p_user_id uuid, p_banned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_user_id is null or p_banned is null then
    raise exception 'not allowed' using errcode = '22023';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot ban your own account.' using errcode = '42501';
  end if;

  update public.profiles
  set is_banned = p_banned
  where id = p_user_id;

  if not found then
    raise exception 'That account was not found.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.set_profile_banned(uuid, boolean) from public, anon;
grant execute on function public.set_profile_banned(uuid, boolean) to authenticated;

comment on function public.set_profile_banned(uuid, boolean) is
  'Admin only. Sets profiles.is_banned. An admin cannot ban their own account.';

-- Public signup runs as supabase_auth_admin. The SQL editor runs as postgres
-- or supabase_admin and can still create this username for the real operator.
create or replace function public.reserve_cornhole_admin_username()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if lower(btrim(new.username)) is distinct from 'cornhole_admin' then
    return new;
  end if;

  if tg_op = 'UPDATE' and lower(btrim(old.username)) = 'cornhole_admin' then
    return new;
  end if;

  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  raise exception 'That username is reserved.' using errcode = '42501';
end;
$$;

revoke all on function public.reserve_cornhole_admin_username() from public, anon;
grant execute on function public.reserve_cornhole_admin_username() to authenticated, service_role;

drop trigger if exists profiles_reserve_admin_username on public.profiles;
create trigger profiles_reserve_admin_username
  before insert or update on public.profiles
  for each row execute procedure public.reserve_cornhole_admin_username();

drop policy if exists "Logged-in users can create posts" on public.posts;
create policy "Logged-in users can create posts"
  on public.posts for insert
  with check (
    auth.uid() = author_id
    and not coalesce((select p.is_banned from public.profiles p where p.id = auth.uid()), false)
  );

drop policy if exists "Logged-in users can comment" on public.comments;
create policy "Logged-in users can comment"
  on public.comments for insert
  with check (
    auth.uid() = author_id
    and not coalesce((select p.is_banned from public.profiles p where p.id = auth.uid()), false)
  );

drop policy if exists "Logged-in users can vote" on public.votes;
create policy "Logged-in users can vote"
  on public.votes for insert
  with check (
    auth.uid() = user_id
    and not coalesce((select p.is_banned from public.profiles p where p.id = auth.uid()), false)
  );
