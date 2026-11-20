-- State shown under a story title.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/migrations/20261027_tweet_draft.sql first.
--
-- posts.state is one Midwest code, or null. Null means the story is regional,
-- about more than one state, or we are not sure. It is not free text.
-- Codes: IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI.
-- Existing post policies still decide who can read and edit a post, so authors
-- and admins can set this column without a new policy.
--
-- digest_stories.state stays the byline code ("Paper, ST") and can be any
-- two letters. digest_stories.story_state is the label copied onto the post.
-- Ingest may send optional story_state. When a new row omits it, story_state
-- copies state when that code is one of the twelve. A later ingest updates
-- story_state only when the request includes the key. Null clears it.
-- Omitting the key leaves an admin's choice in place, including a blank one.
--
-- The backfill below fills empty values only. It does not replace a state
-- someone already saved. A story is filled only when every reliable signal
-- agrees on one code. Two states, or two signals that disagree, stay null.
-- "Kansas City", "Lake Michigan", "Michigan Avenue", "Indiana Avenue",
-- "Ohio River", and "Missouri River" are not treated as that state.
-- A digest byline is the em dash and "Paper, ST" at the end of the body.
-- Official state-government hosts count. A newspaper domain does not, on
-- its own.

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
      and table_name = 'digest_stories'
      and column_name = 'tweet_draft'
  ) then
    raise exception 'Run supabase/migrations/20261027_tweet_draft.sql first.';
  end if;
end $$;

alter table public.posts
  add column if not exists state text;

alter table public.posts drop constraint if exists posts_state_check;
alter table public.posts
  add constraint posts_state_check check (
    state is null
    or state in (
      'IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'
    )
  );

comment on column public.posts.state is
  'Midwest state this story is about: IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, or WI. Null when it is regional, multi-state, or unknown.';

create index if not exists posts_state_created_idx
  on public.posts (state, created_at desc)
  where state is not null;

-- The home page, New page, profile pages, and story pages read this view.
-- state is added at the end, which CREATE OR REPLACE VIEW allows.
-- security_invoker stays on so the view still follows row level security.
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
  p.state
from public.posts p
join public.profiles pr on pr.id = p.author_id
left join (
  select post_id, count(*) as vote_count from public.votes group by post_id
) v on v.post_id = p.id
left join (
  select post_id, count(*) as comment_count from public.comments group by post_id
) c on c.post_id = p.id;

alter table public.digest_stories
  add column if not exists story_state text;

alter table public.digest_stories drop constraint if exists digest_stories_story_state_check;
alter table public.digest_stories
  add constraint digest_stories_story_state_check check (
    story_state is null
    or story_state in (
      'IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'
    )
  );

comment on column public.digest_stories.story_state is
  'Midwest state copied onto the post. Null for regional, multi-state, or non-Midwest stories. Independent of the byline state. A later ingest changes it only when story_state is sent.';

-- Same ingest as 20261027, plus optional story_state.
create or replace function public.ingest_digest_stories(p_digest_date date, p_stories jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  rec record;
  v_index integer;
  v_section text;
  v_headline text;
  v_url text;
  v_paper text;
  v_state text;
  v_synopsis text;
  v_host text;
  v_is_political boolean;
  v_tweet text;
  v_story_state text;
  v_story_state_set boolean;
  seen_urls text[] := array[]::text[];
  validated jsonb := '[]'::jsonb;
  input_count integer := 0;
  inserted_count bigint := 0;
  updated_count bigint := 0;
  skipped_count bigint := 0;
begin
  if p_digest_date is null then
    raise exception 'digest: Choose a digest date.' using errcode = '22023';
  end if;

  if p_stories is null or jsonb_typeof(p_stories) <> 'array' then
    raise exception 'digest: Stories must be a list.' using errcode = '22023';
  end if;

  input_count := jsonb_array_length(p_stories);
  if input_count > 100 then
    raise exception 'digest: Send at most 100 stories at a time.' using errcode = '22023';
  end if;

  for rec in
    select value, ordinality
    from jsonb_array_elements(p_stories) with ordinality
  loop
    v_index := rec.ordinality;

    if jsonb_typeof(rec.value) <> 'object' then
      raise exception 'digest: Story % must be an object.', v_index using errcode = '22023';
    end if;

    if jsonb_typeof(rec.value->'section') is distinct from 'string'
       or jsonb_typeof(rec.value->'headline') is distinct from 'string'
       or jsonb_typeof(rec.value->'url') is distinct from 'string'
       or jsonb_typeof(rec.value->'paper') is distinct from 'string'
       or jsonb_typeof(rec.value->'state') is distinct from 'string'
       or jsonb_typeof(rec.value->'synopsis') is distinct from 'string'
    then
      raise exception 'digest: Story % is missing a headline, link, paper, state, synopsis, or section.', v_index
        using errcode = '22023';
    end if;

    v_section := btrim(rec.value->>'section');
    if v_section not in (
      'QUIRKY',
      'SERIOUS',
      'POLITICS',
      'AROUND THE MIDWEST',
      'NATIONAL PRESS',
      'TRADE & INDUSTRY'
    ) then
      raise exception 'digest: Story % has a section this site does not use.', v_index
        using errcode = '22023';
    end if;

    v_is_political := false;
    if rec.value ? 'is_political' and jsonb_typeof(rec.value->'is_political') is distinct from 'null' then
      if jsonb_typeof(rec.value->'is_political') is distinct from 'boolean' then
        raise exception 'digest: Story % needs a true or false Politics flag.', v_index
          using errcode = '22023';
      end if;
      v_is_political := (rec.value->>'is_political')::boolean;
    end if;
    if v_section = 'POLITICS' or v_is_political then
      v_is_political := true;
    end if;

    v_tweet := null;
    if rec.value ? 'tweet_draft' and jsonb_typeof(rec.value->'tweet_draft') is distinct from 'null' then
      if jsonb_typeof(rec.value->'tweet_draft') is distinct from 'string' then
        raise exception 'digest: Story % needs a tweet of 280 characters or fewer.', v_index
          using errcode = '22023';
      end if;
      v_tweet := btrim(replace(replace(rec.value->>'tweet_draft', E'\r\n', E'\n'), E'\r', E'\n'));
      if v_tweet = '' then
        v_tweet := null;
      elsif char_length(v_tweet) > 280
         or regexp_replace(v_tweet, E'\n', '', 'g') ~ '[[:cntrl:]]'
      then
        raise exception 'digest: Story % needs a tweet of 280 characters or fewer.', v_index
          using errcode = '22023';
      end if;
    end if;

    v_headline := btrim(regexp_replace(rec.value->>'headline', '[[:space:]]+', ' ', 'g'));
    if v_headline is null
       or char_length(v_headline) < 1
       or char_length(v_headline) > 300
       or v_headline ~ '[[:cntrl:]]'
    then
      raise exception 'digest: Story % needs a headline of 300 characters or fewer.', v_index
        using errcode = '22023';
    end if;

    v_url := btrim(rec.value->>'url');
    v_host := substring(v_url from '^https://([^/?#]+)');
    if v_url is null
       or char_length(v_url) < 12
       or char_length(v_url) > 2000
       or v_url ~ '[[:space:][:cntrl:]]'
       or v_url !~ '^https://'
       or v_url ~ '^https://[^/?#]*@'
       or v_host is null
       or v_host !~ '[.]'
       or v_host ~* '^(localhost|.*[.]localhost|.*[.]local)$'
       or v_host ~ '^[0-9]{1,3}([.][0-9]{1,3}){3}$'
    then
      raise exception 'digest: Story % needs an https link to a public site.', v_index
        using errcode = '22023';
    end if;

    if v_url = any(seen_urls) then
      raise exception 'digest: Each URL can appear only once in a digest.' using errcode = '22023';
    end if;
    seen_urls := array_append(seen_urls, v_url);

    v_paper := btrim(regexp_replace(rec.value->>'paper', '[[:space:]]+', ' ', 'g'));
    if v_paper is null
       or char_length(v_paper) < 1
       or char_length(v_paper) > 160
       or v_paper ~ '[[:cntrl:]]'
    then
      raise exception 'digest: Story % needs a paper name of 160 characters or fewer.', v_index
        using errcode = '22023';
    end if;

    v_state := upper(btrim(rec.value->>'state'));
    if v_state !~ '^[A-Z]{2}$' then
      raise exception 'digest: Story % needs a two-letter state code.', v_index
        using errcode = '22023';
    end if;

    v_story_state := null;
    v_story_state_set := false;
    if rec.value ? 'story_state' then
      v_story_state_set := true;
      if jsonb_typeof(rec.value->'story_state') = 'null' then
        v_story_state := null;
      elsif jsonb_typeof(rec.value->'story_state') is distinct from 'string' then
        raise exception 'digest: Story % needs a Midwest state code, or null.', v_index
          using errcode = '22023';
      else
        v_story_state := upper(btrim(rec.value->>'story_state'));
        if v_story_state = '' then
          v_story_state := null;
        elsif v_story_state not in (
          'IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'
        ) then
          raise exception 'digest: Story % needs a Midwest state code, or null.', v_index
            using errcode = '22023';
        end if;
      end if;
    end if;

    v_synopsis := btrim(regexp_replace(rec.value->>'synopsis', '[[:space:]]+', ' ', 'g'));
    if v_synopsis is null
       or char_length(v_synopsis) < 1
       or char_length(v_synopsis) > 2000
       or v_synopsis ~ '[[:cntrl:]]'
    then
      raise exception 'digest: Story % needs a synopsis of 2000 characters or fewer.', v_index
        using errcode = '22023';
    end if;

    validated := validated || jsonb_build_array(jsonb_build_object(
      'section', v_section,
      'headline', v_headline,
      'url', v_url,
      'paper', v_paper,
      'state', v_state,
      'synopsis', v_synopsis,
      'is_political', v_is_political,
      'tweet_draft', v_tweet,
      'story_state', v_story_state,
      'story_state_set', v_story_state_set
    ));
  end loop;

  if input_count = 0 then
    return jsonb_build_object('inserted', 0, 'updated', 0, 'skipped', 0);
  end if;

  perform pg_advisory_xact_lock(845112, hashtext(p_digest_date::text));

  update public.digest_stories as d
  set
    section = i.section,
    headline = i.headline,
    paper = i.paper,
    state = i.state,
    synopsis = i.synopsis,
    is_political = d.is_political or i.is_political,
    tweet_draft = coalesce(d.tweet_draft, i.tweet_draft),
    story_state = case
      when i.story_state_set then i.story_state
      else d.story_state
    end
  from jsonb_to_recordset(validated) as i(
    section text,
    headline text,
    url text,
    paper text,
    state text,
    synopsis text,
    is_political boolean,
    tweet_draft text,
    story_state text,
    story_state_set boolean
  )
  where d.digest_date = p_digest_date
    and d.url = i.url
    and d.status = 'pending';
  get diagnostics updated_count = row_count;

  insert into public.digest_stories (
    digest_date, section, headline, url, paper, state, synopsis, status, is_political, tweet_draft, story_state
  )
  select
    p_digest_date,
    i.section,
    i.headline,
    i.url,
    i.paper,
    i.state,
    i.synopsis,
    'pending',
    i.is_political,
    i.tweet_draft,
    case
      when i.story_state_set then i.story_state
      when i.state in (
        'IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'
      ) then i.state
      else null
    end
  from jsonb_to_recordset(validated) as i(
    section text,
    headline text,
    url text,
    paper text,
    state text,
    synopsis text,
    is_political boolean,
    tweet_draft text,
    story_state text,
    story_state_set boolean
  )
  where not exists (
    select 1
    from public.digest_stories as d
    where d.digest_date = p_digest_date
      and d.url = i.url
  )
  on conflict (digest_date, url) do nothing;
  get diagnostics inserted_count = row_count;

  skipped_count := input_count - updated_count - inserted_count;
  if skipped_count < 0 then
    skipped_count := 0;
  end if;

  return jsonb_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'skipped', skipped_count
  );
end;
$$;

revoke all on function public.ingest_digest_stories(date, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_digest_stories(date, jsonb) to service_role;

comment on function public.ingest_digest_stories(date, jsonb) is
  'Upserts one digest date as pending. Service role only. Does not publish, and does not revive published or deleted URLs. Optional story_state is a Midwest code or null and is copied onto the post. When omitted, a new row uses state if that code is one of the 12, and a later upsert leaves the saved story_state alone.';

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
  -- inserting a second post. The state and politics edits use this same lock.
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

  insert into public.posts (title, url, body, author_id, is_political, state)
  values (
    story.headline,
    story.url,
    story.synopsis || ' — ' || story.paper || ', ' || story.state,
    bot_id,
    story.is_political,
    story.story_state
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
  'Admin only. Publishes one pending digest story as a Cornhole News post, copying Politics and story_state. A repeat call returns the existing post id.';

-- The review page no longer calls this. Keep it aligned so a leftover call
-- still copies Politics and story_state.
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
    select id, headline, url, paper, state, synopsis, is_political, story_state
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

    insert into public.posts (title, url, body, author_id, is_political, state, created_at)
    values (
      story.headline,
      story.url,
      story.synopsis || ' — ' || story.paper || ', ' || story.state,
      bot_id,
      story.is_political,
      story.story_state,
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
  'Admin only. Unused by the site. Publishes pending stories for a date as Cornhole News, copying each story Politics flag and story_state.';

create or replace function public.set_digest_story_state(p_id uuid, p_state text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  story public.digest_stories%rowtype;
  v_state text;
  updated_rows bigint := 0;
begin
  if p_id is null then
    raise exception 'digest: That story could not be found.' using errcode = '22023';
  end if;

  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  v_state := null;
  if p_state is not null then
    v_state := upper(btrim(p_state));
    if v_state = '' then
      v_state := null;
    elsif v_state not in (
      'IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'
    ) then
      raise exception 'digest: Choose a Midwest state, or leave it blank.' using errcode = '22023';
    end if;
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
  set story_state = v_state
  where id = story.id
    and status = story.status;
  get diagnostics updated_rows = row_count;

  if updated_rows <> 1 then
    raise exception 'digest: That story changed while it was being saved. Nothing was saved.'
      using errcode = '40001';
  end if;

  if story.status = 'published' and story.post_id is not null then
    update public.posts
    set state = v_state
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

revoke all on function public.set_digest_story_state(uuid, text) from public, anon, service_role;
grant execute on function public.set_digest_story_state(uuid, text) to authenticated;

comment on function public.set_digest_story_state(uuid, text) is
  'Admin only. Saves or clears the Midwest state on one digest story. If that story is already published, updates the linked post. Returns the post id, or null when there is no post yet.';

-- Backfill helpers. Dropped at the end of this file so they are not part of
-- the public API. Keep the phrase list aligned with src/lib/story-state.ts.
create or replace function public.midwest_codes_in_text(p_text text)
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_text text := lower(coalesce(p_text, ''));
  v_found text[] := array[]::text[];
begin
  v_text := regexp_replace(v_text, '[^a-z]+', ' ', 'g');
  v_text := ' ' || btrim(v_text) || ' ';
  v_text := replace(v_text, ' kansas city ', ' ');
  v_text := replace(v_text, ' lake michigan ', ' ');
  v_text := replace(v_text, ' michigan avenue ', ' ');
  v_text := replace(v_text, ' michigan ave ', ' ');
  v_text := replace(v_text, ' indiana avenue ', ' ');
  v_text := replace(v_text, ' indiana ave ', ' ');
  v_text := replace(v_text, ' ohio river ', ' ');
  v_text := replace(v_text, ' missouri river ', ' ');

  if position(' north dakota ' in v_text) > 0 then
    v_found := array_append(v_found, 'ND');
    v_text := replace(v_text, ' north dakota ', ' ');
  end if;
  if position(' south dakota ' in v_text) > 0 then
    v_found := array_append(v_found, 'SD');
    v_text := replace(v_text, ' south dakota ', ' ');
  end if;
  if position(' illinois ' in v_text) > 0 then
    v_found := array_append(v_found, 'IL');
  end if;
  if position(' indiana ' in v_text) > 0 then
    v_found := array_append(v_found, 'IN');
  end if;
  if position(' iowa ' in v_text) > 0 then
    v_found := array_append(v_found, 'IA');
  end if;
  if position(' kansas ' in v_text) > 0 then
    v_found := array_append(v_found, 'KS');
  end if;
  if position(' michigan ' in v_text) > 0 then
    v_found := array_append(v_found, 'MI');
  end if;
  if position(' minnesota ' in v_text) > 0 then
    v_found := array_append(v_found, 'MN');
  end if;
  if position(' missouri ' in v_text) > 0 then
    v_found := array_append(v_found, 'MO');
  end if;
  if position(' nebraska ' in v_text) > 0 then
    v_found := array_append(v_found, 'NE');
  end if;
  if position(' ohio ' in v_text) > 0 then
    v_found := array_append(v_found, 'OH');
  end if;
  if position(' wisconsin ' in v_text) > 0 then
    v_found := array_append(v_found, 'WI');
  end if;

  return v_found;
end;
$$;

revoke all on function public.midwest_codes_in_text(text) from public, anon, authenticated;

create or replace function public.infer_story_state_for_backfill(p_title text, p_url text, p_body text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_host text;
  v_path text;
  v_title_codes text[];
  v_path_codes text[];
  v_codes text[] := array[]::text[];
  v_code text;
  v_byline text;
begin
  v_title_codes := public.midwest_codes_in_text(coalesce(p_title, ''));
  if cardinality(v_title_codes) > 1 then
    return 'MULTI';
  end if;

  v_host := lower(regexp_replace(
    split_part(coalesce(substring(p_url from '^https?://([^/?#]+)'), ''), ':', 1),
    '\.$',
    ''
  ));
  v_path := coalesce(substring(p_url from '^https?://[^/?#]+([^?#]*)'), '');
  v_path_codes := public.midwest_codes_in_text(v_path);
  if cardinality(v_path_codes) > 1 then
    return 'MULTI';
  end if;

  if cardinality(v_title_codes) = 1 then
    v_codes := array_append(v_codes, v_title_codes[1]);
  end if;
  if cardinality(v_path_codes) = 1 and array_position(v_codes, v_path_codes[1]) is null then
    v_codes := array_append(v_codes, v_path_codes[1]);
  end if;

  v_code := case
    when v_host = 'illinois.gov' or right(v_host, length('.illinois.gov')) = '.illinois.gov' then 'IL'
    when v_host = 'in.gov' or right(v_host, length('.in.gov')) = '.in.gov' then 'IN'
    when v_host = 'iowa.gov' or right(v_host, length('.iowa.gov')) = '.iowa.gov' then 'IA'
    when v_host = 'kansas.gov' or right(v_host, length('.kansas.gov')) = '.kansas.gov' then 'KS'
    when v_host = 'michigan.gov' or right(v_host, length('.michigan.gov')) = '.michigan.gov' then 'MI'
    when v_host = 'state.mn.us' or right(v_host, length('.state.mn.us')) = '.state.mn.us' then 'MN'
    when v_host = 'mn.gov' or right(v_host, length('.mn.gov')) = '.mn.gov' then 'MN'
    when v_host = 'mo.gov' or right(v_host, length('.mo.gov')) = '.mo.gov' then 'MO'
    when v_host = 'nebraska.gov' or right(v_host, length('.nebraska.gov')) = '.nebraska.gov' then 'NE'
    when v_host = 'nd.gov' or right(v_host, length('.nd.gov')) = '.nd.gov' then 'ND'
    when v_host = 'ohio.gov' or right(v_host, length('.ohio.gov')) = '.ohio.gov' then 'OH'
    when v_host = 'sd.gov' or right(v_host, length('.sd.gov')) = '.sd.gov' then 'SD'
    when v_host = 'wisconsin.gov' or right(v_host, length('.wisconsin.gov')) = '.wisconsin.gov' then 'WI'
    when v_host = 'wi.gov' or right(v_host, length('.wi.gov')) = '.wi.gov' then 'WI'
    else null
  end;
  if v_code is not null and array_position(v_codes, v_code) is null then
    v_codes := array_append(v_codes, v_code);
  end if;

  v_byline := substring(coalesce(p_body, '') from ' — [^—[:cntrl:]]{1,160}, ([A-Z]{2})[[:space:]]*$');
  if v_byline in ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI')
     and array_position(v_codes, v_byline) is null then
    v_codes := array_append(v_codes, v_byline);
  end if;

  if cardinality(v_codes) > 1 then
    return 'MULTI';
  end if;
  if cardinality(v_codes) = 1 then
    return v_codes[1];
  end if;
  return null;
end;
$$;

revoke all on function public.infer_story_state_for_backfill(text, text, text) from public, anon, authenticated;

update public.digest_stories
set story_state = state
where story_state is null
  and state in ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI');

update public.posts as p
set state = chosen.state
from (
  select id, state
  from (
    select
      p2.id,
      case
        when text_state = 'MULTI' or digest_state = 'MULTI' then null
        when text_state is not null
          and digest_state is not null
          and text_state is distinct from digest_state then null
        else coalesce(digest_state, text_state)
      end as state
    from (
      select
        posts.id,
        public.infer_story_state_for_backfill(posts.title, posts.url, posts.body) as text_state,
        linked.digest_state
      from public.posts as posts
      left join (
        select
          post_id,
          case
            when count(distinct story_state) filter (where story_state is not null) > 1 then 'MULTI'
            else max(story_state)
          end as digest_state
        from public.digest_stories
        where post_id is not null
        group by post_id
      ) as linked on linked.post_id = posts.id
      where posts.state is null
    ) as p2
  ) as raw
  where state is not null
) as chosen
where p.id = chosen.id
  and p.state is null;

drop function if exists public.infer_story_state_for_backfill(text, text, text);
drop function if exists public.midwest_codes_in_text(text);
