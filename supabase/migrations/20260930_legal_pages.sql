-- Privacy, Terms, and Contact pages, plus a contact link on Advertise.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Does not overwrite a page the owner has already edited, except the old
-- Advertise "contact form will be added" note and the Jobs "contact us" link
-- when those exact phrases are still in the saved text.

alter table public.pages drop constraint if exists pages_slug_check;
alter table public.pages add constraint pages_slug_check
  check (slug in ('about', 'jobs', 'advertise', 'privacy', 'terms', 'contact'));

insert into public.pages (slug, title, subtitle, body)
values
  (
    'privacy',
    'Privacy Policy',
    'PLACEHOLDER — replace this with your real privacy policy.',
    $privacy$## PLACEHOLDER — not a real privacy policy

This page is starter text so the site has a privacy link. It is not legal advice and it does not describe a finished privacy policy.

Replace every paragraph here with your own policy before you treat this page as official. Say what you collect (for example account email, username, posts, and comments), why you collect it, and how people can reach you.

note: Owner: edit this page from the admin screen and replace this placeholder.$privacy$
  ),
  (
    'terms',
    'Terms of Use',
    'PLACEHOLDER — replace this with your real terms of use.',
    $terms$## PLACEHOLDER — not real terms of use

This page is starter text so the site has a terms link. It is not legal advice and it is not a finished terms of use.

Replace every paragraph here with the rules you want for accounts, posts, comments, and advertising.

note: Owner: edit this page from the admin screen and replace this placeholder.$terms$
  ),
  (
    'contact',
    'Contact',
    'PLACEHOLDER — replace this with how people should reach Cornhole News.',
    $contact$## PLACEHOLDER — add your real contact details

This page does not send messages anywhere yet. Replace the address below with the email you want people to use.

Email: [replace-this@example.com](mailto:replace-this@example.com)

note: Owner: edit this page and put in a real email address. No contact form is connected.$contact$
  )
on conflict (slug) do nothing;

update public.pages
set body = replace(
  body,
  'note: (Contact form / email will be added here once the site is live.)',
  'Questions about advertising? [Contact us](/contact).'
)
where slug = 'advertise'
  and body like '%(Contact form / email will be added here once the site is live.)%';

update public.pages
set body = replace(body, '[contact us](/advertise)', '[contact us](/contact)')
where slug = 'jobs'
  and body like '%[contact us](/advertise)%';
