-- Ads for the sidebar and the mobile banner.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/schema.sql first so public.is_admin() exists.
--
-- Placements match the boxes already on the site, plus the phone banner:
--   sidebar_300x250, sidebar_300x600, mobile_320x50.
-- Visitors can read an ad only while it is active and inside its dates.
-- Admins can read and write every row. Impressions and clicks move only
-- through the two functions below, which never turn a count down.
-- The public ads bucket stores uploaded images. Anyone can read an image.
-- Only an admin can upload, replace, or delete one.

do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing. Run supabase/schema.sql first.';
  end if;
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise exception 'Supabase Storage is not available in this database.';
  end if;
end $$;

create table if not exists public.ads (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  placement text not null,
  image_url text not null,
  click_url text not null,
  alt_text text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default false,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.ads drop constraint if exists ads_name_check;
alter table public.ads
  add constraint ads_name_check check (
    char_length(name) between 1 and 80
    and name !~ '[[:cntrl:]]'
    and name = btrim(name)
  );

alter table public.ads drop constraint if exists ads_placement_check;
alter table public.ads
  add constraint ads_placement_check check (
    placement in ('sidebar_300x250', 'sidebar_300x600', 'mobile_320x50')
  );

alter table public.ads drop constraint if exists ads_image_url_check;
alter table public.ads
  add constraint ads_image_url_check check (
    char_length(image_url) between 12 and 2000
    and image_url ~ '^https://[^[:space:][:cntrl:]]+$'
    and image_url !~ '^https://[^/?#]*@'
  );

alter table public.ads drop constraint if exists ads_click_url_check;
alter table public.ads
  add constraint ads_click_url_check check (
    char_length(click_url) between 12 and 2000
    and click_url ~ '^https?://[^[:space:][:cntrl:]]+$'
    and click_url !~ '^https?://[^/?#]*@'
  );

alter table public.ads drop constraint if exists ads_alt_text_check;
alter table public.ads
  add constraint ads_alt_text_check check (
    char_length(alt_text) <= 200
    and alt_text !~ '[[:cntrl:]]'
  );

alter table public.ads drop constraint if exists ads_window_check;
alter table public.ads
  add constraint ads_window_check check (
    starts_at is null or ends_at is null or ends_at > starts_at
  );

alter table public.ads drop constraint if exists ads_impressions_check;
alter table public.ads
  add constraint ads_impressions_check check (impressions >= 0);

alter table public.ads drop constraint if exists ads_clicks_check;
alter table public.ads
  add constraint ads_clicks_check check (clicks >= 0);

create index if not exists ads_live_placement_idx
  on public.ads (placement)
  where active;

comment on table public.ads is
  'Creatives for the sidebar and mobile banner. A live ad is active and inside its start and end dates.';

comment on column public.ads.placement is
  'sidebar_300x250, sidebar_300x600, or mobile_320x50.';

comment on column public.ads.impressions is
  'Incremented by increment_ad_impression. The admin form does not edit this.';

comment on column public.ads.clicks is
  'Incremented by record_ad_click when a visitor follows the ad. The admin form does not edit this.';

alter table public.ads enable row level security;

revoke all on table public.ads from public, anon, authenticated;
grant select on table public.ads to anon, authenticated;
grant insert, update, delete on table public.ads to authenticated;

drop policy if exists "Anyone can read a live ad" on public.ads;
create policy "Anyone can read a live ad"
  on public.ads for select
  to anon, authenticated
  using (
    active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "Admins can read every ad" on public.ads;
create policy "Admins can read every ad"
  on public.ads for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can insert ads" on public.ads;
create policy "Admins can insert ads"
  on public.ads for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admins can update ads" on public.ads;
create policy "Admins can update ads"
  on public.ads for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete ads" on public.ads;
create policy "Admins can delete ads"
  on public.ads for delete
  to authenticated
  using ((select public.is_admin()));

-- One live creative for a slot. Several live rows are a random pick.
create or replace function public.current_ad(p_placement text)
returns table (id uuid, image_url text, alt_text text)
language sql
volatile
security invoker
set search_path = public
as $$
  select a.id, a.image_url, a.alt_text
  from public.ads as a
  where a.placement = p_placement
    and a.active
    and (a.starts_at is null or a.starts_at <= now())
    and (a.ends_at is null or a.ends_at > now())
  order by random()
  limit 1;
$$;

revoke all on function public.current_ad(text) from public;
grant execute on function public.current_ad(text) to anon, authenticated;

comment on function public.current_ad(text) is
  'Returns one live ad for a placement, chosen at random when more than one is live.';

create or replace function public.increment_ad_impression(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id is null then
    return;
  end if;

  update public.ads
  set impressions = impressions + 1
  where id = p_id
    and active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now());
end;
$$;

revoke all on function public.increment_ad_impression(uuid) from public;
grant execute on function public.increment_ad_impression(uuid) to anon, authenticated;

comment on function public.increment_ad_impression(uuid) is
  'Adds one impression when the ad is live. Does nothing for an inactive or out-of-dates ad.';

create or replace function public.record_ad_click(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  destination text;
begin
  if p_id is null then
    return null;
  end if;

  update public.ads
  set clicks = clicks + 1
  where id = p_id
    and active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  returning click_url into destination;

  return destination;
end;
$$;

revoke all on function public.record_ad_click(uuid) from public;
grant execute on function public.record_ad_click(uuid) to anon, authenticated;

comment on function public.record_ad_click(uuid) is
  'Adds one click and returns the destination when the ad is live. Returns null otherwise.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ads',
  'ads',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read an ad image" on storage.objects;
create policy "Anyone can read an ad image"
  on storage.objects for select
  to public
  using (bucket_id = 'ads');

drop policy if exists "Admins can upload an ad image" on storage.objects;
create policy "Admins can upload an ad image"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ads'
    and (select public.is_admin())
    and name ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$'
  );

drop policy if exists "Admins can replace an ad image" on storage.objects;
create policy "Admins can replace an ad image"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'ads' and (select public.is_admin()))
  with check (
    bucket_id = 'ads'
    and (select public.is_admin())
    and name ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$'
  );

drop policy if exists "Admins can delete an ad image" on storage.objects;
create policy "Admins can delete an ad image"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'ads' and (select public.is_admin()));
