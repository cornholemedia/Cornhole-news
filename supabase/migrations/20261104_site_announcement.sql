-- One site-wide announcement. Visitors can read it only while it is on.
-- Admins can read and update it, including while it is off.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/schema.sql first so public.is_admin() exists.

do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing. Run supabase/schema.sql first.';
  end if;
end $$;

create table if not exists public.site_announcement (
  id smallint primary key default 1,
  body text not null default '',
  link_url text,
  active boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint site_announcement_singleton check (id = 1)
);

alter table public.site_announcement drop constraint if exists site_announcement_body_check;
alter table public.site_announcement
  add constraint site_announcement_body_check check (
    char_length(body) <= 280
    and body = btrim(body)
    and body !~ '[[:cntrl:]]'
    and (not active or char_length(body) >= 1)
  );

alter table public.site_announcement drop constraint if exists site_announcement_link_check;
alter table public.site_announcement
  add constraint site_announcement_link_check check (
    link_url is null
    or (
      char_length(link_url) between 1 and 2000
      and link_url !~ '[[:space:][:cntrl:]]'
      and link_url !~ '^//'
      and (
        (
          link_url ~ '^https://'
          and link_url !~ '^https://[^/?#]*@'
        )
        or link_url ~ '^/[^/]'
        or link_url = '/'
      )
    )
  );

comment on table public.site_announcement is
  'Single banner shown at the top of the site. Visitors can read it only while active. Admins can change it.';

alter table public.site_announcement enable row level security;

drop policy if exists "Anyone can read a live announcement" on public.site_announcement;
create policy "Anyone can read a live announcement"
  on public.site_announcement for select
  to anon, authenticated
  using (active = true and char_length(body) >= 1);

drop policy if exists "Admins can read the announcement" on public.site_announcement;
create policy "Admins can read the announcement"
  on public.site_announcement for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can update the announcement" on public.site_announcement;
create policy "Admins can update the announcement"
  on public.site_announcement for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on table public.site_announcement from public, anon, authenticated;
grant select on table public.site_announcement to anon, authenticated;
grant update on table public.site_announcement to authenticated;

insert into public.site_announcement (id, body, link_url, active)
values (1, '', null, false)
on conflict (id) do nothing;
