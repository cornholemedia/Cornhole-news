-- Post rate limits apply to signed-in and anonymous writers only.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/migrations/20261017_content_guards.sql first.
--
-- publish_digest_story() is security definer and inserts as its owner, so
-- current_user is postgres (or supabase_admin), not authenticated. The
-- per-author caps were outside that check and stopped the Cornhole News bot
-- after 6 publishes. Those caps now sit with the created_at override.
-- The ban check still applies to every insert.
--
-- Comments are inserted by the signed-in author. No security-definer path
-- writes them, so guard_comment_write() is left unchanged.
-- If 20261017_content_guards.sql is re-run, run this file again.

do $$
begin
  if to_regprocedure('public.guard_post_write()') is null then
    raise exception 'Run supabase/migrations/20261017_content_guards.sql first.';
  end if;
end $$;

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
  end if;

  return new;
end;
$$;

revoke all on function public.guard_post_write() from public, anon;
grant execute on function public.guard_post_write() to authenticated, service_role;
