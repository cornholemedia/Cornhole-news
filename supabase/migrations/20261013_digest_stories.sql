-- Daily Midwest digest queue.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/migrations/20261012_politics_tag.sql first.
--
-- The daily job does not publish stories. It POSTs them to /api/digest/ingest.
-- They land here as pending and stay off the public site. An admin opens
-- /admin/review, deletes anything that should not run, and clicks Publish all.
-- Publishing copies each kept story into posts and marks the queue row
-- published. Deleted rows stay deleted: a later ingest of the same date and
-- URL does not bring them back and does not create a second post.
--
-- Readers never get this table. Only an admin session can read it. The ingest
-- route uses the service role on the server, which bypasses row level
-- security, so a trigger below forces every insert to stay pending. The
-- service role cannot publish. Publish runs only from an admin session.
--
-- Env vars to set in Vercel (Production and Preview). Neither name may start
-- with NEXT_PUBLIC_. Redeploy after saving them.
--   DIGEST_INGEST_SECRET
--     Long random string, at least 16 characters. The daily job sends it as
--     Authorization: Bearer <secret>.
--   SUPABASE_SERVICE_ROLE_KEY
--     The service role key, or the newer secret key (sb_secret_...). It stays
--     on the server. Do not put it in a NEXT_PUBLIC_ variable.
--
-- Request (also in the README):
--   POST https://cornholenews.news/api/digest/ingest
--   Authorization: Bearer <DIGEST_INGEST_SECRET>
--   Content-Type: application/json
--   {
--     "digest_date": "2026-10-13",
--     "stories": [
--       {
--         "section": "QUIRKY",
--         "headline": "Town crowns a new cornhole champion",
--         "url": "https://example.com/cornhole-champion",
--         "paper": "Des Moines Register",
--         "state": "IA",
--         "synopsis": "A packed gym watched the final bags land."
--       }
--     ]
--   }
-- section is one of: QUIRKY, SERIOUS, AROUND THE MIDWEST, NATIONAL PRESS.
-- state is the two-letter code used in the post ("Paper, ST"). Use the state
-- the story is about. Sending the same date and URL again updates a pending
-- row and leaves a published or deleted row alone. URLs omitted from a later
-- post are not removed.
--
-- Bot profile. Published posts are authored by the profile whose username is
-- exactly Cornhole News (including the space). The signup form rejects spaces,
-- and this file cannot create an auth user. Do this once, after this file
-- has run:
--   1. Supabase Dashboard -> Authentication -> Users -> Add user.
--      Email: cornhole-news@cornholenews.news
--        Any mailbox you control is fine. It does not need to receive mail
--        when Auto Confirm is on. The site looks up the username, not the email.
--      Password: a long random password. Store it in a password manager.
--        The bot never signs in.
--      Auto Confirm User: on.
--      User Metadata (required, or the age check rejects the user):
--        {"username":"Cornhole News","age_confirmed":true}
--   2. Confirm the profile. is_admin must be false.
--        select id, username, is_admin
--        from public.profiles
--        where username = 'Cornhole News';
--   3. If the username is the email name instead, fix it. Replace the email
--      if you used a different one:
--        update public.profiles
--        set username = 'Cornhole News'
--        where id = (
--          select id from auth.users
--          where email = 'cornhole-news@cornholenews.news'
--        );
--   4. Optional: ban that user under Authentication so the password cannot be
--      used to sign in. The profile row remains, and posts keep that author.

do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing. Run the earlier admin migration first.';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'is_political'
  ) then
    raise exception 'Run supabase/migrations/20261012_politics_tag.sql first.';
  end if;
end $$;

create table if not exists public.digest_stories (
  id uuid primary key default extensions.gen_random_uuid(),
  digest_date date not null,
  section text not null,
  headline text not null,
  url text not null,
  paper text not null,
  state text not null,
  synopsis text not null,
  status text not null default 'pending',
  post_id bigint references public.posts(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint digest_stories_date_url_key unique (digest_date, url),
  constraint digest_stories_section_check check (
    section in ('QUIRKY', 'SERIOUS', 'AROUND THE MIDWEST', 'NATIONAL PRESS')
  ),
  constraint digest_stories_headline_check check (
    char_length(headline) between 1 and 300
    and headline !~ '[[:cntrl:]]'
    and headline = btrim(headline)
  ),
  constraint digest_stories_url_check check (
    char_length(url) between 12 and 2000
    and url ~ '^https://[^[:space:][:cntrl:]]+$'
    and url !~ '^https://[^/?#]*@'
    and substring(url from '^https://([^/?#]+)') ~ '[.]'
  ),
  constraint digest_stories_paper_check check (
    char_length(paper) between 1 and 160
    and paper !~ '[[:cntrl:]]'
    and paper = btrim(paper)
  ),
  constraint digest_stories_state_check check (state ~ '^[A-Z]{2}$'),
  constraint digest_stories_synopsis_check check (
    char_length(synopsis) between 1 and 2000
    and synopsis !~ '[[:cntrl:]]'
    and synopsis = btrim(synopsis)
  ),
  constraint digest_stories_status_check check (
    status in ('pending', 'published', 'deleted')
  ),
  constraint digest_stories_post_check check (
    (status = 'pending' and post_id is null)
    or (status = 'deleted' and post_id is null)
    or status = 'published'
  )
);

create index if not exists digest_stories_pending_date_idx
  on public.digest_stories (digest_date desc, created_at)
  where status = 'pending';

alter table public.digest_stories enable row level security;

drop policy if exists "Admins can read digest stories" on public.digest_stories;
create policy "Admins can read digest stories"
  on public.digest_stories for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can update digest stories" on public.digest_stories;
create policy "Admins can update digest stories"
  on public.digest_stories for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

comment on table public.digest_stories is
  'Midwest digest queue. Pending and deleted rows are admin-only. Publish copies a pending row into posts as Cornhole News.';

comment on column public.digest_stories.status is
  'pending stays off the public site. published has a posts row. deleted stays hidden and is not revived by a later ingest.';

comment on column public.digest_stories.post_id is
  'Set when the story is published. Cleared if that post is later deleted. The queue row stays published so it is not posted twice.';

-- Inserts from the ingest route are forced back to pending. Admins can only
-- hide a pending row. Publishing is a separate admin function that runs as
-- the migration owner so it can write the posts row as the bot.
create or replace function public.guard_digest_story()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if current_user in ('postgres', 'supabase_admin') then
      return old;
    end if;
    raise exception 'digest: Hide a story by marking it deleted. Do not remove the row.';
  end if;

  if tg_op = 'INSERT' then
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    new.status := 'pending';
    new.post_id := null;
    new.created_at := now();
    return new;
  end if;

  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  new.id := old.id;
  new.digest_date := old.digest_date;
  new.url := old.url;
  new.created_at := old.created_at;

  if current_user = 'service_role' then
    if old.status is distinct from 'pending' then
      return old;
    end if;
    new.status := 'pending';
    new.post_id := null;
    return new;
  end if;

  if current_user = 'authenticated' and public.is_admin() then
    if old.status = 'pending' and new.status = 'deleted' then
      new.section := old.section;
      new.headline := old.headline;
      new.paper := old.paper;
      new.state := old.state;
      new.synopsis := old.synopsis;
      new.post_id := null;
      return new;
    end if;
  end if;

  raise exception 'not allowed' using errcode = '42501';
end;
$$;

revoke all on function public.guard_digest_story() from public, anon;
grant execute on function public.guard_digest_story() to authenticated, service_role;

drop trigger if exists digest_stories_guard on public.digest_stories;
create trigger digest_stories_guard
  before insert or update or delete on public.digest_stories
  for each row execute procedure public.guard_digest_story();

-- Dates for the review page. Admins only. A signed-in reader who is not an
-- admin gets an error instead of an empty list they could confuse with
-- "no digest yet".
create or replace function public.admin_digest_dates()
returns table (digest_date date, pending_count bigint, story_count bigint)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  select
    d.digest_date,
    count(*) filter (where d.status = 'pending')::bigint,
    count(*)::bigint
  from public.digest_stories d
  group by d.digest_date
  order by d.digest_date desc
  limit 400;
end;
$$;

revoke all on function public.admin_digest_dates() from public, anon;
grant execute on function public.admin_digest_dates() to authenticated;

comment on function public.admin_digest_dates() is
  'Admin-only list of digest dates and how many stories are still pending.';

-- Called by the server with the service role. Granted to that role only.
-- A published or deleted URL is left unchanged.
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
    if v_section not in ('QUIRKY', 'SERIOUS', 'AROUND THE MIDWEST', 'NATIONAL PRESS') then
      raise exception 'digest: Story % has a section this site does not use.', v_index
        using errcode = '22023';
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
      'synopsis', v_synopsis
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
    synopsis = i.synopsis
  from jsonb_to_recordset(validated) as i(
    section text,
    headline text,
    url text,
    paper text,
    state text,
    synopsis text
  )
  where d.digest_date = p_digest_date
    and d.url = i.url
    and d.status = 'pending';
  get diagnostics updated_count = row_count;

  insert into public.digest_stories (
    digest_date, section, headline, url, paper, state, synopsis, status
  )
  select
    p_digest_date,
    i.section,
    i.headline,
    i.url,
    i.paper,
    i.state,
    i.synopsis,
    'pending'
  from jsonb_to_recordset(validated) as i(
    section text,
    headline text,
    url text,
    paper text,
    state text,
    synopsis text
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
  'Upserts one digest date as pending. Service role only. Does not publish, and does not revive published or deleted URLs.';

-- Admin only. One transaction: a posts row, then the queue row marked published.
-- Insert order makes the top of the review list the newest post, so /new and
-- the zero-point home list follow the same order. Nothing here runs unless
-- the caller is an admin, and the service role is not granted execute.
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
    select id, headline, url, paper, state, synopsis
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
      false,
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
  'Admin only. Creates one non-political post per pending story for that date, authored by Cornhole News, then marks the queue row published.';

revoke all on table public.digest_stories from public, anon, authenticated;
grant select, update on table public.digest_stories to authenticated;
grant select, insert, update on table public.digest_stories to service_role;
