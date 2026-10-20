-- Allow the POLITICS digest section, and preset its Politics flag.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/migrations/20261016_digest_trade_industry.sql first.
--
-- The review page lists this section after SERIOUS. Ingest accepts it.
-- A story is stored with is_political true when its section is POLITICS or
-- the request sets is_political true. Updating a pending URL only turns that
-- flag on. It never turns off a value an admin already saved.

do $$
begin
  if to_regclass('public.digest_stories') is null then
    raise exception 'Run supabase/migrations/20261013_digest_stories.sql first.';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'digest_stories'
      and column_name = 'is_political'
  ) then
    raise exception 'Run supabase/migrations/20261015_digest_story_politics.sql first.';
  end if;
end $$;

alter table public.digest_stories
  drop constraint if exists digest_stories_section_check;

alter table public.digest_stories
  add constraint digest_stories_section_check check (
    section in (
      'QUIRKY',
      'SERIOUS',
      'POLITICS',
      'AROUND THE MIDWEST',
      'NATIONAL PRESS',
      'TRADE & INDUSTRY'
    )
  );

comment on column public.digest_stories.is_political is
  'Copied onto the post at publish time. On a published story, matches the linked post. Default false. POLITICS, or an explicit true, sets it. A later ingest never clears it.';

-- Same ingest function as 20261016, plus POLITICS and a one-way Politics flag.
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
      'synopsis', v_synopsis,
      'is_political', v_is_political
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
    is_political = d.is_political or i.is_political
  from jsonb_to_recordset(validated) as i(
    section text,
    headline text,
    url text,
    paper text,
    state text,
    synopsis text,
    is_political boolean
  )
  where d.digest_date = p_digest_date
    and d.url = i.url
    and d.status = 'pending';
  get diagnostics updated_count = row_count;

  insert into public.digest_stories (
    digest_date, section, headline, url, paper, state, synopsis, status, is_political
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
    i.is_political
  from jsonb_to_recordset(validated) as i(
    section text,
    headline text,
    url text,
    paper text,
    state text,
    synopsis text,
    is_political boolean
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
  'Upserts one digest date as pending. Service role only. Does not publish, and does not revive published or deleted URLs. Sections: QUIRKY, SERIOUS, POLITICS, AROUND THE MIDWEST, NATIONAL PRESS, TRADE & INDUSTRY. is_political is set true for POLITICS or an explicit true, and a later upsert never sets it false.';
