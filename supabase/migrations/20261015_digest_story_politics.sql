-- Politics flag on digest stories, and delete every story still waiting for a date.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/migrations/20261014_publish_one_digest_story.sql first.
--
-- Each queue row stores is_political (default false). Publishing copies that
-- value onto the new posts row. Changing it on a story that is already
-- published updates the linked post. A later ingest does not clear the flag:
-- the ingest update only rewrites section, headline, paper, state, and synopsis.
--
-- delete_pending_digest_stories marks every still-pending row for one date
-- deleted. Published rows are left alone.

do $$
begin
  if to_regclass('public.digest_stories') is null then
    raise exception 'Run supabase/migrations/20261013_digest_stories.sql first.';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing. Run the earlier admin migration first.';
  end if;
  if to_regprocedure('public.publish_digest_story(uuid)') is null then
    raise exception 'Run supabase/migrations/20261014_publish_one_digest_story.sql first.';
  end if;
end $$;

alter table public.digest_stories
  add column if not exists is_political boolean not null default false;

comment on column public.digest_stories.is_political is
  'Copied onto the post at publish time. On a published story, matches the linked post. Default false. A later ingest does not clear it.';

-- Same as 20261014, except the new post uses the story flag instead of false.
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
  -- inserting a second post. The politics toggle uses this same lock.
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
    story.is_political
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
  'Admin only. Publishes one pending digest story as a Cornhole News post, using the story Politics flag. A repeat call returns the existing post id.';

-- The review page no longer calls this. Keep it aligned so a leftover call
-- still copies each story's Politics flag.
create or replace function public.publish_digest_stories(p_digest_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  bot_id uuid;
  story record;
  new_post_id bigint;
  published_count integer := 0;
  updated_rows bigint := 0;
  v_created timestamptz;
begin
  if p_digest_date is null then
    raise exception 'digest: Choose a digest date.' using errcode = '22023';
  end if;

  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select id into bot_id
  from public.profiles
  where username = 'Cornhole News';

  if bot_id is null then
    raise exception 'digest: The Cornhole News author profile does not exist yet. Create that user, then publish. Steps are at the top of supabase/migrations/20261013_digest_stories.sql.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(845113, hashtext(p_digest_date::text));

  for story in
    select id, headline, url, paper, state, synopsis, is_political
    from public.digest_stories
    where digest_date = p_digest_date
      and status = 'pending'
    order by
      case section
        when 'QUIRKY' then 1
        when 'SERIOUS' then 2
        when 'AROUND THE MIDWEST' then 3
        when 'NATIONAL PRESS' then 4
        else 5
      end desc,
      created_at desc,
      id desc
    limit 500
    for update
  loop
    published_count := published_count + 1;
    v_created := transaction_timestamp() + (published_count * interval '1 millisecond');

    insert into public.posts (title, url, body, author_id, is_political, created_at)
    values (
      story.headline,
      story.url,
      story.synopsis || ' — ' || story.paper || ', ' || story.state,
      bot_id,
      story.is_political,
      v_created
    )
    returning id into new_post_id;

    update public.digest_stories
    set status = 'published',
        post_id = new_post_id
    where id = story.id
      and status = 'pending';
    get diagnostics updated_rows = row_count;

    if updated_rows <> 1 then
      raise exception 'digest: A story changed while it was being published. Nothing was published.'
        using errcode = '40001';
    end if;
  end loop;

  return published_count;
end;
$$;

revoke all on function public.publish_digest_stories(date) from public, anon, service_role;
grant execute on function public.publish_digest_stories(date) to authenticated;

comment on function public.publish_digest_stories(date) is
  'Admin only. Unused by the site. Publishes pending stories for a date as Cornhole News, copying each story Politics flag.';

create or replace function public.set_digest_story_politics(p_id uuid, p_is_political boolean)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  story public.digest_stories%rowtype;
  updated_rows bigint := 0;
begin
  if p_id is null or p_is_political is null then
    raise exception 'digest: That story could not be found.' using errcode = '22023';
  end if;

  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(845114, hashtext(p_id::text));

  select * into story
  from public.digest_stories
  where id = p_id
  for update;

  if not found then
    raise exception 'digest: That story could not be found.' using errcode = '22023';
  end if;

  if story.status = 'deleted' then
    raise exception 'digest: That story was deleted.' using errcode = '22023';
  end if;

  if story.status not in ('pending', 'published') then
    raise exception 'digest: That story is no longer waiting.' using errcode = '22023';
  end if;

  update public.digest_stories
  set is_political = p_is_political
  where id = story.id
    and status = story.status;
  get diagnostics updated_rows = row_count;

  if updated_rows <> 1 then
    raise exception 'digest: That story changed while it was being saved. Nothing was saved.'
      using errcode = '40001';
  end if;

  if story.status = 'published' and story.post_id is not null then
    update public.posts
    set is_political = p_is_political
    where id = story.post_id;
    get diagnostics updated_rows = row_count;

    if updated_rows <> 1 then
      raise exception 'digest: That post is no longer on the site.' using errcode = '22023';
    end if;

    return story.post_id;
  end if;

  return null;
end;
$$;

revoke all on function public.set_digest_story_politics(uuid, boolean) from public, anon, service_role;
grant execute on function public.set_digest_story_politics(uuid, boolean) to authenticated;

comment on function public.set_digest_story_politics(uuid, boolean) is
  'Admin only. Saves the Politics flag on one digest story. If that story is already published, updates the linked post. Returns the post id, or null when there is no post yet.';

create or replace function public.delete_pending_digest_stories(p_digest_date date)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_rows bigint := 0;
begin
  if p_digest_date is null then
    raise exception 'digest: Choose a digest date.' using errcode = '22023';
  end if;

  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(845115, hashtext(p_digest_date::text));

  update public.digest_stories
  set status = 'deleted'
  where digest_date = p_digest_date
    and status = 'pending';
  get diagnostics deleted_rows = row_count;

  return deleted_rows;
end;
$$;

revoke all on function public.delete_pending_digest_stories(date) from public, anon, service_role;
grant execute on function public.delete_pending_digest_stories(date) to authenticated;

comment on function public.delete_pending_digest_stories(date) is
  'Admin only. Marks every still-pending digest story for that date deleted. Published rows stay published.';
