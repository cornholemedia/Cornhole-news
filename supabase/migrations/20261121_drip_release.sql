-- Scheduled drip release for digest stories.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/migrations/20261120_story_state.sql first.
--
-- Apply this file BEFORE deploying the app that reads publish_at. Applying
-- it while the current app is still live does not hide anything: existing
-- posts keep a null publish_at, and null means already released.
--
-- posts.publish_at is when a story may appear on the public site. Null means
-- there is no drip (reader submissions and every post that already exists).
-- A timestamp in the future stays off the home page, story page, profile,
-- sitemap, and feeds until that time. The public view and row security both
-- enforce that, so the anon API cannot read a story early.
--
-- The site computes the slots and sends them here. This function checks that
-- today's rows still match, then writes the times in one transaction. It
-- caps every time at 2:00 PM America/Chicago. A time that is already due is
-- stored as now(), so the first story is public immediately.
-- Publishing does not send email and does not post to X.
--
-- Release now sets one story's time to now and leaves the others where they
-- are. Unschedule deletes a story that is not public yet and puts the digest
-- row back to pending.
--
-- Hobby cron cannot run every minute. The pages re-read on their own every
-- few minutes, which is what makes a story show up after its slot. A Pro
-- plan could add a per-minute cron that revalidates the public pages; the
-- time filter would stay the source of truth.

do $$
begin
  if to_regclass('public.posts') is null or to_regclass('public.digest_stories') is null then
    raise exception 'Run supabase/migrations/20261013_digest_stories.sql first.';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing. Run the earlier admin migration first.';
  end if;
  if to_regprocedure('public.publish_digest_story(uuid)') is null then
    raise exception 'Run supabase/migrations/20261014_publish_one_digest_story.sql first.';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'state'
  ) then
    raise exception 'Run supabase/migrations/20261120_story_state.sql first.';
  end if;
end $$;

alter table public.posts
  add column if not exists publish_at timestamptz;

comment on column public.posts.publish_at is
  'When this story may appear publicly. Null means already released (older posts and reader submissions). A future time stays hidden until then.';

-- Existing rows keep publish_at null. Do not backfill. Null stays visible,
-- so nothing that is live today disappears.

create index if not exists posts_publish_at_idx
  on public.posts (publish_at)
  where publish_at is not null;

-- Signed-in users can read the column (the review page does). They cannot
-- write it. The security definer functions below are the only writers.
revoke insert (publish_at), update (publish_at) on public.posts from public, anon, authenticated;

create or replace function public.post_is_public(p_publish_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_publish_at is null
    or p_publish_at <= now()
    or public.is_admin();
$$;

revoke all on function public.post_is_public(timestamptz) from public;
grant execute on function public.post_is_public(timestamptz) to anon, authenticated, service_role;

comment on function public.post_is_public(timestamptz) is
  'True when a post may be read: no drip time, a time that has arrived, or the caller is an admin (aal2 once MFA is enrolled).';

drop policy if exists "Posts are viewable by everyone" on public.posts;
drop policy if exists "Released posts are viewable by everyone" on public.posts;
create policy "Released posts are viewable by everyone"
  on public.posts for select
  using (public.post_is_public(publish_at));

-- Comments and votes on a story that is not public yet stay hidden, and
-- nobody can add them. The posts policy already hides the row from readers
-- who are not admins; the time check hides it from admins too.
drop policy if exists "Comments are viewable by everyone" on public.comments;
create policy "Comments are viewable by everyone"
  on public.comments for select
  using (
    exists (
      select 1
      from public.posts p
      where p.id = comments.post_id
        and (p.publish_at is null or p.publish_at <= now())
    )
  );

drop policy if exists "Logged-in users can comment" on public.comments;
create policy "Logged-in users can comment"
  on public.comments for insert
  with check (
    auth.uid() = author_id
    and not coalesce((select p.is_banned from public.profiles p where p.id = auth.uid()), false)
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and (p.publish_at is null or p.publish_at <= now())
    )
  );

drop policy if exists "Votes are viewable by everyone" on public.votes;
create policy "Votes are viewable by everyone"
  on public.votes for select
  using (
    exists (
      select 1
      from public.posts p
      where p.id = votes.post_id
        and (p.publish_at is null or p.publish_at <= now())
    )
  );

drop policy if exists "Logged-in users can vote" on public.votes;
create policy "Logged-in users can vote"
  on public.votes for insert
  with check (
    auth.uid() = user_id
    and not coalesce((select p.is_banned from public.profiles p where p.id = auth.uid()), false)
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and (p.publish_at is null or p.publish_at <= now())
    )
  );

-- released_at is the public clock: the drip time, or created_at when there
-- is no drip. New, Top, profiles, the sitemap, and the feeds sort by it.
-- The WHERE hides anything that is still waiting, including from the
-- service role, because this is a view filter rather than a policy.
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
  coalesce(c.comment_count, 0) as comment_count,
  p.is_political,
  p.state,
  coalesce(p.publish_at, p.created_at) as released_at
from public.posts p
join public.profiles pr on pr.id = p.author_id
left join (
  select post_id, count(*) as vote_count from public.votes group by post_id
) v on v.post_id = p.id
left join (
  select post_id, count(*) as comment_count from public.comments group by post_id
) c on c.post_id = p.id
where p.publish_at is null or p.publish_at <= now();

create or replace function public.chicago_drip_deadline(p_now timestamptz)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select (date_trunc('day', p_now at time zone 'America/Chicago') + time '14:00')
    at time zone 'America/Chicago';
$$;

revoke all on function public.chicago_drip_deadline(timestamptz) from public, anon, authenticated, service_role;

comment on function public.chicago_drip_deadline(timestamptz) is
  '2:00 PM America/Chicago on the Chicago calendar day of p_now.';

create or replace function public.apply_drip_schedule(p_plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_deadline timestamptz;
  v_today date;
  v_item jsonb;
  v_story_id uuid;
  v_post_id bigint;
  v_at timestamptz;
  v_supplied timestamptz;
  v_count integer := 0;
  v_publish_count integer := 0;
  v_move_count integer := 0;
  v_result jsonb := '[]'::jsonb;
  v_bot_id uuid;
  story public.digest_stories%rowtype;
  v_seen uuid[] := array[]::uuid[];
begin
  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_plan is null or jsonb_typeof(p_plan) is distinct from 'object' then
    raise exception 'digest: That story could not be published.' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_plan->'publish', '[]'::jsonb)) is distinct from 'array'
    or jsonb_typeof(coalesce(p_plan->'move', '[]'::jsonb)) is distinct from 'array'
    or jsonb_typeof(coalesce(p_plan->'expected', '[]'::jsonb)) is distinct from 'array'
  then
    raise exception 'digest: That story could not be published.' using errcode = '22023';
  end if;

  v_publish_count := jsonb_array_length(p_plan->'publish');
  v_move_count := jsonb_array_length(p_plan->'move');
  if v_publish_count < 1 or v_publish_count > 100 or v_move_count > 100 then
    raise exception 'digest: Choose at least one story.' using errcode = '22023';
  end if;

  -- One drip at a time. Release now and unschedule take this same lock.
  perform pg_advisory_xact_lock(845120, 1);

  v_deadline := public.chicago_drip_deadline(v_now);
  v_today := (v_now at time zone 'America/Chicago')::date;

  perform 1
  from public.posts p
  where p.publish_at is not null
    and (p.publish_at at time zone 'America/Chicago')::date = v_today
  order by p.id
  for update;

  if exists (
    select 1
    from public.posts p
    where p.publish_at is not null
      and (p.publish_at at time zone 'America/Chicago')::date = v_today
      and not exists (
        select 1
        from jsonb_array_elements(p_plan->'expected') item
        where (item->>'post_id')::bigint = p.id
          and abs(extract(epoch from (p.publish_at - (item->>'publish_at')::timestamptz))) < 0.002
      )
  ) or exists (
    select 1
    from jsonb_array_elements(p_plan->'expected') item
    where not exists (
      select 1
      from public.posts p
      where p.id = (item->>'post_id')::bigint
        and p.publish_at is not null
        and (p.publish_at at time zone 'America/Chicago')::date = v_today
        and abs(extract(epoch from (p.publish_at - (item->>'publish_at')::timestamptz))) < 0.002
    )
  ) then
    raise exception 'digest: schedule-changed' using errcode = '40001';
  end if;

  select id into v_bot_id
  from public.profiles
  where username = 'Cornhole News';

  if v_bot_id is null then
    raise exception 'digest: The Cornhole News author profile does not exist yet. Create that user, then publish. Steps are at the top of supabase/migrations/20261013_digest_stories.sql.'
      using errcode = '22023';
  end if;

  perform 1
  from public.digest_stories d
  where d.id in (
    select (item->>'story_id')::uuid
    from jsonb_array_elements(p_plan->'publish') item
  )
  order by d.id
  for update;

  for v_item in
    select value
    from jsonb_array_elements(p_plan->'publish')
  loop
    if coalesce(v_item->>'story_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'digest: That story could not be found.' using errcode = '22023';
    end if;

    v_story_id := (v_item->>'story_id')::uuid;
    if v_story_id = any(v_seen) then
      continue;
    end if;
    v_seen := array_append(v_seen, v_story_id);

    begin
      v_supplied := (v_item->>'publish_at')::timestamptz;
    exception
      when others then
        raise exception 'digest: That story could not be published.' using errcode = '22023';
    end;

    if v_supplied is null then
      raise exception 'digest: That story could not be published.' using errcode = '22023';
    end if;

    v_at := least(v_supplied, v_deadline);
    if v_at <= v_now + interval '2 seconds' then
      v_at := v_now;
    end if;

    select * into story
    from public.digest_stories
    where id = v_story_id;

    if not found or story.status is distinct from 'pending' then
      raise exception 'digest: schedule-changed' using errcode = '40001';
    end if;

    insert into public.posts (title, url, body, author_id, is_political, state, publish_at)
    values (
      story.headline,
      story.url,
      story.synopsis || ' — ' || story.paper || ', ' || story.state,
      v_bot_id,
      story.is_political,
      story.story_state,
      v_at
    )
    returning id into v_post_id;

    update public.digest_stories
    set status = 'published',
        post_id = v_post_id
    where id = story.id
      and status = 'pending';

    get diagnostics v_count = row_count;
    if v_count <> 1 then
      raise exception 'digest: That story changed while it was being published. Nothing was published.'
        using errcode = '40001';
    end if;

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'story_id', story.id,
        'post_id', v_post_id,
        'publish_at', v_at
      )
    );
  end loop;

  if jsonb_array_length(v_result) < 1 then
    raise exception 'digest: That story could not be published.' using errcode = '22023';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_plan->'move')
  loop
    v_post_id := (v_item->>'post_id')::bigint;
    begin
      v_supplied := (v_item->>'publish_at')::timestamptz;
    exception
      when others then
        raise exception 'digest: That story could not be published.' using errcode = '22023';
    end;

    if v_supplied is null then
      raise exception 'digest: That story could not be published.' using errcode = '22023';
    end if;

    v_at := least(v_supplied, v_deadline);
    if v_at <= v_now + interval '2 seconds' then
      v_at := v_now;
    end if;

    update public.posts
    set publish_at = v_at
    where id = v_post_id
      and publish_at > v_now;

    get diagnostics v_count = row_count;
    if v_count <> 1 then
      raise exception 'digest: schedule-changed' using errcode = '40001';
    end if;
  end loop;

  return v_result;
end;
$$;

revoke all on function public.apply_drip_schedule(jsonb) from public, anon, service_role;
grant execute on function public.apply_drip_schedule(jsonb) to authenticated;

comment on function public.apply_drip_schedule(jsonb) is
  'Admin only. Publishes the given pending digest stories at the given times and moves waiting posts. Caps times at 2:00 PM Central. Does not email or post to X.';

create or replace function public.release_digest_story_now(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  story public.digest_stories%rowtype;
  v_now timestamptz := now();
  v_count integer := 0;
begin
  if p_id is null then
    raise exception 'digest: That story could not be found.' using errcode = '22023';
  end if;

  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(845120, 1);
  perform pg_advisory_xact_lock(845114, hashtext(p_id::text));

  select * into story
  from public.digest_stories
  where id = p_id
  for update;

  if not found or story.status is distinct from 'published' or story.post_id is null then
    raise exception 'digest: That story is not scheduled.' using errcode = '22023';
  end if;

  update public.posts
  set publish_at = v_now
  where id = story.post_id
    and publish_at > v_now;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'digest: That story is already on the site.' using errcode = '22023';
  end if;

  return jsonb_build_object('post_id', story.post_id, 'publish_at', v_now);
end;
$$;

revoke all on function public.release_digest_story_now(uuid) from public, anon, service_role;
grant execute on function public.release_digest_story_now(uuid) to authenticated;

comment on function public.release_digest_story_now(uuid) is
  'Admin only. Makes one scheduled digest story public now. Does not move the others, email, or post to X.';

create or replace function public.unschedule_digest_story(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  story public.digest_stories%rowtype;
  v_count integer := 0;
  v_post_id bigint;
begin
  if p_id is null then
    raise exception 'digest: That story could not be found.' using errcode = '22023';
  end if;

  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(845120, 1);
  perform pg_advisory_xact_lock(845114, hashtext(p_id::text));

  select * into story
  from public.digest_stories
  where id = p_id
  for update;

  if not found or story.status is distinct from 'published' or story.post_id is null then
    raise exception 'digest: That story is not scheduled.' using errcode = '22023';
  end if;

  select id into v_post_id
  from public.posts
  where id = story.post_id
    and publish_at > now()
  for update;

  if v_post_id is null then
    raise exception 'digest: That story is already on the site.' using errcode = '22023';
  end if;

  update public.digest_stories
  set status = 'pending',
      post_id = null
  where id = story.id
    and status = 'published'
    and post_id = v_post_id;

  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'digest: That story changed while it was being unscheduled.' using errcode = '40001';
  end if;

  delete from public.posts
  where id = v_post_id
    and publish_at > now();

  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'digest: That story is already on the site.' using errcode = '22023';
  end if;

  return jsonb_build_object('post_id', v_post_id);
end;
$$;

revoke all on function public.unschedule_digest_story(uuid) from public, anon, service_role;
grant execute on function public.unschedule_digest_story(uuid) to authenticated;

comment on function public.unschedule_digest_story(uuid) is
  'Admin only. Pulls a not-yet-public digest story back to the waiting list and deletes its post. Does not email or post to X.';
