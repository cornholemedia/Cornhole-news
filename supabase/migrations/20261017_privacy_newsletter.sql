-- Describe the newsletter and contact mail in the privacy policy.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Rewrites a saved privacy page only where the old sentences are still present,
-- so a page that was already rewritten in the admin screen is left alone.
-- [MAILING ADDRESS], [STATE], and [DESIGNATED AGENT NAME] stay as tokens.
-- Fill them in src/lib/legal-placeholders.ts. The public pages substitute
-- those values wherever the tokens still appear.

update public.pages
set body = replace(
  body,
  'We do not run a newsletter, and the site has no paid plans, so we do not collect payment card numbers and we do not send marketing email.',
  $privacy$The site has no paid plans, so we do not collect payment card numbers.

- **Newsletter.** If you join from the footer, we store your email address, the page you signed up from, and a one-way hash of your IP address. We email that address to confirm the signup, and we may send Midwest news after that. Every newsletter message includes an unsubscribe link. The link works without an account. After you unsubscribe we keep the address with an unsubscribed status so we do not email it again.$privacy$
)
where slug = 'privacy'
  and body like '%We do not run a newsletter%';

update public.pages
set body = replace(
  body,
  '- **Contact form.** Name, email address, subject if you include one, and your message. We also store a one-way hash of the IP address, not the address itself, so we can limit repeated submissions.',
  '- **Contact form.** Name, email address, subject if you include one, and your message. We email that message to the operator''s contact inbox and keep a copy. We also store a one-way hash of the IP address, not the address itself, so we can limit repeated submissions.'
)
where slug = 'privacy'
  and body like '%**Contact form.**%'
  and body not like '%operator''s contact inbox%';

update public.pages
set body = replace(
  body,
  '- **Analytics.** We use Vercel Web Analytics. It is cookieless. It does not record your session and it does not replay what you do on the page. It gives us aggregate counts, such as how many people opened a page.',
  '- **Analytics.** We use Vercel Web Analytics. It is cookieless. It does not record your session and it does not replay what you do on the page. It gives us aggregate counts, such as how many people opened a page.
- **Bot check.** When the check is turned on, signup, login, password reset, and the public forms ask Cloudflare Turnstile whether a person submitted them. This is not used for advertising.'
)
where slug = 'privacy'
  and body like '%Vercel Web Analytics%'
  and body not like '%Cloudflare Turnstile%';

update public.pages
set body = replace(
  body,
  '- To limit spam, abuse, and repeated form submissions',
  '- To email you the newsletter you joined, and to stop emailing you after you unsubscribe
- To limit spam, abuse, and repeated form submissions'
)
where slug = 'privacy'
  and body not like '%newsletter you joined%';

update public.pages
set body = replace(
  body,
  '- **Resend** delivers contact messages and new job-posting notices to the inbox set by the site operator.',
  '- **Resend** delivers contact-form messages, new job-posting notices, and newsletter mail.'
)
where slug = 'privacy'
  and body like '%delivers contact messages and new job-posting notices%';

update public.pages
set body = replace(
  body,
  '- **Resend** delivers contact messages and job applications to the inbox set by the site operator.',
  '- **Resend** delivers contact-form messages, job notices, and newsletter mail.'
)
where slug = 'privacy'
  and body like '%delivers contact messages and job applications%';

update public.pages
set body = replace(
  body,
  '- IP hashes used to limit abuse are deleted after about two days.',
  '- Newsletter addresses stay until you unsubscribe or you ask us to delete them. After you unsubscribe we keep the address marked unsubscribed so a later signup does not turn the mail back on by itself.
- IP hashes used to limit abuse are deleted after about two days.'
)
where slug = 'privacy'
  and body like '%IP hashes used to limit abuse%'
  and body not like '%Newsletter addresses stay%';

update public.pages
set body = regexp_replace(
  body,
  'Effective date: October [0-9]{1,2}, 2026\.',
  'Effective date: October 17, 2026.'
)
where slug = 'privacy'
  and body like '%**Newsletter.**%';
