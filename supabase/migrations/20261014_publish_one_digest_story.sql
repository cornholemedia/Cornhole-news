-- Publish one digest story at a time.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/migrations/20261013_digest_stories.sql first.
--
-- The review page used to publish every pending story for a date. It now
-- publishes the one story whose button you clicked. This function locks that
-- row, creates a single posts row (same title, link, text, and Cornhole News
-- author as before), and marks the queue row published. A second call for a
-- story that is already published returns the existing post and does not
-- insert another one.
--
-- The older publish_digest_stories(date) function is left in place. The site
-- no longer calls it.

do $$
begin
  if to_regclass('public.digest_stories') is null then
    raise exception 'Run supabase/migrations/20261013_digest_stories.sql first.';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing. Run the earlier admin migration first.';
  end if;
end $$;

create or replace function public.publish_digest_story(p_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  bot_id uuid;
  story public.digest_stories%rowtype;
  new_post_id bigint;
  updated_rows bigint := 0;
begin
  if p_id is null then
    raise exception 'digest: That story could not be found.' using errcode = '22023';
  end if;

  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- Same-story calls wait here, then see the published row instead of
  -- inserting a second post.
  perform pg_advisory_xact_lock(845114, hashtext(p_id::text));

  select * into story
  from public.digest_stories
  where id = p_id
  for update;

  if not found then
    raise exception 'digest: That story could not be found.' using errcode = '22023';
  end if;

  if story.status = 'published' then
    if story.post_id is null then
      raise exception 'digest: That story was already published.' using errcode = '22023';
    end if;
    return story.post_id;
  end if;

  if story.status is distinct from 'pending' then
    raise exception 'digest: That story is no longer waiting.' using errcode = '22023';
  end if;

  select id into bot_id
  from public.profiles
  where username = 'Cornhole News';

  if bot_id is null then
    raise exception 'digest: The Cornhole News author profile does not exist yet. Create that user, then publish. Steps are at the top of supabase/migrations/20261013_digest_stories.sql.'
      using errcode = '22023';
  end if;

  insert into public.posts (title, url, body, author_id, is_political)
  values (
    story.headline,
    story.url,
    story.synopsis || ' — ' || story.paper || ', ' || story.state,
    bot_id,
    false
  )
  returning id into new_post_id;

  update public.digest_stories
  set status = 'published',
      post_id = new_post_id
  where id = story.id
    and status = 'pending';
  get diagnostics updated_rows = row_count;

  if updated_rows <> 1 then
    raise exception 'digest: That story changed while it was being published. Nothing was published.'
      using errcode = '40001';
  end if;

  return new_post_id;
end;
$$;

revoke all on function public.publish_digest_story(uuid) from public, anon, service_role;
grant execute on function public.publish_digest_story(uuid) to authenticated;

comment on function public.publish_digest_story(uuid) is
  'Admin only. Publishes one pending digest story as a non-political Cornhole News post. A repeat call returns the existing post id.';
