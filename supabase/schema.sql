-- Cornhole News database schema
-- Paste this whole file into Supabase Dashboard -> SQL Editor -> New query -> Run

-- 1. Profiles table (one row per signed-up user, linked to Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- is_admin is not a self-serve flag. The API can update username only.
-- Promote someone from the SQL editor:
--   update public.profiles set is_admin = true where username = 'your_username';
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.protect_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.is_admin, false) and auth.uid() is not null and not public.is_admin() then
      new.is_admin := false;
    end if;
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an existing admin, or the Supabase SQL editor, can change is_admin';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_admin_flag() from public, anon;
grant execute on function public.protect_profile_admin_flag() to authenticated, service_role;

drop trigger if exists profiles_protect_admin_flag on public.profiles;
create trigger profiles_protect_admin_flag
  before insert or update on public.profiles
  for each row execute procedure public.protect_profile_admin_flag();

update public.profiles
set is_admin = true
where username = 'Cornhole_Admin';

revoke update on table public.profiles from anon, authenticated;
grant update (username) on table public.profiles to authenticated;
revoke insert on table public.profiles from anon, authenticated;
grant insert (id, username) on table public.profiles to authenticated;

-- Auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Signup runs this trigger as supabase_auth_admin, not as a site visitor.
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Posts table
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 300),
  url text,
  body text,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "Posts are viewable by everyone"
  on public.posts for select
  using (true);

create policy "Logged-in users can create posts"
  on public.posts for insert
  with check (auth.uid() = author_id);

create policy "Authors can delete their own posts"
  on public.posts for delete
  using (auth.uid() = author_id);

-- 3. Votes table (one vote per user per post)
create table if not exists public.votes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.votes enable row level security;

create policy "Votes are viewable by everyone"
  on public.votes for select
  using (true);

create policy "Logged-in users can vote"
  on public.votes for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own vote"
  on public.votes for delete
  using (auth.uid() = user_id);

-- 4. Comments table
create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "Comments are viewable by everyone"
  on public.comments for select
  using (true);

create policy "Logged-in users can comment"
  on public.comments for insert
  with check (auth.uid() = author_id);

create policy "Authors can delete their own comments"
  on public.comments for delete
  using (auth.uid() = author_id);


-- Authors can update their own posts; admins can update/delete any post
create policy "Authors can update their own posts"
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "Admins can update any post"
  on public.posts for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy "Admins can delete any post"
  on public.posts for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy "Admins can delete any comment"
  on public.comments for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- 5. A view that joins posts with vote counts, comment counts, and author name
-- (This is what the homepage/new page actually query.)
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
  coalesce(c.comment_count, 0) as comment_count
from public.posts p
join public.profiles pr on pr.id = p.author_id
left join (
  select post_id, count(*) as vote_count from public.votes group by post_id
) v on v.post_id = p.id
left join (
  select post_id, count(*) as comment_count from public.comments group by post_id
) c on c.post_id = p.id;

-- 6. Editable static pages (About, Jobs, Advertise, Privacy, Terms, Contact)
create table if not exists public.pages (
  slug text primary key check (slug in ('about', 'jobs', 'advertise', 'privacy', 'terms', 'contact')),
  title text not null check (char_length(title) between 1 and 200),
  subtitle text not null default '' check (char_length(subtitle) <= 400),
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.pages enable row level security;

create policy "Pages are viewable by everyone"
  on public.pages for select
  using (true);

create policy "Admins can insert pages"
  on public.pages for insert
  with check (public.is_admin());

create policy "Admins can update pages"
  on public.pages for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete pages"
  on public.pages for delete
  using (public.is_admin());

create or replace function public.touch_page_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.touch_page_row() from public, anon;
grant execute on function public.touch_page_row() to authenticated, service_role;

drop trigger if exists pages_touch_row on public.pages;
create trigger pages_touch_row
  before insert or update on public.pages
  for each row execute procedure public.touch_page_row();

grant select on public.pages to anon, authenticated;
grant insert, update, delete on public.pages to authenticated;

insert into public.pages (slug, title, subtitle, body)
values
  (
    'about',
    'About Cornhole News',
    '',
    $about$Cornhole News is a news and discussion site for the 12 Midwestern states.

People share links, start conversations, and comment on what is happening in the region. The site is inspired by classic link aggregators and is built to stay simple, fast, and focused on the content.$about$
  ),
  (
    'jobs',
    'Jobs',
    'Job openings and opportunities.',
    $jobs$## No jobs posted yet

note: Check back later, or [contact us](/contact) if you'd like to post a position.$jobs$
  ),
  (
    'advertise',
    'Advertise on Cornhole News',
    'Reach readers who follow news and discussion across the 12 Midwestern states.',
    $advertise$## Ad Placements

- **Sidebar 300×250** — Standard medium rectangle
- **Sidebar 300×600** — Tall skyscraper unit

Interested in advertising? [Contact us](/contact) and we'll get back to you with rates and availability.$advertise$
  ),
  (
    'privacy',
    'Privacy Policy',
    'How Cornhole Media handles information on Cornhole News.',
    $privacy$Effective date: October 7, 2026.

Cornhole Media ("we", "us") operates Cornhole News at https://cornholenews.news. The site is a news and discussion community for the 12 Midwestern states, where people share links, posts, and comments. This policy says what we collect, why we collect it, who helps us run the site, and how you can reach us.

## Who we are

The operator is Cornhole Media. For privacy questions, email [cornholemedia@gmail.com](mailto:cornholemedia@gmail.com). Our mailing address is [MAILING ADDRESS].

## Information we collect

We collect what the site needs in order to work:

- **Account details.** When you sign up we collect your email address and username. Your password is handled by Supabase Auth. We do not see or store the password itself.
- **Age confirmation.** Signup asks you to confirm that you are at least 13 and that you agree to the Terms of Use and this Privacy Policy. We do not collect birthdates.
- **Posts and comments.** We store the links, text, and comments you submit, and the votes you cast, with the account that posted them.
- **Contact form.** Name, email address, subject if you include one, and your message. We also store a one-way hash of the IP address, not the address itself, so we can limit repeated submissions.
- **Job applications.** Full name, email, phone, city, state, the position you are applying for, an optional portfolio, LinkedIn, or other website, a cover letter or message, an optional note about how you heard about us, your consent, and your resume file. We store the same kind of IP hash as on the contact form.
- **Server logs.** Our host keeps basic technical logs, such as the browser type, the time, and the page requested, to keep the site secure and running.
- **Analytics.** We use Vercel Web Analytics. It is cookieless. It does not record your session and it does not replay what you do on the page. It gives us aggregate counts, such as how many people opened a page.

We do not run a newsletter, and the site has no paid plans, so we do not collect payment card numbers and we do not send marketing email.

## Why we collect it

- To create your account and keep you signed in
- To publish the posts, comments, and votes you choose to share
- To read and reply to contact messages
- To review job applications and contact applicants
- To limit spam, abuse, and repeated form submissions
- To keep the site secure and to see, in aggregate, which pages are used
- To respond to a legal request, such as a copyright notice

## Service providers

We do not sell personal information. These companies process it for us so the site can run:

- **Supabase** stores the database, runs account login, and stores resume files in a private storage bucket.
- **Vercel** hosts the website and provides the cookieless analytics described above.
- **Resend** delivers contact messages and job applications to the inbox set by the site operator.

We may also disclose information if the law requires it, or to protect the site and its users from abuse.

## Cookies

We use cookies only to keep you signed in. Those are authentication session cookies from Supabase. We do not use advertising cookies. We do not use session-replay tools or cross-site tracking.

## How long we keep it

- Account records, posts, and comments stay until you delete them or you ask us to delete your account.
- Contact messages and job applications, including resume files, are kept long enough to reply and to consider an application, and then for up to 24 months, unless a legal claim means we need a copy longer.
- IP hashes used to limit abuse are deleted after about two days.
- Server logs follow our host's ordinary retention schedule.

## Your choices and rights

You can edit or delete your own posts. You can email us to delete your account, to correct personal information, or to ask for a copy of the personal information we have about you. Write to [cornholemedia@gmail.com](mailto:cornholemedia@gmail.com). We may keep a limited record when the law requires it, for example a copyright complaint.

## California notice

If you live in California, the California Consumer Privacy Act gives you the right to know what personal information we collect, to ask us to delete it, to ask us to correct it, and to know whether we sell or share it.

We do not sell personal information. We do not share it for cross-context behavioral advertising. We do not offer money or a discount in exchange for your information. We will not treat you differently because you used these rights.

To make a request, email [cornholemedia@gmail.com](mailto:cornholemedia@gmail.com). We may need to confirm that the request comes from you. We do not respond to a browser "Do Not Track" signal, because we do not track you across other websites.

## Children

Cornhole News is not directed to children under 13. You must confirm that you are at least 13 before you can create an account. We do not knowingly collect personal information from a child under 13. If you believe a child under 13 has given us information, email [cornholemedia@gmail.com](mailto:cornholemedia@gmail.com) and we will delete it.

## Security

The database uses row level security. Resume files are stored in a private bucket, and a copy is attached to the application email sent to the site operator. No website can guarantee perfect security. Use a password you do not reuse on other sites.

## Changes

If we change this policy, we will post the new version on this page and update the effective date. If a change is significant, we will also post a short note on the site.

## Contact

Cornhole Media
Email: [cornholemedia@gmail.com](mailto:cornholemedia@gmail.com)
Mail: [MAILING ADDRESS]$privacy$
  ),
  (
    'terms',
    'Terms of Use',
    'The rules for using Cornhole News.',
    $terms$Effective date: October 7, 2026.

These terms are an agreement between you and Cornhole Media for your use of Cornhole News at https://cornholenews.news. If you do not agree, do not use the site.

## Eligibility

You must be at least 13 years old. When you create an account you confirm that you are at least 13 and that you agree to these terms and the [Privacy Policy](/privacy). We do not collect birthdates.

## Accounts

Use an email address you can open, and a username made of letters, numbers, and underscores. You are responsible for your password and for what happens under your account. Tell us if you think someone else is using it. We may refuse a username, or close an account, that breaks these terms.

## Your content

You keep ownership of the text, links, and other material you submit. You give Cornhole Media a non-exclusive, worldwide, royalty-free license to host, store, display, and share that material as part of the site. The license lasts for as long as we need it to operate the site. It ends when the material is deleted, except for copies we have to keep for a legal reason, short-lived backups, and material someone else has already copied or quoted.

You are responsible for what you post. You promise that you have the rights you need to post it, and that it does not infringe anyone else's rights.

## Prohibited conduct

You may not:

- Break the law, or post anything that infringes copyright or another legal right
- Harass, threaten, or publish another person's private information
- Post spam, scams, or malware, or pretend to be another person
- Probe, disrupt, or scrape the site in a way that harms it, or bypass an access control
- Use the site to collect personal information from anyone under 13

## Moderation

We may remove or refuse a post or comment, and we may suspend or close an account, when we believe these terms were broken or when it protects the community. We are not obligated to monitor every submission. Posts and comments come from users. They are not advice from Cornhole Media, and they are not professional, medical, or legal advice.

## Copyright and DMCA

We respect the intellectual property of others. If you believe material on the site infringes a copyright you own, you may send a notice to our designated agent.

- **Designated agent:** [DESIGNATED AGENT NAME]
- **Postal address:** [MAILING ADDRESS]
- **Email:** [cornholemedia@gmail.com](mailto:cornholemedia@gmail.com)

note: Cornhole Media still has to register this designated agent with the U.S. Copyright Office. Until that registration is complete, the agent name and postal address above are fill-in text in square brackets.

Your notice must include all of the following:

- Your physical or electronic signature
- Identification of the copyrighted work you claim was infringed
- Identification of the material on this site, and information reasonably sufficient for us to find it (a URL is best)
- Your name, mailing address, telephone number, and email address
- A statement that you have a good-faith belief that the use is not authorized by the copyright owner, its agent, or the law
- A statement, under penalty of perjury, that the information in the notice is accurate and that you are the copyright owner or are authorized to act for the owner

If we remove material because of a notice, we may tell the person who posted it. That person may send a counter-notice. A counter-notice must include:

- Their physical or electronic signature
- Identification of the material that was removed and the place it appeared before it was removed
- A statement, under penalty of perjury, that they have a good-faith belief the material was removed or disabled because of mistake or misidentification
- Their name, address, and telephone number, and a statement that they consent to the jurisdiction of the federal district court for their address, or if they are outside the United States, for any judicial district in which we may be found, and that they will accept service of process from the person who sent the original notice

If we receive a valid counter-notice, we may restore the material in 10 to 14 business days unless the original sender has filed a court action asking the court to keep the material down.

**Repeat infringers.** In appropriate circumstances, we will terminate the accounts of users who are repeat infringers.

## Advertising

The site may show advertisements. An ad is not an endorsement by Cornhole Media. Advertisers are responsible for their own claims. The site does not sell paid memberships and it does not have a checkout.

## Disclaimers

The site and its contents are provided "as is" and "as available." We do not warrant that the site will be uninterrupted, that a post is accurate, or that the site is free of errors. To the fullest extent the law allows, we disclaim the implied warranties of merchantability, fitness for a particular purpose, and non-infringement.

## Limitation of liability

To the fullest extent the law allows, Cornhole Media and its owners will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising out of your use of the site. Our total liability for any claim relating to the site will not exceed the greater of one hundred U.S. dollars (USD $100) or the amount you paid us to use the site during the twelve months before the claim. Use of the site is currently free. Some states do not allow these limits. In those states, our liability is limited to the smallest extent the law allows.

## Indemnity

If a claim is brought against Cornhole Media or its owners because of your content, your use of the site, or your violation of these terms, you agree to cover the damages, losses, and reasonable attorney fees that result. We will notify you of a claim covered by this section.

## Termination

You may stop using the site at any time, and you may ask us to delete your account. We may suspend or close an account, remove content, or discontinue the site. The sections that by their nature should survive will survive, including the content license for material we must still keep, disclaimers, limitation of liability, indemnity, and the copyright process.

## Governing law

These terms are governed by the laws of the State of [STATE], without regard to its conflict-of-law rules. The state and federal courts located in that state are the exclusive venue for disputes, except that either party may bring an individual claim in small claims court, and a copyright claim may be brought where federal law requires.

## Changes

We may update these terms by posting a new version on this page and changing the effective date. If you keep using the site after that date, the updated terms apply to you.

## Contact

Cornhole Media
Email: [cornholemedia@gmail.com](mailto:cornholemedia@gmail.com)
Mail: [MAILING ADDRESS]$terms$
  ),
  (
    'contact',
    'Contact',
    'Questions, tips, and other notes for Cornhole News.',
    $contact$Use the form on this page to reach Cornhole Media. We read every message.

Email: [cornholemedia@gmail.com](mailto:cornholemedia@gmail.com)$contact$
  )
on conflict (slug) do nothing;

-- Contact and job forms, inbox settings, resume storage, the signup age
-- check, Midwest starter copy, and later privacy/terms edits live in
-- supabase/migrations/20261007_*.sql.
-- Run those after this file. They are safe to run more than once.
