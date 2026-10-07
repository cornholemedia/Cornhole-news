-- Replace starter copy that described the game of cornhole.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
--
-- Cornhole News is a news and discussion site for the 12 Midwestern states.
-- The name stays. This only rewrites a page when that field still has the
-- original game wording, so an edit made in the admin screen is left alone.
-- Privacy and Terms drafts that still say PLACEHOLDER are filled in by
-- 20261007_legal_pages_text.sql. The two replaces below cover a draft that
-- was saved before this wording change.

update public.pages
set body = $about$Cornhole News is a news and discussion site for the 12 Midwestern states.

People share links, start conversations, and comment on what is happening in the region. The site is inspired by classic link aggregators and is built to stay simple, fast, and focused on the content.$about$
where slug = 'about'
  and coalesce(body, '') like '%game of cornhole%';

update public.pages
set subtitle = 'Job openings and opportunities.'
where slug = 'jobs'
  and subtitle = 'Cornhole-related job openings and opportunities.';

update public.pages
set subtitle = 'Reach readers who follow news and discussion across the 12 Midwestern states.'
where slug = 'advertise'
  and coalesce(subtitle, '') like '%cornhole players, fans, league organizers%';

update public.pages
set body = replace(
  body,
  'The site is a community place to share links, posts, and comments about cornhole.',
  'The site is a news and discussion community for the 12 Midwestern states, where people share links, posts, and comments.'
)
where slug = 'privacy'
  and coalesce(body, '') like '%comments about cornhole%';

update public.pages
set body = replace(
  body,
  'Resume files are stored in a private bucket, and a download link in an application email works only for a limited time.',
  'Resume files are stored in a private bucket, and a copy is attached to the application email sent to the site operator.'
)
where slug = 'privacy'
  and coalesce(body, '') like '%download link in an application email%';
