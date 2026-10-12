-- Politics tag on posts, and a saved "show politics" choice for signed-in readers.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
--
-- This does not change who can read, create, edit, or delete posts.
-- Authors can still update their own posts, and admins can still update any post,
-- so both can set the new flag with the policies that already exist.
-- Existing posts are not political. Existing accounts still show every post.

alter table public.posts
  add column if not exists is_political boolean not null default false;

comment on column public.posts.is_political is
  'True when the author or an admin tagged this post as political.';

alter table public.profiles
  add column if not exists show_politics boolean not null default true;

comment on column public.profiles.show_politics is
  'When false, this signed-in reader prefers the home feed to hide political posts.';

-- Profile updates are limited to specific columns. Username stays as it is.
-- is_admin is still not self-serve (column grant + protect_profile_admin_flag).
grant update (show_politics) on table public.profiles to authenticated;

-- The home page, New page, and profile pages read this view.
-- The new column is added at the end, which CREATE OR REPLACE VIEW allows.
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
  p.is_political
from public.posts p
join public.profiles pr on pr.id = p.author_id
left join (
  select post_id, count(*) as vote_count from public.votes group by post_id
) v on v.post_id = p.id
left join (
  select post_id, count(*) as comment_count from public.comments group by post_id
) c on c.post_id = p.id;
