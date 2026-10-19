-- Fill leftover legal tokens, describe the one-click unsubscribe link,
-- and set the privacy and terms dates to October 18, 2026.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Run supabase/migrations/20261017_privacy_newsletter.sql first.
--
-- The saved privacy page was edited by hand, so that earlier file did not
-- replace its newsletter paragraph. This file changes only that sentence,
-- any leftover [MAILING ADDRESS], [STATE], or [DESIGNATED AGENT NAME]
-- tokens, and a leading effective or last-updated date. The values match
-- src/lib/legal-placeholders.ts. Public pages also substitute those tokens
-- at render time. The rest of a hand-edited page is left as it is.

update public.pages
set body = regexp_replace(
  body,
  'You[[:space:]]+can[[:space:]]+email[[:space:]]+us[[:space:]]+at[[:space:]]+any[[:space:]]+time[[:space:]]+to[[:space:]]+unsubscribe\.',
  'Every newsletter email includes a one-click unsubscribe link, and you can also email us at any time to unsubscribe.',
  'g'
)
where slug = 'privacy'
  and body ~ 'You[[:space:]]+can[[:space:]]+email[[:space:]]+us[[:space:]]+at[[:space:]]+any[[:space:]]+time[[:space:]]+to[[:space:]]+unsubscribe\.'
  and body !~ 'one-click unsubscribe link';

update public.pages
set body = replace(
  body,
  '[MAILING ADDRESS]',
  'Cornhole Media, 1609 N Riverfront Dr, Suite 200, Mankato, MN 56001'
)
where body like '%[MAILING ADDRESS]%';

update public.pages
set body = replace(body, '[DESIGNATED AGENT NAME]', 'Cornhole Media')
where body like '%[DESIGNATED AGENT NAME]%';

update public.pages
set body = replace(body, '[STATE]', 'Minnesota')
where body like '%[STATE]%';

update public.pages
set body = regexp_replace(
  body,
  'Effective date: [^\r\n]+',
  'Effective date: October 18, 2026.',
  'g'
)
where slug in ('privacy', 'terms')
  and body ~ 'Effective date:'
  and body !~ 'Effective date: October 18, 2026\.';

update public.pages
set body = regexp_replace(
  body,
  'Last updated: [^\r\n]+',
  'Last updated: October 18, 2026.',
  'g'
)
where slug in ('privacy', 'terms')
  and body ~ 'Last updated:'
  and body !~ 'Last updated: October 18, 2026\.';
